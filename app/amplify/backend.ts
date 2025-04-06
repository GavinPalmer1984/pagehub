import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib'; // Import Stack to get region
// Auth resource is minimal for M1, not directly used here
// import { auth } from './auth/resource';
import { data } from './data/resource';
import { createSite as createSiteFunction } from './functions/create-site/resource';
import { llmHandlerFunction } from './functions/llm-handler/resource';

/**
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  // auth removed for M1
  data,
  createSiteFunction,
  llmHandlerFunction,
});

// Permissions for createSiteFunction removed

// NOTE: We will add Lambda functions for token generation and
// authorization later, along with their necessary permissions.

// --- createSiteFunction Permissions and Environment ---

// Get the API ID and AWS Region
const apiId = backend.data.resources.graphqlApi.apiId;
const region = Stack.of(backend.data).region; // Get region from the stack

// Add environment variables
backend.createSiteFunction.addEnvironment('APPSYNC_API_ID', apiId);
backend.createSiteFunction.addEnvironment('AWS_REGION_FOR_APPSYNC', region);

backend.createSiteFunction.addEnvironment(
    'LLM_FUNCTION_NAME',
    backend.llmHandlerFunction.resources.lambda.functionName
);

// Grant permissions to invoke the LLM handler function
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: [backend.llmHandlerFunction.resources.lambda.functionArn],
})
);

// Grant permissions to interact with its own AppSync API
// Note: This grants broad access to call any mutation/query via IAM.
// Consider refining this if possible, but IAM auth needs to be enabled on the API.
// We set default to IAM in data/resource.ts, so this should allow the calls.
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    resources: [
        backend.data.resources.graphqlApi.arn + '/*', // Allow calling any part of the API
    ],
})
);

// Grant S3 permissions (Bucket creation is broad, refine if possible)
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3:CreateBucket',
      's3:PutBucketWebsite',
      's3:PutBucketPolicy',
      's3:PutBucketVersioning',
      's3:PutObject',
      's3:PutObjectAcl' // May need for initial public read?
    ],
    resources: ['arn:aws:s3:::pagehub-site-*', 'arn:aws:s3:::pagehub-site-*/*'],
})
);

// --- llmHandlerFunction Permissions and Environment (Placeholder) ---
// TODO: Grant permissions for Anthropic API access (e.g., Secrets Manager)
// TODO: Add environment variables (e.g., API Key Secret ARN)
