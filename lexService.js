const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Create Lex runtime service object
const lexRuntime = new AWS.LexRuntime();

// Function to send message to Lex
exports.sendMessageToLex = async (userId, message) => {
    const params = {
        botAlias: process.env.LEX_BOT_ALIAS,
        botName: process.env.LEX_BOT_NAME,
        inputText: message,
        userId: userId,
    };

    try {
        const data = await lexRuntime.postText(params).promise();
        return {
            message: data.message,
            intentName: data.intentName,
            slots: data.slots
        };
    } catch (error) {
        console.error('Error communicating with Lex:', error);
        throw error;
    }
};

// Function to get Lex bot response
exports.getLexBotResponse = async (userId, message) => {
    try {
        const lexResponse = await this.sendMessageToLex(userId, message);
        return lexResponse.message;
    } catch (error) {
        console.error('Error getting Lex bot response:', error);
        return 'Sorry, I encountered an error. Please try again later.';
    }
};
