import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib'; // Import Stack to get region
// Auth resource is minimal for M1, not directly used here
// import { auth } from './auth/resource';
import { data } from './data/resource';
import { createSite as createSiteFunction } from './functions/create-site/resource';
import { llmHandlerFunction } from './functions/llm-handler/resource';
import { tokenGeneratorFunction } from './functions/token-generator/resource'; // Import token generator
import { tokenAuthorizerFunction } from './functions/token-authorizer/resource'; // Import authorizer

/**
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  // auth removed for M1
  data,
  createSiteFunction,
  llmHandlerFunction,
  tokenGeneratorFunction, // Add token generator
  tokenAuthorizerFunction, // Add authorizer
});

// Permissions for createSiteFunction removed

// NOTE: We will add Lambda functions for token generation and
// authorization later, along with their necessary permissions.

// --- Common Variables ---
const adminApiKeySecretArn = process.env.ADMIN_API_KEY_SECRET_ARN || 'arn:aws:secretsmanager:us-east-1:842517602170:secret:pagehub/adminApiKey-EQCtuJ';
const apiId = backend.data.resources.graphqlApi.apiId;
const region = Stack.of(backend.data).region;
const accountId = Stack.of(backend.data).account;
const appsyncApiArn = backend.data.resources.graphqlApi.arn;

// --- createSiteFunction Configuration ---
backend.createSiteFunction.addEnvironment('ADMIN_API_KEY_SECRET_ARN', adminApiKeySecretArn);
backend.createSiteFunction.addEnvironment('APPSYNC_API_ID', apiId);
backend.createSiteFunction.addEnvironment('AWS_REGION_FOR_APPSYNC', region);
backend.createSiteFunction.addEnvironment('LLM_FUNCTION_NAME', backend.llmHandlerFunction.resources.lambda.functionName);

// Add permission to read the Admin API Key Secret
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [adminApiKeySecretArn],
})
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
    resources: [appsyncApiArn + '/*'], // Broad access for now
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

// --- tokenGeneratorFunction Configuration ---
backend.tokenGeneratorFunction.addEnvironment('ADMIN_API_KEY_SECRET_ARN', adminApiKeySecretArn);
backend.tokenGeneratorFunction.addEnvironment('APPSYNC_API_ID', apiId);
backend.tokenGeneratorFunction.addEnvironment('AWS_REGION_FOR_APPSYNC', region);

backend.tokenGeneratorFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [adminApiKeySecretArn],
})
);
backend.tokenGeneratorFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    // Grant permission specifically for the createAccessToken mutation
    resources: [appsyncApiArn + '/types/Mutation/fields/createAccessToken'],
})
);

// --- tokenAuthorizerFunction Configuration ---
backend.tokenAuthorizerFunction.addEnvironment('APPSYNC_API_ID', apiId);
backend.tokenAuthorizerFunction.addEnvironment('AWS_REGION_FOR_APPSYNC', region);
backend.tokenAuthorizerFunction.addEnvironment('AWS_ACCOUNT_ID', accountId);

backend.tokenAuthorizerFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    // Grant permission specifically for the getAccessToken query
    resources: [appsyncApiArn + '/types/Query/fields/getAccessToken'],
})
);

// --- llmHandlerFunction Permissions and Environment (Placeholder) ---
// TODO: Grant permissions for Anthropic API access (e.g., Secrets Manager)
// TODO: Add environment variables (e.g., API Key Secret ARN)
