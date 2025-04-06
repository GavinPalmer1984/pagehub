import type { AppSyncAuthorizerEvent, AppSyncAuthorizerResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as jwt from 'jsonwebtoken';

// Environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const jwtSecretArn = process.env.JWT_SECRET_ARN; // ARN for the JWT signing secret

const secretsClient = new SecretsManagerClient({ region });

// Function to fetch secret value (cached)
let cachedJwtSecret: string | null = null;
async function getJwtSecret(): Promise<string> {
    if (cachedJwtSecret) {
        return cachedJwtSecret;
    }
    if (!jwtSecretArn) {
        throw new Error('JWT_SECRET_ARN environment variable is not set.');
    }
    try {
        const command = new GetSecretValueCommand({ SecretId: jwtSecretArn });
        const data = await secretsClient.send(command);
        if (data.SecretString) {
            cachedJwtSecret = data.SecretString;
            return cachedJwtSecret;
        } else if (data.SecretBinary) {
            cachedJwtSecret = Buffer.from(data.SecretBinary).toString('utf8');
            return cachedJwtSecret;
        }
        throw new Error('JWT Secret value not found in Secrets Manager response.');
    } catch (error) {
        console.error("Failed to fetch JWT secret:", error);
        throw new Error("Internal server error: Could not retrieve signing key.");
    }
}

// Define structure of expected JWT payload (adjust if generator changes)
interface JwtPayload {
    siteId: string;
    iat: number; // Issued At timestamp
    exp: number; // Expiration timestamp
    jti: string; // JWT ID
}

// Define the structure for the context passed to resolvers
interface ResolverContext {
    siteId: string;
    jwtId: string;
}

export const handler = async (
    event: AppSyncAuthorizerEvent
): Promise<AppSyncAuthorizerResult<ResolverContext>> => {
    console.log(`Authorizer Event: ${JSON.stringify(event)}`);

    const { authorizationToken } = event;

    if (!authorizationToken) {
        console.log('No authorization token (JWT) provided.');
        return { isAuthorized: false };
    }

    if (!jwtSecretArn) {
        console.error('Server configuration error: JWT_SECRET_ARN not set.');
        return { isAuthorized: false }; // Fail closed
    }

    try {
        // Get the secret key
        const jwtSecret = await getJwtSecret();

        // Verify the JWT
        // jwt.verify throws error if invalid (expired, wrong signature, etc.)
        const decodedPayload = jwt.verify(authorizationToken, jwtSecret) as JwtPayload;

        // Optional: Perform additional checks on the payload if needed
        if (!decodedPayload.siteId) {
            console.error('JWT verification succeeded, but siteId is missing in payload.');
            return { isAuthorized: false };
        }

        // Token is valid!
        console.log(`JWT validated for siteId: ${decodedPayload.siteId}, jwtId: ${decodedPayload.jti}`);

        // Return authorized result
        // Can pass context if needed by resolvers ($ctx.identity.resolverContext)
        return {
            isAuthorized: true,
            resolverContext: {
                // Pass siteId extracted from the token to resolvers
                siteId: decodedPayload.siteId,
                // Pass other claims if useful
                jwtId: decodedPayload.jti,
            },
        };

    } catch (error) {
        // Handle JWT verification errors (JsonWebTokenError, TokenExpiredError, etc.)
        if (error instanceof jwt.TokenExpiredError) {
            console.log('Authorization failed: Token expired.', error.message);
        } else if (error instanceof jwt.JsonWebTokenError) {
            console.log('Authorization failed: Invalid token or signature.', error.message);
        } else {
            // Handle errors fetching secret or other unexpected errors
            console.error('Error during JWT validation:', error);
        }
        return { isAuthorized: false };
    }
}; 