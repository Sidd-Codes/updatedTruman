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
const OpenAI = require('openai');

// Set up OpenAI API
dotenv.config({ path: '.env' });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Generate a reply using GPT
const generateReplyFromGPT = async (postContent) => {
    try {
        const response = await openai.Completions.create({
            model: 'text-davinci-003',
            prompt: `Respond to this post: ${postContent}`,
            max_tokens: 150,
            temperature: 0.7,
        });
        return response.choices[0].text.trim();
    } catch (error) {
        console.error('Error generating reply from GPT:', error);
        throw error;
    }
};

// Generate a unique comment ID
const generateUniqueCommentID = () => `comment_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

// Populate the database
async function doPopulate() {
    // Dropping collections
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
                        return callback(err);
                    }
                },
                function(err) {
                    if (err) {
                        console.log(color_error, "ERROR: Something went wrong with saving actors in database");
                        return callback(err);
                    }
                    console.log(color_success, "All actors added to database!");
                    resolve('Promise is resolved successfully.');
                }
            );
        });
    }).then(function(result) {
        console.log(color_start, "Starting to populate posts collection...");
        return new Promise((resolve, reject) => {
            async.each(posts_list, async function(new_post, callback) {
                    const act = await Actor.findOne({ username: new_post.actor }).exec();
                    if (act) {
                        const post = new Script({
                            postID: new_post.postID,
                            body: new_post.body,
                            actor: act,
                            likes: getLikesPost(),
                            time: Date.now(),
                            class: 'post'
                        });

                        try {
                            await post.save();
                        } catch (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving post in database");
                            return callback(err);
                        }
                    } else {
                        console.log(color_error, "ERROR: Actor not found in database");
                        return callback();
                    }
                },
                function(err) {
                    if (err) {
                        console.log(color_error, "ERROR: Something went wrong with saving posts in database");
                        return reject(err);
                    }
                    console.log(color_success, "All posts added to database!");
                    resolve('Promise is resolved successfully.');
                }
            );
        });
    }).then(function(result) {
        console.log(color_start, "Starting to populate post replies...");
        return new Promise(async (resolve, reject) => {
            async.eachSeries(posts_list, async function(post, callback) {
                const act = await Actor.findOne({ username: post.actor }).exec();
                if (act) {
                    const pr = await Script.findOne({ postID: post.postID }).exec();
                    if (pr) {
                        // Generate a reply for each post
                        const replyContent = await generateReplyFromGPT(pr.body);

                        const comment_detail = {
                            commentID: generateUniqueCommentID(),
                            body: replyContent,
                            likes: getLikesComment(),
                            actor: act,
                            time: Date.now(),
                            class: 'gptGenerated'
                        };

                        pr.comments.push(comment_detail);
                        pr.comments.sort((a, b) => a.time - b.time);

                        try {
                            await pr.save();
                        } catch (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving reply in database");
                            return callback(err);
                        }
                    } else {
                        console.log(color_error, "ERROR: Post not found in database");
                        return callback();
                    }
                } else {
                    console.log(color_error, "ERROR: Actor not found in database");
                    return callback();
                }
            },
            function(err) {
                if (err) {
                    console.log(color_error, "ERROR: Something went wrong with saving replies in database");
                    return reject(err);
                }
                console.log(color_success, "All replies added to database!");
                resolve('Promise is resolved successfully.');
            });
        });
    }).then(function(result) {
        console.log(color_start, "Starting to populate notifications collection...");
        return new Promise((resolve, reject) => {
            async.each(notification_list, async function(notification_raw, callback) {
                    const notdetail = {
                        notificationID: notification_raw.notificationID,
                        body: notification_raw.body,
                        actor: notification_raw.actor,
                        time: notification_raw.time,
                        class: 'notification'
                    };

                    const notification = new Notification(notdetail);
                    try {
                        await notification.save();
                    } catch (err) {
                        console.log(color_error, "ERROR: Something went wrong with saving notification in database");
                        return callback(err);
                    }
                },
                function(err) {
                    if (err) {
                        console.log(color_error, "ERROR: Something went wrong with saving notifications in database");
                        return callback(err);
                    }
                    console.log(color_success, "All notifications added to database!");
                    resolve('Promise is resolved successfully.');
                }
            );
        });
    }).then(function(result) {
        console.log(color_start, "Starting to populate notification replies collection...");
        return new Promise((resolve, reject) => {
            async.each(notification_reply_list, async function(notification_raw, callback) {
                    const not = await Notification.findOne({ notificationID: notification_raw.notificationID }).exec();
                    if (not) {
                        const replyContent = await generateReplyFromGPT(notification_raw.body);
                        const reply_detail = {
                            commentID: generateUniqueCommentID(),
                            body: replyContent,
                            actor: await Actor.findOne({ username: notification_raw.actor }).exec(),
                            time: Date.now(),
                            class: 'notificationReply'
                        };

                        not.replies.push(reply_detail);
                        not.replies.sort((a, b) => a.time - b.time);

                        try {
                            await not.save();
                        } catch (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving notification reply in database");
                            return callback(err);
                        }
                    } else {
                        console.log(color_error, "ERROR: Notification not found in database");
                        return callback();
                    }
                },
                function(err) {
                    if (err) {
                        console.log(color_error, "ERROR: Something went wrong with saving notification replies in database");
                        return reject(err);
                    }
                    console.log(color_success, "All notification replies added to database!");
                    resolve('Promise is resolved successfully.');
                }
            );
        });
    });
}

// Call the populate function
doPopulate();
