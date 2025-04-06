import { S3Client, CreateBucketCommand, PutBucketWebsiteCommand, PutBucketPolicyCommand, PutBucketVersioningCommand, PutObjectCommand, PutPublicAccessBlockCommand } from '@aws-sdk/client-s3';
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

// --- NEW Exported Function for HTML Generation ---
export function generateInitialHtml(siteName: string, siteId: string, creationDateISO: string): string {
    // Define the JavaScript separately
    const scriptContent = `
        const numBalls = 3;
        const balls = [];
        const colors = ['#ff6347', '#ffa500', '#ffd700', '#90ee90', '#add8e6', '#8a2be2', '#ff69b4'];
        const ballSize = 50;
        const ballRadius = ballSize / 2;

        let mouseX = -100;
        let mouseY = -100;

        // --- Initialize Balls ---
        for (let i = 0; i < numBalls; i++) {
            const ballElement = document.getElementById(\`ball-\${i}\`);
            if (!ballElement) continue;

            const initialVx = (Math.random() - 0.5) * 10;
            const initialVy = (Math.random() - 0.5) * 10;

            balls.push({
                element: ballElement,
                x: Math.random() * (window.innerWidth - ballSize),
                y: Math.random() * (window.innerHeight - ballSize),
                vx: initialVx,
                vy: initialVy,
                colorIndex: i % colors.length,
                recentlyBouncedOffMouse: false
            });
            ballElement.style.backgroundColor = colors[balls[i].colorIndex];
            ballElement.style.transform = 'translate(' + balls[i].x + 'px, ' + balls[i].y + 'px)';
        }

        // --- Event Listener for Mouse Movement ---
        document.addEventListener('mousemove', (event) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
        });

        // --- Animation Loop ---
        function animate() {
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;

            balls.forEach((ball, index) => {
                // Update position
                ball.x += ball.vx;
                ball.y += ball.vy;

                // 1. Wall Boundary checks & corrections
                let bouncedWall = false;
                if (ball.x <= 0) { ball.x = 0; ball.vx *= -1; bouncedWall = true; }
                else if (ball.x >= winWidth - ballSize) { ball.x = winWidth - ballSize; ball.vx *= -1; bouncedWall = true; }

                if (ball.y <= 0) { ball.y = 0; ball.vy *= -1; bouncedWall = true; }
                else if (ball.y >= winHeight - ballSize) { ball.y = winHeight - ballSize; ball.vy *= -1; bouncedWall = true; }

                if (bouncedWall) {
                    changeBallColor(ball);
                    ball.recentlyBouncedOffMouse = false;
                }

                // 2. Mouse Collision Check
                const ballCenterX = ball.x + ballRadius;
                const ballCenterY = ball.y + ballRadius;
                const dx = ballCenterX - mouseX;
                const dy = ballCenterY - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ballRadius && !ball.recentlyBouncedOffMouse) {
                    ball.vx *= -1.1;
                    ball.vy *= -1.1;

                    const overlap = ballRadius - distance;
                    const pushX = (dx / distance) * overlap * 0.5;
                    const pushY = (dy / distance) * overlap * 0.5;
                    ball.x += pushX;
                    ball.y += pushY;

                    changeBallColor(ball);
                    ball.recentlyBouncedOffMouse = true;

                    ball.vx = Math.max(-15, Math.min(15, ball.vx)); // Reduced max speed due to halved base speed
                    ball.vy = Math.max(-15, Math.min(15, ball.vy)); // Reduced max speed
                } else if (distance >= ballRadius) {
                    ball.recentlyBouncedOffMouse = false;
                }

                // Update element position
                ball.element.style.transform = 'translate(' + ball.x + 'px, ' + ball.y + 'px)';
            }); // End forEach loop

            requestAnimationFrame(animate);
        }

        // --- Color Change Function (takes ball object) ---
        function changeBallColor(ball) {
            ball.colorIndex = (ball.colorIndex + 1) % colors.length;
            ball.element.style.backgroundColor = colors[ball.colorIndex];
        }

        animate(); // Start animation
    `;

    // Construct the HTML using the separate script content
    const initialContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteName}</title>
    <style>
        body { background-color: #1a1a1a; color: #e0e0e0; font-family: sans-serif; min-height: 100vh; margin: 0; overflow: hidden; }
        .container { text-align: center; z-index: 10; padding-top: 40vh; }
        h1 { font-size: 2.5em; margin-bottom: 20px; }
        /* Style for all balls using a class */
        .ball { position: absolute; width: 50px; height: 50px; border-radius: 50%; will-change: transform; top: 0; left: 0; }
        footer { position: absolute; bottom: 10px; width: 100%; text-align: center; font-size: 0.8em; color: #555; }
    </style>
</head>
<body>
    <div class="container"><h1 >Work In Progress</h1><p>Site: ${siteName} (ID: ${siteId})</p></div>

    <!-- Add divs for multiple balls -->
    <div id="ball-0" class="ball"></div>
    <div id="ball-1" class="ball"></div>
    <div id="ball-2" class="ball"></div>

    <footer>Created by PageHub - ${creationDateISO}</footer>
    <script>
${scriptContent}
    </script>
</body>
</html>`;

    return initialContent;
}

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

        // --- Explicitly Disable Public Access Block for this Bucket ---
        console.log(`Disabling Block Public Access for bucket: ${s3BucketName}`);
        await s3.send(new PutPublicAccessBlockCommand({
            Bucket: s3BucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,       // Allow public ACLs (might not be needed but safe to allow)
                IgnorePublicAcls: false,      // Don't ignore public ACLs
                BlockPublicPolicy: false,     // IMPORTANT: Allow public policies
                RestrictPublicBuckets: false  // Don't restrict access based on public policies
            }
        }));

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

        // --- Set Public Read Policy (Re-enabled) ---
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

        // --- Create Initial index.html --- 
        console.log(`Generating initial index.html...`);
        const initialContent = generateInitialHtml(siteName, siteId, creationDateISO);
        
        console.log(`Uploading initial index.html...`);
        const putObjectCommand = new PutObjectCommand({
            Bucket: s3BucketName,
            Key: 'index.html', 
            Body: initialContent,
            ContentType: 'text/html', 
        });
        const putObjectResult = await s3.send(putObjectCommand);
        const initialS3VersionId = putObjectResult.VersionId || 'unknown';
        // Use correct template literals for logging
        console.log(`Initial index.html uploaded. VersionId: ${initialS3VersionId}`);

        // --- Create Site Record in DynamoDB --- 
        // Use correct template literals for logging
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
        // Use correct template literals for logging
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
        // Use correct template literal for error message
        throw new Error(`Failed to create site '${siteName}': ${error instanceof Error ? error.message : String(error)}`);
    }
}; 