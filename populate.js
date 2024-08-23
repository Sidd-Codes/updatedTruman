const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

console.log(color_start, 'Started populate.js script...');

const async = require('async');
const Actor = require('./models/Actor.js');
const Script = require('./models/Script.js');
const Notification = require('./models/Notification.js');
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
mongoose.connection.on('error', (err) => {
    console.error(err);
    console.log(color_error, '%s MongoDB connection error. Please make sure MongoDB is running.');
    process.exit(1);
});

// Function to generate a comment using GPT
async function generateComment(postBody) {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003", // or any other GPT-3/4 model you are using
      prompt: `Generate a comment for the following post: ${postBody}`,
      max_tokens: 50, // Adjust the token count as needed
      temperature: 0.7, // Controls the creativity of the response
    });
    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Error generating comment:', error);
    return 'Sorry, I couldn\'t generate a comment.';
  }
}

// Function to generate random likes
function getLikes() {
  return Math.floor(Math.random() * 1001); // Random number of likes between 0 and 1000
}

function timeStringToNum(timeString) {
    // Example: Convert 'YYYY-MM-DD HH:MM:SS' to a Unix timestamp
    const date = new Date(timeString);
    return date.getTime(); // Returns the timestamp in milliseconds
}


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

        // Populate post replies
        console.log(color_start, "Starting to populate post replies...");
        for (const post of posts_list) {
            const act = await Actor.findOne({ username: post.actor }).exec();
            if (act) {
                // Generate a comment using GPT
                const generatedComment = await generateComment(post.body);
                const postdetail = {
                    postID: post.id,
                    body: generatedComment,
                    actor: act,
                    time: timeStringToNum(post.time) || null,
                    class: post.class
                };
                const script = new Script(postdetail);
                await script.save();
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
