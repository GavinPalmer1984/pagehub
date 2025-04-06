import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { randomUUID } from 'crypto'; // Use built-in crypto for UUID

// Input event for direct Lambda invocation
interface TokenGeneratorEvent {
  siteId: string;
  apiKey: string; // Admin API Key
}

// Define the expected return type
interface TokenGeneratorResult {
  siteId: string;
  token: string; // The generated access token
  expiresAt: number; // Expiry timestamp (Unix seconds)
}

// Environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const adminApiKeySecretArn = process.env.ADMIN_API_KEY_SECRET_ARN;
const appsyncApiId = process.env.APPSYNC_API_ID;
const appsyncRegion = process.env.AWS_REGION_FOR_APPSYNC || region;

const secretsManager = new SecretsManagerClient({ region });

// --- Reusable Admin API Key Validation --- (Copied from create-site handler)
const validateAdminApiKey = async (providedApiKey: string): Promise<void> => {
    if (!adminApiKeySecretArn) {
        console.error('Admin API Key Secret ARN not configured.');
        throw new Error('Configuration error [Admin API Key].');
    }
    if (!providedApiKey) {
        throw new Error('Admin API Key not provided.');
    }
    try {
        const command = new GetSecretValueCommand({ SecretId: adminApiKeySecretArn });
        const data = await secretsManager.send(command);
        const storedApiKey = data.SecretString;
        if (!storedApiKey || providedApiKey !== storedApiKey) {
            console.warn('Invalid Admin API Key provided.');
            throw new Error('Unauthorized');
        }
        console.log('Admin API Key validated.');
    } catch (error) {
        console.error('Error validating Admin API Key:', error);
        throw new Error('Unauthorized');
    }
};
// --- End API Key Validation ---

export const handler = async (
  event: TokenGeneratorEvent
): Promise<TokenGeneratorResult> => {
  console.log(`Event: ${JSON.stringify(event)}`);

  const { siteId, apiKey } = event;

  // --- Authorization Check ---
  await validateAdminApiKey(apiKey);
  // --- End Authorization Check ---

  if (!siteId) {
    throw new Error('Missing required input: siteId');
  }
  if (!appsyncApiId) {
    throw new Error('Missing configuration: AppSync API ID');
  }

  // Generate token details
  const token = randomUUID();
  const validitySeconds = 48 * 60 * 60; // 48 hours
  const expiresAt = Math.floor(Date.now() / 1000) + validitySeconds;

  console.log(`Generated token for site ${siteId}, expires at ${new Date(expiresAt * 1000).toISOString()}`);

  // Call AppSync to create the AccessToken record
  const mutation = /* GraphQL */ `
    mutation CreateAccessToken($input: CreateAccessTokenInput!) {
        createAccessToken(input: $input) {
            token
            siteId
            expiresAt
        }
    }
  `;
  const variables = {
    input: {
      token: token,
      siteId: siteId,
      expiresAt: expiresAt,
    },
  };

  try {
    await callAppSync(mutation, variables); // Using placeholder
    console.log(`AccessToken record created for token ${token}`);

    return {
      siteId,
      token,
      expiresAt,
    };
  } catch (error) {
    console.error('Failed to create AccessToken record:', error);
    // Don't return the token if storing it failed
    throw new Error('Failed to generate access link token.');
  }
};

// --- Placeholder for AppSync client call --- (Replace with actual implementation)
async function callAppSync(query: string, variables: any): Promise<any> {
    console.warn('callAppSync function is a placeholder!');
    console.log(`AppSync Call: Query=${query.substring(0,100)}..., Vars=${JSON.stringify(variables)}`);
    // TODO: Use fetch API with AWS SigV4 signing (e.g., using @aws-sdk/signature-v4)
    // or a dedicated AppSync client library configured for IAM auth.
    // Construct endpoint: `https://${appsyncApiId}.appsync-api.${appsyncRegion}.amazonaws.com/graphql`

    // Simulate success for now
    return { data: { createAccessToken: variables.input } };
}
// --- End AppSync Placeholder --- 