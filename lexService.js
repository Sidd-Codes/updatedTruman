// lexService.js
const AWS = require('aws-sdk');

// Configure AWS SDK with your credentials and region
AWS.config.update({
    region: 'us-east-1',  // Update this to your desired region
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,  // Use environment variables for security
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lexruntime = new AWS.LexRuntime();

function sendMessageToLex(userId, message) {
    const params = {
        botAlias: 'YourBotAlias',  // Replace with your Lex bot alias
        botName: 'YourBotName',    // Replace with your Lex bot name
        inputText: message,
        userId: userId,
        sessionAttributes: {}
    };

    return new Promise((resolve, reject) => {
        lexruntime.postText(params, (err, data) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

module.exports = {
    sendMessageToLex
};
