import { z } from 'zod';

const ERRORS = {
  ENV_CONFIG_MISSING:
    'Environment configuration is missing. Please set up the necessary environment variables in your EdgeOne Pages project settings.',
  LLM_FAILED: 'An error occurred while calling the BASE_URL.',
  TIMEOUT: 'Upstream LLM request timed out. Please try again later.',
};

/** 上游请求超时时间（毫秒），留 5 秒缓冲给平台 30 秒限制 */
const UPSTREAM_TIMEOUT_MS = 25_000;

interface GeoData {
  asn: number;
  countryName: string;
  countryCodeAlpha2: string;
  countryCodeAlpha3: string;
  countryCodeNumeric: string;
  regionName: string;
  regionCode: string;
  cityName: string;
  latitude: number;
  longitude: number;
  cisp: string;
}

interface EORequest extends Request {
  eo: {
    geo: GeoData;
    uuid: string;
    clientIp: string;
  };
}

interface UserInfo {
  client_ip: string;
  uuid: string;
  geo: {
    asn: number;
    country_name: string;
    country_code: string;
    region_name: string;
    region_code: string;
    city_name: string;
    latitude: number;
    longitude: number;
    isp: string;
  };
}

/** 返回 OpenAI 兼容的 JSON 错误响应 */
function errorResponse(message: string, status = 500): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: 'server_error',
        code: status === 504 ? 'timeout' : 'internal_error',
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

function extractUserInfo(request: EORequest): UserInfo | null {
  const eo = request.eo;
  if (!eo || !eo.geo) {
    return null;
  }

  return {
    client_ip: eo.clientIp || '',
    uuid: eo.uuid || '',
    geo: {
      asn: eo.geo.asn || 0,
      country_name: eo.geo.countryName || '',
      country_code: eo.geo.countryCodeAlpha2 || '',
      region_name: eo.geo.regionName || '',
      region_code: eo.geo.regionCode || '',
      city_name: eo.geo.cityName || '',
      latitude: eo.geo.latitude || 0,
      longitude: eo.geo.longitude || 0,
      isp: eo.geo.cisp || '',
    },
  };
}

export async function onRequest({ request, env }: any) {
  request.headers.delete('accept-encoding');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const { BASE_URL, API_KEY, MODEL } = env;

  if (!BASE_URL || !API_KEY || !MODEL) {
    return errorResponse(ERRORS.ENV_CONFIG_MISSING);
  }

  const json = await request.clone().json();
  const result = z
    .object({
      messages: z.array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })
      ),
    })
    .passthrough()
    .safeParse(json);

  if (!result.success) {
    return errorResponse(result.error.message, 400);
  }

  const { messages } = result.data;

  // 提取用户地理位置信息
  const userInfo = extractUserInfo(request as EORequest);

  try {
    // 使用 AbortController 实现超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          stream: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 创建 TransformStream 来注入用户信息
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body!.getReader();

    // 异步处理流
    (async () => {
      try {
        // 转发所有原始数据块
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }

        // 在流结束时注入用户信息
        if (userInfo) {
          const userInfoEvent = `data: ${JSON.stringify({
            user_info: userInfo,
          })}

`;
          await writer.write(new TextEncoder().encode(userInfoEvent));
        }
      } catch (error) {
        console.error('Stream processing error:', error);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error('LLM error: ', error.message);

    // 区分超时和其他错误
    if (error.name === 'AbortError') {
      return errorResponse(ERRORS.TIMEOUT, 504);
    }

    return errorResponse(ERRORS.LLM_FAILED, 502);
  }
}
