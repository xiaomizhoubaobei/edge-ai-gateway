import { z } from 'zod';

const ERRORS = {
  ENV_CONFIG_MISSING:
    'Environment configuration is missing. Please set up the necessary environment variables in your EdgeOne Pages project settings.',
  LLM_FAILED: 'An error occurred while calling the BASE_URL.',
};

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
    return new Response(ERRORS.ENV_CONFIG_MISSING, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
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
    return new Response(result.error.message, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const { messages } = result.data;

  // 提取用户地理位置信息
  const userInfo = extractUserInfo(request as EORequest);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
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
    });

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
    return new Response(ERRORS.LLM_FAILED, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
