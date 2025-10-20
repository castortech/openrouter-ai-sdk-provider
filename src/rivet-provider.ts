import {
  type LanguageModelV2,
  NoSuchModelError,
  type ProviderV2,
} from '@ai-sdk/provider';
import {
  type FetchFunction,
  loadApiKey,
  withoutTrailingSlash,
  withUserAgentSuffix,
} from '@ai-sdk/provider-utils';

import { RivetChatLanguageModel } from './rivet-chat-language-model';
import type { RivetChatModelId } from './rivet-chat-options';
import { VERSION } from './version';

export interface RivetProvider extends ProviderV2 {
  (modelId: RivetChatModelId): LanguageModelV2;

  /**
		Creates a model for text generation.
	*/
  languageModel(modelId: RivetChatModelId): LanguageModelV2;

  /**
		Creates a model for text generation.
	*/
  chat(modelId: RivetChatModelId): LanguageModelV2;
}

export interface RivetProviderSettings {
  /**
		Use a different URL prefix for API calls, e.g. to use proxy servers.
		The default prefix is `https://api.rivet.ai/v1`.
  */
  baseURL?: string;

  /**
		API key that is being send using the `Authorization` header.
		It defaults to the `RIVET_API_KEY` environment variable.
	*/
  apiKey?: string;

  /**
		Custom headers to include in the requests.
	*/
  headers?: Record<string, string>;

  /**
		Custom fetch implementation. You can use it as a middleware to intercept requests,
		or to provide a custom fetch implementation for e.g. testing.
  */
  fetch?: FetchFunction;

  generateId?: () => string;
}

/**
	Create a Rivet AI provider instance.
*/
export function createRivet(
  options: RivetProviderSettings = {},
): RivetProvider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? 'https://api.rivet.ai/v1';

  const getHeaders = () => withUserAgentSuffix(
		{
			Authorization: `Bearer ${loadApiKey({
				apiKey: options.apiKey,
				environmentVariableName: 'RIVET_API_KEY',
				description: 'Rivet',
			})}`,
			...options.headers,
		},
		`ai-sdk/rivet/${VERSION}`,
	);

  const createChatModel = (modelId: RivetChatModelId) =>
    new RivetChatLanguageModel(modelId, {
      provider: 'rivet.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId,
    });

  const provider = function (modelId: RivetChatModelId) {
    if (new.target) {
      throw new Error('The Rivet model function cannot be called with the new keyword.');
    }

    return createChatModel(modelId);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;

	provider.textEmbeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'textEmbeddingModel' });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

/**
Default Rivet provider instance.
 */
export const rivet = createRivet();
