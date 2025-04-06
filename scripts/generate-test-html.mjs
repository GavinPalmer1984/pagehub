import fs from 'fs';
import path from 'path';
// Import the specific function from the handler module
import { generateInitialHtml } from '../app/amplify/functions/create-site/handler.js'; // Note the .js extension for ESM import

// Define output path
const outputHtmlPath = path.resolve('bouncing-ball-test.html');

console.log("Generating test HTML file...");

// Define test data
const siteName = 'Local Test Site';
const siteId = 'local-test-id-123';
const creationDateISO = new Date().toISOString();

// Call the imported function to generate HTML
const finalHtml = generateInitialHtml(siteName, siteId, creationDateISO);

// Write the final HTML to the output file
try {
    fs.writeFileSync(outputHtmlPath, finalHtml, 'utf8');
    console.log(`Successfully generated test HTML file: ${outputHtmlPath}`);
    console.log("You can now open this file in your browser.");
} catch (error) {
    console.error(`Error writing HTML file: ${error.message}`);
    process.exit(1);
} 