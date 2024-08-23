const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

console.log(color_start, 'Started populate.js script...');

const async = require('async');
const Actor = require('./models/Actor.js');
const Script = require('./models/Script.js');
const Notification = require('./models/Notification.js');
const _ = require('lodash');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const CSVToJSON = require("csvtojson");
const { Configuration, OpenAIApi } = require('openai');

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

const OpenAI = require('openai');

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

/*
This is a huge function of chained promises, done to achieve serial completion of asynchronous actions.
There's probably a better way to do this, but this worked.
*/
const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

console.log(color_start, 'Started populate.js script...');

const async = require('async');
const Actor = require('./models/Actor.js');
const Script = require('./models/Script.js');
const Notification = require('./models/Notification.js');
const _ = require('lodash');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const CSVToJSON = require("csvtojson");
const { Configuration, OpenAIApi } = require('openai');

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

const OpenAI = require('openai');

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

async function doPopulate() {
    /****
    Dropping collections
    ****/
    let promise = new Promise((resolve, reject) => { // Drop the actors collection
        console.log(color_start, "Dropping actors...");
        db.collections['actors'].drop(function(err) {
            if (err) return reject(err);
            console.log(color_success, 'Actors collection dropped');
            resolve("done");
        });
    }).then(() => { // Drop the scripts collection
        return new Promise((resolve, reject) => {
            console.log(color_start, "Dropping scripts...");
            db.collections['scripts'].drop(function(err) {
                if (err) return reject(err);
                console.log(color_success, 'Scripts collection dropped');
                resolve("done");
            });
        });
    }).then(() => { // Drop the notifications collection
        return new Promise((resolve, reject) => {
            console.log(color_start, "Dropping notifications...");
            db.collections['notifications'].drop(function(err) {
                if (err) return reject(err);
                console.log(color_success, 'Notifications collection dropped');
                resolve("done");
            });
        });
    }).then(() => { // Convert the actors csv file to json, store in actors_list
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading actors list...");
            CSVToJSON().fromFile(actor_inputFile).then((json_array) => {
                actors_list = json_array;
                console.log(color_success, "Finished getting the actors_list");
                resolve("done");
            }).catch(reject);
        });
    }).then(() => { // Convert the posts csv file to json, store in posts_list
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading posts list...");
            CSVToJSON().fromFile(posts_inputFile).then((json_array) => {
                posts_list = json_array;
                console.log(color_success, "Finished getting the posts list");
                resolve("done");
            }).catch(reject);
        });
    }).then(() => { // Convert the comments csv file to json, store in comment_list
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading comment list...");
            CSVToJSON().fromFile(replies_inputFile).then((json_array) => {
                comment_list = json_array;
                console.log(color_success, "Finished getting the comment list");
                resolve("done");
            }).catch(reject);
        });
    }).then(() => { // Convert the notifications csv file to json, store in notification_list
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading notification list...");
            CSVToJSON().fromFile(notifications_inputFile).then((json_array) => {
                notification_list = json_array;
                console.log(color_success, "Finished getting the notification list");
                resolve("done");
            }).catch(reject);
        });
    }).then(() => { // Convert the notification reply csv file to json, store in notification_reply_list
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading notification reply list...");
            CSVToJSON().fromFile(notifications_replies_inputFile).then((json_array) => {
                notification_reply_list = json_array;
                console.log(color_success, "Finished getting the notification reply list");
                resolve("done");
            }).catch(reject);
        });
    }).then(() => {
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
            try {
                await actor.save();
            } catch (err) {
                console.log(color_error, "ERROR: Something went wrong with saving actor in database");
                throw err; // Propagate error to catch block
            }
        }
        console.log(color_success, "All actors added to database!");
    }).then(() => {
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
                try {
                    await script.save();
                } catch (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving post in database");
                    throw err; // Propagate error to catch block
                }
            } else {
                console.log(color_error, "ERROR: Actor not found in database");
            }
        }
        console.log(color_success, "All posts added to database!");
    }).then(() => {
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
                try {
                    await script.save();
                } catch (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving reply in database");
                    throw err; // Propagate error to catch block
                }
            } else {
                console.log(color_error, "ERROR: Actor not found in database");
            }
        }
        console.log(color_success, "All replies added to database!");
    }).then(() => {
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

                try {
                    await notification.save();
                } catch (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving notification in database");
                    throw err; // Propagate error to catch block
                }
            } else {
                console.log(color_error, "ERROR: Actor or post not found in database");
            }
        }
        console.log(color_success, "All notifications added to database!");
    }).then(() => {
        console.log(color_success, "Successfully populated database.");
        process.exit(0);
    }).catch((err) => {
        console.error(color_error, "An error occurred:", err);
        process.exit(1);
    });
}

doPopulate();

console.log(color_start, 'Finished populate.js script...');
