import { S3Client, CreateBucketCommand, PutBucketWebsiteCommand, PutBucketPolicyCommand, PutBucketVersioningCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';

// Input event for direct Lambda invocation
interface CreateSiteEvent {
  siteName: string;
  adminApiKey: string;
}

// Define the expected return type
interface CreateSiteResult {
  siteId: string;
  name: string;
  s3BucketName: string;
  creationDate: string;
  message: string;
}

// TODO: Get region and LLM function name from environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const llmFunctionName = process.env.LLM_FUNCTION_NAME || 'pagehub-llm-handler';
const adminApiKeySecretArn = process.env.ADMIN_API_KEY_SECRET_ARN;
const siteTableName = process.env.SITE_TABLE_NAME;

const s3 = new S3Client({ region });
const lambda = new LambdaClient({ region });
const secretsManager = new SecretsManagerClient({ region });
const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Helper function to validate the Admin API Key
const validateAdminApiKey = async (providedApiKey: string | undefined): Promise<void> => {
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

        // Basic check: Does the stored key exist and match the provided key?
        if (!storedApiKey || providedApiKey !== storedApiKey) {
            console.warn('Invalid Admin API Key provided.');
            throw new Error('Unauthorized: Invalid Admin API Key.');
        }
        console.log('Admin API Key validated.');
    } catch (error) {
        console.error('Error validating Admin API Key:', error);
        // Rethrow specific error types if needed, otherwise generic unauthorized
        if (error instanceof Error && error.message.includes('Invalid Admin API Key')) {
            throw error;
        }
        throw new Error('Unauthorized: Could not validate Admin API Key.');
    }
};

export const handler = async (event: CreateSiteEvent): Promise<CreateSiteResult> => {
    console.log(`Event: ${JSON.stringify(event)}`);

    const { siteName, adminApiKey } = event;

    // --- Authorization Check ---
    await validateAdminApiKey(adminApiKey);
    // --- End Authorization Check ---

    // --- Input Validation ---
    if (!siteName) {
        throw new Error('Missing required input: siteName');
    }
    if (!siteTableName) {
        throw new Error('Server configuration error: SITE_TABLE_NAME not set.');
    }
    // Basic name validation (e.g., prevent excessively long names or specific characters)
    if (siteName.length > 100 || !/^[a-zA-Z0-9\s\-_]+$/.test(siteName)) {
      throw new Error('Invalid siteName. Use letters, numbers, spaces, hyphens, underscores (max 100 chars).');
    }

    // --- Generate Unique Resources ---
    const siteId = randomUUID();
    // Generate a globally unique bucket name incorporating the site ID
    const s3BucketName = `pagehub-site-${siteId.substring(0, 8)}-${Date.now()}`.toLowerCase();
    const creationDate = new Date();
    const creationDateISO = creationDate.toISOString();

    console.log(`Attempting to create site: ID=${siteId}, Name=${siteName}, Bucket=${s3BucketName}`);

    try {
        // --- Create S3 Bucket ---
        console.log(`Creating S3 bucket: ${s3BucketName}`);
        await s3.send(new CreateBucketCommand({ Bucket: s3BucketName }));

        // --- Configure Bucket for Static Hosting ---
        console.log(`Configuring bucket website hosting...`);
        await s3.send(new PutBucketWebsiteCommand({
            Bucket: s3BucketName,
            WebsiteConfiguration: {
                IndexDocument: { Suffix: 'index.html' },
                ErrorDocument: { Key: 'error.html' }, // Optional error page
            },
        }));

        // --- Enable Versioning ---
        console.log(`Enabling bucket versioning...`);
        await s3.send(new PutBucketVersioningCommand({
            Bucket: s3BucketName,
            VersioningConfiguration: { Status: 'Enabled' },
        }));

        // --- Set Public Read Policy ---
        // WARNING: This makes the entire bucket public. Use CloudFront later for better control.
        console.log(`Setting public read policy...`);
        const publicPolicy = {
            Version: "2012-10-17",
            Statement: [{
                Sid: "PublicReadGetObject",
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${s3BucketName}/*`
            }]
        };
        await s3.send(new PutBucketPolicyCommand({
            Bucket: s3BucketName,
            Policy: JSON.stringify(publicPolicy),
        }));

        // --- Create Initial index.html (with bouncing ball placeholder) ---
        console.log(`Creating initial index.html...`);

        // Define the JavaScript separately
        const scriptContent = `
            const ball = document.getElementById('ball');
            const colors = ['#ff6347', '#ffa500', '#ffd700', '#90ee90', '#add8e6', '#8a2be2', '#ff69b4'];
            let x_pos = Math.random() * (window.innerWidth - 50); // Renamed variable
            let y_pos = Math.random() * (window.innerHeight - 50); // Renamed variable
            let vx = (Math.random() - 0.5) * 10;
            let vy = (Math.random() - 0.5) * 10;
            let colorIndex = 0;

            function animate() {
                x_pos += vx; y_pos += vy;
                if (x_pos <= 0 || x_pos >= window.innerWidth - 50) { vx *= -1; changeColor(); }
                if (y_pos <= 0 || y_pos >= window.innerHeight - 50) { vy *= -1; changeColor(); }
                x_pos = Math.max(0, Math.min(x_pos, window.innerWidth - 50));
                y_pos = Math.max(0, Math.min(y_pos, window.innerHeight - 50));
                ball.style.transform = 'translate(' + x_pos + 'px, ' + y_pos + 'px)'; // Use concatenation
                requestAnimationFrame(animate);
            }

            function changeColor() {
                colorIndex = (colorIndex + 1) % colors.length;
                ball.style.backgroundColor = colors[colorIndex];
            }

            ball.style.transform = 'translate(' + x_pos + 'px, ' + y_pos + 'px)'; // Use concatenation
            ball.style.backgroundColor = colors[colorIndex];
            animate();
        `;

        // Construct the HTML using the separate script content
        const initialContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteName}</title>
    <style>
        body { background-color: #1a1a1a; color: #e0e0e0; font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; margin: 0; overflow: hidden; }
        .container { text-align: center; z-index: 10; }
        h1 { font-size: 2.5em; margin-bottom: 20px; }
        #ball { position: absolute; width: 50px; height: 50px; border-radius: 50%; background-color: red; will-change: transform; }
        footer { position: absolute; bottom: 10px; font-size: 0.8em; color: #555; }
    </style>
</head>
<body>
    <div class="container"><h1 >Work In Progress</h1><p>Site: ${siteName} (ID: ${siteId})</p></div><div id="ball"></div >
    <footer>Created by PageHub - ${creationDateISO}</footer>
    <script>
${scriptContent}
    </script>
</body>
</html>`;

        const putObjectCommand = new PutObjectCommand({
            Bucket: s3BucketName,
            Key: 'index.html',
            Body: initialContent,
            ContentType: 'text/html',
        });
        const putObjectResult = await s3.send(putObjectCommand);
        const initialS3VersionId = putObjectResult.VersionId || 'unknown';
        console.log(`Initial index.html uploaded. VersionId: ${initialS3VersionId}`);

        // --- Create Site Record in DynamoDB ---
        console.log(`Creating Site record in DynamoDB table: ${siteTableName}`);
        const siteItem = {
            id: siteId,
            name: siteName,
            s3BucketName: s3BucketName,
            creationDate: creationDateISO,
        };
        await docClient.send(new PutCommand({
            TableName: siteTableName,
            Item: siteItem,
        }));
        console.log(`DynamoDB Site record created for ID: ${siteId}`);

        // --- Return Success ---
        const result: CreateSiteResult = {
            siteId: siteId,
            name: siteName,
            s3BucketName: s3BucketName,
            creationDate: creationDateISO,
            message: `Site '${siteName}' created successfully. Bucket: ${s3BucketName}`,
        };
        console.log("Site creation process completed successfully.", result);
        return result;

    } catch (error) {
        console.error('Error during site creation process:', error);
        // Consider adding cleanup logic here (e.g., delete S3 bucket if partially created)
        // Re-throw a user-friendly error
        throw new Error(`Failed to create site '${siteName}': ${error instanceof Error ? error.message : String(error)}`);
    }
}; 