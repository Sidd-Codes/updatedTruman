const AWS = require('aws-sdk');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lexRuntime = new AWS.LexRuntime();

exports.getLexBotResponse = async (intentName, slots = {}) => {
    const params = {
        botAlias: process.env.LEX_BOT_ALIAS,
        botName: process.env.LEX_BOT_NAME,
        userId: 'LexBotActor',
        inputText: intentName,
        sessionAttributes: {
            ...slots
        }
    };

    try {
        const data = await lexRuntime.postText(params).promise();
        return data.message;
    } catch (error) {
        console.error('Error communicating with Lex:', error);
        return 'An error occurred while generating content.';
    }
};
