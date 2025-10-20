# Rivet Provider for Vercel AI SDK

This is the [Rivet](https://rivet.ironcladapp.com) provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) giving you access to run your Rivet Graphs as a supported LM.

## Setup for AI SDK v5

```bash
# For pnpm
pnpm add @alpic80/rivet-ai-sdk-provider

# For npm
npm install @alpic80/rivet-ai-sdk-provider

# For yarn
yarn add @alpic80/rivet-ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `rivet` from `@alpic80/rivet-ai-sdk-provider`:

```ts
import { rivet } from '@alpic80/rivet-ai-sdk-provider';
```

## Example

```ts
import { rivet } from '"@alpic80/rivet-ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: rivet('myGraph.rivet-project'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Required Configuration

In order to use the Rivet AI SDK provider you will need to also install and run the Adion custom Rivet server
available on npm (@alpic80/rivet-cli) and to configure it with support for PROJECTS_ROOT_DIR (see serve.md for details)
