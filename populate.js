const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

console.log(color_start, 'Started populate.js script...');

const async = require('async');
const Actor = require('./models/Actor.js');
const Script = require('./models/Script.js');
const Notification = require('./models/Notification.js');
const Reply = require('./models/Reply.js');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const CSVToJSON = require("csvtojson");
const OpenAI = require('openai');


// Input Files
const actor_inputFile = './input/actors.csv';
const posts_inputFile = './input/posts.csv';
const replies_inputFile = './input/replies.csv';
const notifications_inputFile = './input/notifications (read, like).csv';
const notifications_replies_inputFile = './input/notifications (reply).csv';

// Variables to be used later
var actors_list;
var posts_list;
var comment_list;
var notification_list;
var notification_reply_list;

dotenv.config({ path: '.env' });

const OpenAIApi = require('openai');

// Initialize the OpenAI client with a different name
const openaiClient = new OpenAIApi({
    apiKey: process.env.OPENAI_API_KEY
});


async function generateComment(postContent) {
    try {
        const completion = await openaiClient.chat.completions.create({
            messages: [{ role: 'user', content: postContent }],
            model: 'gpt-3.5-turbo',
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error generating comment:', error);
        throw error; // Re-throw the error to be caught in the calling function
    }
}




mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
mongoose.connection.on('error', (err) => {
    console.error(err);
    console.log(color_error, '%s MongoDB connection error. Please make sure MongoDB is running.');
    process.exit(1);
});

// Function to generate random likes
function getLikes() {
    var notRandomNumbers = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6];
    var idx = Math.floor(Math.random() * notRandomNumbers.length);
    return notRandomNumbers[idx];
}

//Create a radom number (for likes) with a weighted distrubution
//This is for comments
function getLikesComment() {
    var notRandomNumbers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4];
    var idx = Math.floor(Math.random() * notRandomNumbers.length);
    return notRandomNumbers[idx];
}

function timeStringToNum(v) {
    var timeParts = v.split(":");
    if (timeParts[0] == "-0")
    // -0:XX
        return -1 * parseInt(((timeParts[0] * (60000 * 60)) + (timeParts[1] * 60000)), 10);
    else if (timeParts[0].startsWith('-'))
    //-X:XX
        return parseInt(((timeParts[0] * (60000 * 60)) + (-1 * (timeParts[1] * 60000))), 10);
    else
        return parseInt(((timeParts[0] * (60000 * 60)) + (timeParts[1] * 60000)), 10);
};

async function doPopulate() {
    try {
        // Dropping collections
        console.log(color_start, "Dropping actors...");
        await db.collections['actors'].drop();
        console.log(color_success, 'Actors collection dropped');
        
        console.log(color_start, "Dropping scripts...");
        await db.collections['scripts'].drop();
        console.log(color_success, 'Scripts collection dropped');
        
        console.log(color_start, "Dropping notifications...");
        await db.collections['notifications'].drop();
        console.log(color_success, 'Notifications collection dropped');
        
        // Convert CSV to JSON
        console.log(color_start, "Reading actors list...");
        actors_list = await CSVToJSON().fromFile(actor_inputFile);
        console.log(color_success, "Finished getting the actors_list");
        
        console.log(color_start, "Reading posts list...");
        posts_list = await CSVToJSON().fromFile(posts_inputFile);
        console.log(color_success, "Finished getting the posts list");
        
        console.log(color_start, "Reading comment list...");
        comment_list = await CSVToJSON().fromFile(replies_inputFile);
        console.log(color_success, "Finished getting the comment list");
        
        console.log(color_start, "Reading notification list...");
        notification_list = await CSVToJSON().fromFile(notifications_inputFile);
        console.log(color_success, "Finished getting the notification list");
        
        console.log(color_start, "Reading notification reply list...");
        notification_reply_list = await CSVToJSON().fromFile(notifications_replies_inputFile);
        console.log(color_success, "Finished getting the notification reply list");
        
        // Populate actors
        console.log(color_start, "Starting to populate actors collection...");
        for (const actor_raw of actors_list) {
            const actordetail = {
                username: actor_raw.username,
                profile: {
                    name: actor_raw.name,
                    gender: actor_raw.gender,
                    age: actor_raw.age,
                    location: actor_raw.location,
                    bio: actor_raw.bio,
                    picture: actor_raw.picture
                },
                class: actor_raw.class
            };

            const actor = new Actor(actordetail);
            await actor.save();
        }
        console.log(color_success, "All actors added to database!");

        // Populate posts
        console.log(color_start, "Starting to populate posts collection...");
        for (const new_post of posts_list) {
            const act = await Actor.findOne({ username: new_post.actor }).exec();
            if (act) {
                const postdetail = {
                    postID: new_post.id,
                    body: new_post.body,
                    picture: new_post.picture,
                    likes: getLikes(),
                    actor: act,
                    time: timeStringToNum(new_post.time) || null,
                    class: new_post.class
                };
        
                const script = new Script(postdetail);
                await script.save();
            } else {
                console.log(color_error, "ERROR: Actor not found in database");
            }
        }
        console.log(color_success, "All posts added to database!");
        
        // Populate post replies (assuming you have a Reply model)
        console.log(color_start, "Starting to populate post replies...");
        for (const post of posts_list) {
            const act = await Actor.findOne({ username: post.actor }).exec();
            if (act) {
                // Generate a comment using GPT
                const generatedComment = await generateComment(post.body);
                const replyDetail = {
                    postID: post.id,
                    body: generatedComment,
                    likes: getLikesComment(),
                    actor: act,
                    time: timeStringToNum(post.time) || null,
                    class: post.class
                };
                const reply = new Reply(replyDetail);  // Use a Reply model instead of Script
                await reply.save();
            } else {
                console.log(color_error, "ERROR: Actor not found in database");
            }
        }
        console.log(color_success, "All replies added to database!");

        // Populate notifications
        console.log(color_start, "Starting to populate notifications collection...");
        for (const new_notification of notification_list) {
            const act = await Actor.findOne({ username: new_notification.actor }).exec();
            const post = await Script.findOne({ postID: new_notification.postID }).exec();
            if (act && post) {
                const notification = new Notification({
                    notificationType: new_notification.type,
                    post: post,
                    actor: act,
                    timestamp: timeStringToNum(new_notification.time)
                });

                await notification.save();
            } else {
                console.log(color_error, "ERROR: Actor or post not found in database");
            }
        }
        console.log(color_success, "All notifications added to database!");
        
        console.log(color_success, "Successfully populated database.");
    } catch (err) {
        console.error(color_error, "An error occurred:", err);
    } finally {
        process.exit(0);
    }
}

doPopulate();

console.log(color_start, 'Finished populate.js script...');
