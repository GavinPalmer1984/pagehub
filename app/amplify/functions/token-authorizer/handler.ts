import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// Environment variables - expected to be set
const region = process.env.AWS_REGION || 'us-east-1';
const accessTokenTableName = process.env.ACCESS_TOKEN_TABLE_NAME;

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (
    event: AppSyncAuthorizerEvent
): Promise<AppSyncAuthorizerResult> => {
    console.log(`Authorizer Event: ${JSON.stringify(event)}`);

    const { authorizationToken } = event;

    if (!authorizationToken) {
        console.log('No authorization token provided.');
        return { isAuthorized: false };
    }

    if (!accessTokenTableName) {
        console.error('Missing required environment variable: ACCESS_TOKEN_TABLE_NAME.');
        return { isAuthorized: false }; // Fail closed
    }

    try {
        // Get the token item from DynamoDB
        const command = new GetCommand({
            TableName: accessTokenTableName,
            Key: {
                token: authorizationToken // Assuming 'token' is the partition key
            }
        });
        const response = await docClient.send(command);
        const accessToken = response.Item;

        if (!accessToken) {
            console.log(`Token not found in DynamoDB: ${authorizationToken}`);
            return { isAuthorized: false };
        }

        // Check expiry
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (accessToken.expiresAt <= nowSeconds) {
            console.log(`Token expired: ${authorizationToken}`);
            // TODO: Optionally delete expired token from DB?
            return { isAuthorized: false };
        }

        // Token is valid!
        console.log(`Token validated for siteId: ${accessToken.siteId}`);

        // Return authorized result
        return {
            isAuthorized: true,
            // Remove resolverContext for now
        };

    } catch (error) {
        console.error('Error during token validation (DynamoDB):', error);
        return { isAuthorized: false };
    }
}; 