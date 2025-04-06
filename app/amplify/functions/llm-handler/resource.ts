import { defineFunction } from '@aws-amplify/backend';

export const llmHandlerFunction = defineFunction({
  name: 'pagehub-llm-handler',
  // entry: './handler.ts' // We'll create this handler file next
  // TODO: Add environment variables for Anthropic API Key (from Secrets Manager)
  // TODO: Add IAM permissions to access Secrets Manager
}); 