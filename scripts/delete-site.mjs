import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

// --- Configuration ---
const region = process.env.AWS_REGION || 'us-east-1';
// Set the actual deployed function name
const functionName = process.env.DELETE_SITE_FUNCTION_NAME || 'amplify-app-gavin-sandbox-pagehubdeletesitelambdaA-c5e8NTUAXn3u';
const adminApiKey = process.env.PAGEHUB_ADMIN_API_KEY;
// --- End Configuration ---

async function invokeDeleteSite(siteId) {
    if (!adminApiKey) {
        console.error("Error: PAGEHUB_ADMIN_API_KEY environment variable is not set.");
        process.exit(1);
    }
    if (!siteId) {
        console.error("Error: Please provide a site ID as a command-line argument.");
        console.log("Usage: node scripts/delete-site.mjs <site-id>");
        process.exit(1);
    }
    if (functionName.includes("...DELETE_SITE_FUNCTION_NAME...")) {
        console.error("Error: Please update the 'functionName' variable in scripts/delete-site.mjs with the actual deployed Lambda function name.");
        process.exit(1);
    }

    console.log(`Invoking ${functionName} to delete site: "${siteId}"...`);

    const lambdaClient = new LambdaClient({ region });

    const payload = {
        siteId: siteId,
        adminApiKey: adminApiKey,
    };

    const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
    });

    try {
        const response = await lambdaClient.send(command);
        console.log("Lambda invocation successful.");

        if (response.FunctionError) {
            console.error(`Lambda function returned an error: ${response.FunctionError}`);
            const errorPayload = JSON.parse(Buffer.from(response.Payload).toString());
            console.error("Error Payload:", JSON.stringify(errorPayload, null, 2));
            process.exit(1);
        } else {
            const result = JSON.parse(Buffer.from(response.Payload).toString());
            console.log("---- Site Deletion Result ----");
            console.log(JSON.stringify(result, null, 2));
            console.log("-----------------------------");
        }
    } catch (error) {
        console.error("Error invoking Lambda function:", error);
        process.exit(1);
    }
}

// --- Execution ---
const siteIdArg = process.argv[2]; // Get the first argument after script name
invokeDeleteSite(siteIdArg); 