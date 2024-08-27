const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

console.log(color_start, 'Started populate.js script...');

// Import necessary modules
const async = require('async');
const Actor = require('./models/Actor.js');
const Script = require('./models/Script.js');
const Notification = require('./models/Notification.js');
const _ = require('lodash');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const CSVToJSON = require("csvtojson");

// Input Files
const actor_inputFile = './input/actors.csv';
const posts_inputFile = './input/posts.csv';
const replies_inputFile = './input/replies.csv';
const notifications_inputFile = './input/notifications (read, like).csv';
const notifications_replies_inputFile = './input/notifications (reply).csv';

// Variables to be used later.
var actors_list;
var posts_list;
var comment_list;
var notification_list;
var notification_reply_list;

dotenv.config({ path: '.env' });

mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, { useNewUrlParser: true });
var db = mongoose.connection;
mongoose.connection.on('error', (err) => {
    console.error(err);
    console.log(color_error, '%s MongoDB connection error. Please make sure MongoDB is running.');
    process.exit(1);
});

async function doPopulate() {
    /****
    Dropping collections
    ****/
    let promise = new Promise((resolve, reject) => {
        console.log(color_start, "Dropping actors...");
        db.collections['actors'].drop(function(err) {
            console.log(color_success, 'Actors collection dropped');
            resolve("done");
        });
    }).then(function(result) {
        return new Promise((resolve, reject) => {
            console.log(color_start, "Dropping scripts...");
            db.collections['scripts'].drop(function(err) {
                console.log(color_success, 'Scripts collection dropped');
                resolve("done");
            });
        });
    }).then(function(result) {
        return new Promise((resolve, reject) => {
            console.log(color_start, "Dropping notifications...");
            db.collections['notifications'].drop(function(err) {
                console.log(color_success, 'Notifications collection dropped');
                resolve("done");
            });
        });
    }).then(function(result) {
        /****
        Converting CSV files to JSON
        ****/
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading actors list...");
            CSVToJSON().fromFile(actor_inputFile).then(function(json_array) {
                actors_list = json_array;
                console.log(color_success, "Finished getting the actors_list");
                resolve("done");
            });
        });
    }).then(function(result) {
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading posts list...");
            CSVToJSON().fromFile(posts_inputFile).then(function(json_array) {
                posts_list = json_array;
                console.log(color_success, "Finished getting the posts list");
                resolve("done");
            });
        });
    }).then(function(result) {
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading comment list...");
            CSVToJSON().fromFile(replies_inputFile).then(function(json_array) {
                comment_list = json_array;
                console.log(color_success, "Finished getting the comment list");
                resolve("done");
            });
        });
    }).then(function(result) {
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading notification list...");
            CSVToJSON().fromFile(notifications_inputFile).then(function(json_array) {
                notification_list = json_array;
                console.log(color_success, "Finished getting the notification list");
                resolve("done");
            });
        });
    }).then(function(result) {
        return new Promise((resolve, reject) => {
            console.log(color_start, "Reading notification reply list...");
            CSVToJSON().fromFile(notifications_replies_inputFile).then(function(json_array) {
                notification_reply_list = json_array;
                console.log(color_success, "Finished getting the notification reply list");
                resolve("done");
            });
        });
    }).then(function(result) {
        /****
        Populate Actors
        ****/
        console.log(color_start, "Starting to populate actors collection...");
        return new Promise((resolve, reject) => {
            async.each(actors_list, async function(actor_raw, callback) {
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
                    next(err);
                }
            }, function(err) {
                if (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving actors in database");
                    callback(err);
                }
                console.log(color_success, "All actors added to database!");
                resolve('Promise is resolved successfully.');
                return 'Loaded Actors';
            });
        });
    }).then(function(result) {
        /****
        Populate Posts
        ****/
        console.log(color_start, "Starting to populate posts collection...");
        return new Promise((resolve, reject) => {
            async.each(posts_list, async function(new_post, callback) {
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
                        next(err);
                    }
                } else {
                    console.log(color_error, "ERROR: Actor not found in database");
                    callback();
                }
            }, function(err) {
                if (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving posts in database");
                    callback(err);
                }
                console.log(color_success, "All posts added to database!");
                resolve('Promise is resolved successfully.');
                return 'Loaded Posts';
            });
        });
    }).then(function(result) {
        /****
        AI-Generated Replies for Each Post
        ****/
        console.log(color_start, "Starting to generate and populate post replies...");
        return new Promise((resolve, reject) => {
            async.each(posts_list, async function(post, callback) {
                const act = await Actor.findOne({ username: post.actor }).exec();
                if (act) {
                    // Generate a comment using GPT
                    const generatedComment = await generateComment(post.body);
                    const replyDetail = {
                        commentID: generateUniqueId(),
                        body: generatedComment,
                        likes: getLikesComment(),
                        actor: act,
                        time: timeStringToNum(post.time) || null,
                        class: post.class
                    };

                    // Add the AI-generated comment to the corresponding post
                    const pr = await Script.findOne({ postID: post.id }).exec();
                    if (pr) {
                        pr.comments.push(replyDetail);
                        pr.comments.sort((a, b) => a.time - b.time);

                        try {
                            await pr.save();
                        } catch (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving AI reply in database");
                            next(err);
                        }
                    } else {
                        console.log(color_error, "ERROR: Post not found in database");
                        callback();
                    }
                } else {
                    console.log(color_error, "ERROR: Actor not found in database");
                    callback();
                }
            }, function(err) {
                if (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving AI replies in database");
                    callback(err);
                }
                console.log(color_success, "All AI-generated replies added to database!");
                resolve('Promise is resolved successfully.');
                return 'Loaded Replies';
            });
        });
    }).then(function(result) {
        /****
        Populate Notifications and Other Related Data
        ****/
        // Continue with the rest of the population logic as in the original script
    });
}

// Call the function to start populating
doPopulate
