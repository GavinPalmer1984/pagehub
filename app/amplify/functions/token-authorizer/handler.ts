import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult } from 'aws-lambda';

// Environment variables - expected to be set
const appsyncApiId = process.env.APPSYNC_API_ID;
const appsyncRegion = process.env.AWS_REGION_FOR_APPSYNC;
const awsAccountId = process.env.AWS_ACCOUNT_ID; // Needed for policy ARN

// Placeholder for AppSync client call function (similar to token-generator)
async function callAppSync(query: string, variables: any): Promise<any> {
    console.warn('callAppSync function is a placeholder!');
    console.log(`AppSync Call: Query=${query.substring(0,100)}..., Vars=${JSON.stringify(variables)}`);
    // TODO: Implement actual AppSync call using fetch/SigV4 or client SDK
    // Construct endpoint: `https://${appsyncApiId}.appsync-api.${appsyncRegion}.amazonaws.com/graphql`

    // Simulate finding a token for now if token is 'valid-token'
    if (variables.token === 'valid-token') {
        return {
            data: {
                getAccessToken: {
                    token: variables.token,
                    siteId: 'mock-site-id',
                    expiresAt: Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
                }
            }
        };
    }
    return { data: { getAccessToken: null } }; // Simulate token not found
}

export const handler = async (
    event: AppSyncAuthorizerEvent
): Promise<AppSyncAuthorizerResult> => {
    console.log(`Authorizer Event: ${JSON.stringify(event)}`);

    const { authorizationToken } = event;

    if (!authorizationToken) {
        console.log('No authorization token provided.');
        return { isAuthorized: false };
    }

    if (!appsyncApiId || !appsyncRegion || !awsAccountId) {
        console.error('Missing required environment variables for authorizer.');
        // Fail closed - don't authorize if config is missing
        return { isAuthorized: false };
    }

    const apiArn = `arn:aws:appsync:${appsyncRegion}:${awsAccountId}:apis/${appsyncApiId}`;

    try {
        // Query the AccessToken table using the provided token
        const query = /* GraphQL */ `
            query GetAccessToken($token: String!) {
                getAccessToken(token: $token) {
                    token
                    siteId
                    expiresAt
                }
            }
        `;
        const variables = { token: authorizationToken };
        const response = await callAppSync(query, variables);
        const accessToken = response.data?.getAccessToken;

        if (!accessToken) {
            console.log(`Token not found: ${authorizationToken}`);
            return { isAuthorized: false };
        }

        // Check expiry
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (accessToken.expiresAt <= nowSeconds) {
            console.log(`Token expired: ${authorizationToken}`);
            return { isAuthorized: false };
        }

        // Token is valid!
        console.log(`Token validated for siteId: ${accessToken.siteId}`);

        // Return a simple authorized result
        // We remove resolverContext for now to resolve linting issues
        return {
            isAuthorized: true,
            // resolverContext: {
            //     siteId: accessToken.siteId,
            //     token: accessToken.token
            // },
        };

    } catch (error) {
        console.error('Error during token validation:', error);
        return { isAuthorized: false };
    }
}; 