import { defineBackend } from '@aws-amplify/backend';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib'; // Import Stack to get region
// Auth resource is minimal for M1, not directly used here
// import { auth } from './auth/resource';
import { data } from './data/resource';
import { createSite as createSiteFunction } from './functions/create-site/resource';
import { llmHandlerFunction } from './functions/llm-handler/resource';
import { tokenGeneratorFunction } from './functions/token-generator/resource'; // Import token generator
import { tokenAuthorizerFunction } from './functions/token-authorizer/resource'; // Import real authorizer
import { dummyAuthorizerFunction } from './functions/dummy-authorizer/resource'; // Import dummy authorizer

/**
 * @see https://docs.amplify.aws/gen2/build-a-backend/
 */
const backend = defineBackend({
  // auth removed for M1
  data,
  createSiteFunction,
  llmHandlerFunction,
  tokenGeneratorFunction, // Add token generator
  tokenAuthorizerFunction, // Keep real one defined, but config commented out below
  dummyAuthorizerFunction, // Add dummy authorizer for Stage 1
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
const accessTokenTableName = backend.data.resources.tables.AccessToken.tableName;
const accessTokenTableArn = backend.data.resources.tables.AccessToken.tableArn;
const siteTableName = backend.data.resources.tables.Site.tableName; // Get Site table name
const siteTableArn = backend.data.resources.tables.Site.tableArn; // Get Site table ARN
// Use the ARN provided by the user, or an env variable if set
const jwtSecretArn = process.env.JWT_SECRET_ARN || 'arn:aws:secretsmanager:us-east-1:842517602170:secret:pagehub/jwtSigningKey-VqLJ5L';

// --- createSiteFunction Configuration ---
backend.createSiteFunction.addEnvironment('ADMIN_API_KEY_SECRET_ARN', adminApiKeySecretArn);
backend.createSiteFunction.addEnvironment('LLM_FUNCTION_NAME', backend.llmHandlerFunction.resources.lambda.functionName);
backend.createSiteFunction.addEnvironment('SITE_TABLE_NAME', siteTableName); // Add Site table name env var

// Grant access to Admin Key Secret
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
      // 's3:PutObjectAcl' // ACL might not be needed with bucket policy
    ],
    // Ensure resource ARN covers expected bucket names
    resources: ['arn:aws:s3:::pagehub-site-*', 'arn:aws:s3:::pagehub-site-*/*'],
})
);

// Grant DynamoDB PutItem permission for the Site table
backend.createSiteFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['dynamodb:PutItem'],
    resources: [siteTableArn], // Use the specific Site table ARN
})
);

// --- tokenGeneratorFunction Configuration ---
backend.tokenGeneratorFunction.addEnvironment('ADMIN_API_KEY_SECRET_ARN', adminApiKeySecretArn);
backend.tokenGeneratorFunction.addEnvironment('ACCESS_TOKEN_TABLE_NAME', accessTokenTableName);
backend.tokenGeneratorFunction.addEnvironment('JWT_SECRET_ARN', jwtSecretArn);
// Optionally add JWT_EXPIRY_SECONDS if you want to override the default in the handler
// backend.tokenGeneratorFunction.addEnvironment('JWT_EXPIRY_SECONDS', '86400'); // e.g., 24 hours

// Grant access to Admin Key Secret
backend.tokenGeneratorFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [adminApiKeySecretArn],
})
);
// Grant access to JWT Signing Key Secret
backend.tokenGeneratorFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [jwtSecretArn],
})
);
// Grant permission to write to the AccessToken table
backend.tokenGeneratorFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['dynamodb:PutItem'],
    resources: [accessTokenTableArn],
})
);

// --- tokenAuthorizerFunction Configuration ---
backend.tokenAuthorizerFunction.addEnvironment('JWT_SECRET_ARN', jwtSecretArn);

// Grant access to JWT Signing Key Secret
backend.tokenAuthorizerFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [jwtSecretArn],
})
);

// --- llmHandlerFunction Configuration (Placeholder) ---
// TODO: Grant permissions for Anthropic API access (e.g., Secrets Manager)
