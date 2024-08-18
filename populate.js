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

// Import necessary classes from the OpenAI library
const { Configuration, OpenAIApi } = require('openai');

//Input Files
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


const { OpenAIApi } = require('openai');

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY,
});


mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, { useNewUrlParser: true });
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
async function doPopulate() {
    /****
    Dropping collections
    ****/
    let promise = new Promise((resolve, reject) => { //Drop the actors collection
            console.log(color_start, "Dropping actors...");
            db.collections['actors'].drop(function(err) {
                console.log(color_success, 'Actors collection dropped');
                resolve("done");
            });
        }).then(function(result) { //Drop the scripts collection
            return new Promise((resolve, reject) => {
                console.log(color_start, "Dropping scripts...");
                db.collections['scripts'].drop(function(err) {
                    console.log(color_success, 'Scripts collection dropped');
                    resolve("done");
                });
            });
        }).then(function(result) { //Drop the notifications collection
            return new Promise((resolve, reject) => {
                console.log(color_start, "Dropping notifications...");
                db.collections['notifications'].drop(function(err) {
                    console.log(color_success, 'Notifications collection dropped');
                    resolve("done");
                });
            });
            /***
            Converting CSV files to JSON
            ***/
        }).then(function(result) { //Convert the actors csv file to json, store in actors_list
            return new Promise((resolve, reject) => {
                console.log(color_start, "Reading actors list...");
                CSVToJSON().fromFile(actor_inputFile).then(function(json_array) {
                    actors_list = json_array;
                    console.log(color_success, "Finished getting the actors_list");
                    resolve("done");
                });
            });
        }).then(function(result) { //Convert the posts csv file to json, store in posts_list
            return new Promise((resolve, reject) => {
                console.log(color_start, "Reading posts list...");
                CSVToJSON().fromFile(posts_inputFile).then(function(json_array) {
                    posts_list = json_array;
                    console.log(color_success, "Finished getting the posts list");
                    resolve("done");
                });
            });
        }).then(function(result) { //Convert the comments csv file to json, store in comment_list
            return new Promise((resolve, reject) => {
                console.log(color_start, "Reading comment list...");
                CSVToJSON().fromFile(replies_inputFile).then(function(json_array) {
                    comment_list = json_array;
                    console.log(color_success, "Finished getting the comment list");
                    resolve("done");
                });
            });
        }).then(function(result) { //Convert the comments csv file to json, store in comment_list\
            return new Promise((resolve, reject) => {
                console.log(color_start, "Reading notification list...");
                CSVToJSON().fromFile(notifications_inputFile).then(function(json_array) {
                    notification_list = json_array;
                    console.log(color_success, "Finished getting the notification list");
                    resolve("done");
                });
            });
        }).then(function(result) { //Convert the notification reply csv file to json, store in comment_list\
            return new Promise((resolve, reject) => {
                console.log(color_start, "Reading notification reply list...");
                CSVToJSON().fromFile(notifications_replies_inputFile).then(function(json_array) {
                    notification_reply_list = json_array;
                    console.log(color_success, "Finished getting the notification reply list");
                    resolve("done");
                });
            });
            /*************************
            Create all the Actors in the simulation
            Must be done before creating any other instances
            *************************/
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
                            next(err);
                        }
                    },
                    function(err) {
                        if (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving actors in database");
                            callback(err);
                        }
                        // Return response
                        console.log(color_success, "All actors added to database!")
                        resolve('Promise is resolved successfully.');
                        return 'Loaded Actors';
                    }
                );
            });
            /*************************
            Create each post and upload it to the DB
            Actors must be in DB first to add them correctly to the post
            *************************/
        }).then(function(result) {
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
                            }

                            const script = new Script(postdetail);
                            try {
                                await script.save();
                            } catch (err) {
                                console.log(color_error, "ERROR: Something went wrong with saving post in database");
                                next(err);
                            }
                        } else { //Else no actor found
                            console.log(color_error, "ERROR: Actor not found in database");
                            callback();
                        };
                    },
                    function(err) {
                        if (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving posts in database");
                            callback(err);
                        }
                        // Return response
                        console.log(color_success, "All posts added to database!")
                        resolve('Promise is resolved successfully.');
                        return 'Loaded Posts';
                    }
                );
            });
            /*************************
            Creates inline comments for each post
            Looks up actors and posts to insert the correct comment
            Does this in series to insure comments are put in the correct order
            Takes a while to run because of this.
            *************************/
        })
        .then(function(result) {
            console.log(color_start, "Starting to populate post replies...");
            return new Promise((resolve, reject) => {
              async.eachSeries(posts_list, async function(post, callback) {
                const act = await Actor.findOne({ username: post.actor }).exec();
                if (act) {
                  // Generate a comment using GPT
                  const generatedComment = await generateComment(post.body);
                  console.log('Generated Comment:', generatedComment);
                  const comment_detail = {
                    commentID: generateUniqueId(), // Implement or adjust function to generate unique IDs
                    body: generatedComment,
                    likes: getLikesComment(),
                    actor: act,
                    time: timeStringToNum(post.time),
                    class: post.class
                  };
        
                  // Save the comment to the post
                  const pr = await Script.findOne({ postID: post.id }).exec();
                  if (pr) {
                    pr.comments.push(comment_detail);
                    pr.comments.sort(function(a, b) { return a.time - b.time; });
        
                    try {
                      await pr.save();
                      console.log(color_success, "Comment saved successfully!"); // <-- Insert this line
                  } catch (err) {
                      console.log(color_error, "ERROR: Something went wrong with saving reply in database");
                      return callback(err);
                  }
                  } else { // No post found
                    console.log(color_error, "ERROR: Post not found in database");
                    return callback();
                  }
                } else { // No actor found
                  console.log(color_error, "ERROR: Actor not found in database");
                  return callback();
                }
              },
              function(err) {
                if (err) {
                  console.log(color_error, "ERROR: Something went wrong with saving replies in database");
                  return reject(err);
                }
                // Return response
                console.log(color_success, "All replies added to database!");
                resolve('Promise is resolved successfully.');
              });
            });

            /*************************
            Creates each notification(replies) and uploads it to the DB
            Actors must be in DB first to add them correctly to the post
            *************************/
        })
        .then(function(result) {
            console.log(color_start, "Starting to populate notifications (replies) collection...");
            return new Promise((resolve, reject) => {
                async.each(notification_reply_list, async function(new_notify, callback) {
                        const act = await Actor.findOne({ username: new_notify.actor }).exec();
                        if (act) {
                            const notifydetail = {
                                actor: act,
                                notificationType: 'reply',
                                time: timeStringToNum(new_notify.time),
                                userPostID: new_notify.userPostID,
                                replyBody: new_notify.body,
                                class: new_notify.class
                            };

                            const notify = new Notification(notifydetail);
                            try {
                                await notify.save();
                            } catch (err) {
                                console.log(color_error, "ERROR: Something went wrong with saving notification(reply) in database");
                                console.log(err);
                                next(err);
                            }
                        } else { //Else no actor found
                            console.log(color_error, "ERROR: Actor not found in database");
                            callback();
                        }
                    },
                    function(err) {
                        if (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving notifications(replies) in database");
                        }
                        // Return response
                        console.log(color_success, "All notifications(replies) added to database!");
                        resolve('Promise is resolved successfully.');
                        return 'Loaded Notifications';
                    }
                );
            });
            /*************************
            Creates each notification(likes, reads) and uploads it to the DB
            Actors must be in DB first to add them correctly to the post
            *************************/
        }).then(function(result) {
            console.log(color_start, "Starting to populate notifications (likes, reads) collection...");
            return new Promise((resolve, reject) => {
                async.each(notification_list, async function(new_notify, callback) {
                        const act = await Actor.findOne({ username: new_notify.actor }).exec();
                        if (act) {
                            const notifydetail = {
                                actor: act,
                                notificationType: new_notify.type,
                                time: timeStringToNum(new_notify.time),
                                class: new_notify.class
                            };

                            if (new_notify.userPostID >= 0 && new_notify.userPostID) {
                                notifydetail.userPostID = new_notify.userPostID;
                            } else if (new_notify.userReplyID >= 0 && new_notify.userReplyID) {
                                notifydetail.userReplyID = new_notify.userReplyID;
                            } else if (new_notify.actorReply >= 0 && new_notify.actorReply) {
                                notifydetail.actorReply = new_notify.actorReply;
                            }

                            const notify = new Notification(notifydetail);
                            try {
                                await notify.save();
                            } catch (err) {
                                console.log(color_error, "ERROR: Something went wrong with saving notification(like, read) in database");
                                next(err);
                            }
                        } else { //Else no actor found
                            console.log(color_error, "ERROR: Actor not found in database");
                            callback();
                        }
                    },
                    function(err) {
                        if (err) {
                            console.log(color_error, "ERROR: Something went wrong with saving notifications in database");
                            callback(err);
                        }
                        // Return response
                        console.log(color_success, "All notifications added to database!");
                        mongoose.connection.close();
                        resolve('Promise is resolved successfully.');
                        return 'Loaded Notifications';
                    }
                );
            });
        })
}

//capitalize a string
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

//Transforms a time like -12:32 (minus 12 hours and 32 minutes) into a time in milliseconds
//Positive numbers indicate future posts (after they joined), Negative numbers indicate past posts (before they joined)
//Format: (+/-)HH:MM
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

//Create a random number (for the number of likes) with a weighted distrubution
//This is for posts
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

function generateUniqueId() {
  return 'comment-' + Date.now(); // Simple unique ID generator; adjust as needed
}

//Call the function with the long chain of promises
doPopulate();
