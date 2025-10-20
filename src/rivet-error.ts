import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const rivetErrorDataSchema = z.object({
  object: z.literal('error'),
  message: z.string(),
  type: z.string(),
  param: z.string().nullable(),
  code: z.string().nullable(),
});

export type RivetErrorData = z.infer<typeof rivetErrorDataSchema>;

export const rivetFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: rivetErrorDataSchema,
  errorToMessage: data => data.message,
});
