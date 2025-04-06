import { defineFunction } from '@aws-amplify/backend';

export const createSite = defineFunction({
  // Basic configuration, we will add S3/DynamoDB access later
  name: 'pagehub-create-site',
  // entry: './handler.ts' // We'll create this handler file next
}); 