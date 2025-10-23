import { APICallError, EmptyResponseBodyError } from '@ai-sdk/provider';

import { EventSourceParserStream, extractResponseHeaders, safeParseJSON } from '@ai-sdk/provider-utils';
import type { EventSourceMessage, FetchFunction, FlexibleSchema, ParseResult } from '@ai-sdk/provider-utils';
import { isAbortError } from '@ai-sdk/provider-utils';
import type { ResponseHandler } from '@ai-sdk/provider-utils';
import { getRuntimeEnvironmentUserAgent } from '@ai-sdk/provider-utils';
import { withUserAgentSuffix } from '@ai-sdk/provider-utils';
import { VERSION } from './version';
import { debugLog, printObject } from './utils';

// use function to allow for mocking in tests:
const getOriginalFetch = () => globalThis.fetch;

export const postJsonToApi = async <T>({
  url,
  headers,
  body,
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch,
}: {
  url: string;
  headers?: Record<string, string | undefined>;
  body: unknown;
  failedResponseHandler: ResponseHandler<APICallError>;
  successfulResponseHandler: ResponseHandler<T>;
  abortSignal?: AbortSignal;
  fetch?: FetchFunction;
}) =>
  postToApi({
    url,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: {
      content: JSON.stringify(body),
      values: body,
    },
    failedResponseHandler,
    successfulResponseHandler,
    abortSignal,
    fetch,
  });

export const postFormDataToApi = async <T>({
  url,
  headers,
  formData,
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch,
}: {
  url: string;
  headers?: Record<string, string | undefined>;
  formData: FormData;
  failedResponseHandler: ResponseHandler<APICallError>;
  successfulResponseHandler: ResponseHandler<T>;
  abortSignal?: AbortSignal;
  fetch?: FetchFunction;
}) =>
  postToApi({
    url,
    headers,
    body: {
      content: formData,
      values: Object.fromEntries((formData as any).entries()),
    },
    failedResponseHandler,
    successfulResponseHandler,
    abortSignal,
    fetch,
  });

export const postToApi = async <T>({
  url,
  headers = {},
  body,
  successfulResponseHandler,
  failedResponseHandler,
  abortSignal,
  fetch = getOriginalFetch(),
}: {
  url: string;
  headers?: Record<string, string | undefined>;
  body: {
    // content: string | FormData | Uint8Array;
		content: string | FormData | Uint8Array | ArrayBuffer;
    values: unknown;
  };
  failedResponseHandler: ResponseHandler<Error>;
  successfulResponseHandler: ResponseHandler<T>;
  abortSignal?: AbortSignal;
  fetch?: FetchFunction;
}) => {
  try {
		let bodyContent: string | FormData | ArrayBuffer

		if (typeof body.content === 'string' || body.content instanceof FormData) {
			bodyContent = body.content
		} else if (body.content instanceof Uint8Array) {
			bodyContent = (body.content as Uint8Array).buffer as ArrayBuffer
		} else if (body.content instanceof ArrayBuffer) {
			bodyContent = body.content
		} else {
			throw new TypeError('Unsupported body content type')
		}

    const response = await fetch(url, {
      method: 'POST',
      headers: withUserAgentSuffix(
        headers,
        `ai-sdk/provider-utils/${VERSION}`,
        getRuntimeEnvironmentUserAgent(),
      ),
      body: bodyContent,
      signal: abortSignal,
    });

    const responseHeaders = extractResponseHeaders(response);

    if (!response.ok) {
      let errorInformation: {
        value: Error;
        responseHeaders?: Record<string, string> | undefined;
      };

      try {
        errorInformation = await failedResponseHandler({
          response,
          url,
          requestBodyValues: body.values,
        });
      } catch (error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }

        throw new APICallError({
          message: 'Failed to process error response',
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: body.values,
        });
      }

      throw errorInformation.value;
    }

    try {
      return await successfulResponseHandler({
        response,
        url,
        requestBodyValues: body.values,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (isAbortError(error) || APICallError.isInstance(error)) {
          throw error;
        }
      }

      throw new APICallError({
        message: 'Failed to process successful response',
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: body.values,
      });
    }
  } catch (error) {
    throw handleFetchError({ error, url, requestBodyValues: body.values });
  }
};


const FETCH_FAILED_ERROR_MESSAGES = ['fetch failed', 'failed to fetch'];

export function handleFetchError({
  error,
  url,
  requestBodyValues,
}: {
  error: unknown;
  url: string;
  requestBodyValues: unknown;
}) {
  if (isAbortError(error)) {
    return error;
  }

  // unwrap original error when fetch failed (for easier debugging):
  if (
    error instanceof TypeError &&
    FETCH_FAILED_ERROR_MESSAGES.includes(error.message.toLowerCase())
  ) {
    const cause = (error as any).cause;

    if (cause != null) {
      // Failed to connect to server:
      return new APICallError({
        message: `Cannot connect to API: ${cause.message}`,
        cause,
        url,
        requestBodyValues,
        isRetryable: true, // retry when network error
      });
    }
  }

  return error;
}


export const createEventSourceResponseHandler =
  <T>(
    chunkSchema: FlexibleSchema<T>,
  ): ResponseHandler<ReadableStream<ParseResult<T>>> =>
  async ({ response }: { response: Response }) => {
    const responseHeaders = extractResponseHeaders(response);

    if (response.body == null) {
      throw new EmptyResponseBodyError({});
    }

    return {
      responseHeaders,
      value: parseJsonEventStream({
        stream: response.body,
        schema: chunkSchema,
      }),
    };
  };


export function parseJsonEventStream<T>({
  stream,
  schema,
}: {
  stream: ReadableStream<Uint8Array>;
  schema: FlexibleSchema<T>;
}): ReadableStream<ParseResult<T>> {
  return stream
//    .pipeThrough(new TextDecoderStream())
		.pipeThrough(new TransformStream<Uint8Array, string>({
			transform(chunk, controller) {
				const decoded = new TextDecoder().decode(chunk)
				debugLog(`Decoded:${printObject(decoded)}`)
				controller.enqueue(decoded)
			}
		}))
    .pipeThrough(new EventSourceParserStream())
    .pipeThrough(
      new TransformStream<EventSourceMessage, ParseResult<T>>({
        async transform({ data }, controller) {
          // ignore the 'DONE' event that e.g. OpenAI sends:
          if (data === '[DONE]') {
            return;
          }

					debugLog(`Data to schema:${printObject(data)}`)
          controller.enqueue(await safeParseJSON({ text: data, schema }));
        },
      }),
    );
}
