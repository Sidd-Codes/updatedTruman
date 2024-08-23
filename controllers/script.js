const Script = require('../models/Script.js');
const User = require('../models/User');
const Notification = require('../models/Notification');
const helpers = require('./helpers');
const _ = require('lodash');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' }); // See the file .env.example for the structure of .env

/**
 * GET /
 * Fetch and render newsfeed.
 */
exports.getScript = async(req, res, next) => {
    try {
        const one_day = 86400000; // Number of milliseconds in a day.
        const time_now = Date.now(); // Current date.
        const time_diff = time_now - req.user.createdAt; // Time difference between now and user account creation, in milliseconds.
        const time_limit = time_diff - one_day; // Date in milliseconds 24 hours ago from now. This is used later to show posts only in the past 24 hours.

        const user = await User.findById(req.user.id)
            .populate('posts.comments.actor')
            .exec();

        // If the user is no longer active, sign the user out.
        if (!user.active) {
            req.logout((err) => {
                if (err) console.log('Error : Failed to logout.', err);
                req.session.destroy((err) => {
                    if (err) console.log('Error : Failed to destroy the session during logout.', err);
                    req.user = null;
                    req.flash('errors', { msg: 'Account is no longer active. Study is over.' });
                    res.redirect('/login' + (req.query.r_id ? `?r_id=${req.query.r_id}` : ""));
                });
            });
        }

        // What day in the study is the user in? 
        // Update study_days, which tracks the number of time user views feed.
        const current_day = Math.floor(time_diff / one_day);
        if (current_day < process.env.NUM_DAYS) {
            user.study_days[current_day] += 1;
            user.save();
        }

        // Array of actor posts that match the user's experimental condition, within the past 24 hours, sorted by descending time. 
        let script_feed = await Script.find({
                class: { "$in": ["", user.experimentalCondition] }
            })
            .where('time').lte(time_diff).gte(time_limit)
            .sort('-time')
            .populate('actor')
            .populate('comments.actor')
            .exec();

        // Array of any user-made posts within the past 24 hours, sorted by time they were created.
        let user_posts = user.getPostInPeriod(time_limit, time_diff);
        user_posts.sort(function(a, b) {
            return b.relativeTime - a.relativeTime;
        });

        // Get the newsfeed and render it.
        const finalfeed = helpers.getFeed(user_posts, script_feed, user, process.env.FEED_ORDER, true);
        console.log("Script Size is now: " + finalfeed.length);
        res.render('script', { script: finalfeed, showNewPostIcon: true });
    } catch (err) {
        next(err);
    }
};

/*
 * Post /post/new
 * Record a new user-made post. Include any actor replies (comments) that go along with it.
 */
exports.newPost = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        if (req.file) {
            user.numPosts = user.numPosts + 1; // Count begins at 0
            const currDate = Date.now();

            let post = {
                type: req.body.repost ? "repost" : "user_post",
                postID: user.numPosts,
                body: req.body.body,
                picture: req.file.filename,
                liked: false,
                likes: 0,
                comments: [],
                absTime: currDate,
                relativeTime: currDate - user.createdAt,
            };

            // If it's a repost, add the original post details
            if (req.body.repost) {
                post.repostDetails = {
                    originalPostID: req.body.repostID,
                    originalPostBody: req.body.repostBody,
                    originalPostPicture: req.body.repostPicture
                };
            }

            user.posts.unshift(post); // Add most recent user-made post to the beginning of the array
            await user.save();
            
            if (req.body.repost) {
                res.json({ success: true, message: 'Post reposted successfully', post: post });
            } else {
                res.redirect('/');
            }
        } else {
            req.flash('errors', { msg: 'ERROR: Your post did not get sent. Please include a photo and a caption.' });
            res.redirect('/');
        }
    } catch (err) {
        next(err);
    }
};


/**
 * POST /feed/
 * Record user's actions on ACTOR posts. 
 */
exports.postUpdateFeedAction = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        // Check if user has interacted with the post before.
        let feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == req.body.postID; });

        // If the user has not interacted with the post before, add the post to user.feedAction.
        if (feedIndex == -1) {
            const cat = {
                post: req.body.postID,
                postClass: req.body.postClass,
            };
            feedIndex = user.feedAction.push(cat) - 1;
        }

        // User created a new comment on the post.
        if (req.body.new_comment) {
            user.numComments = user.numComments + 1;
            const cat = {
                new_comment: true,
                new_comment_id: user.numComments,
                body: req.body.comment_text,
                relativeTime: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                liked: false,
                flagged: false,
            }
            user.feedAction[feedIndex].comments.push(cat);
        }
        // User interacted with a comment on the post.
        else if (req.body.commentID) {
            const isUserComment = (req.body.isUserComment == 'true');
            // Check if user has interacted with the comment before.
            let commentIndex = (isUserComment) ?
                _.findIndex(user.feedAction[feedIndex].comments, function(o) {
                    return o.new_comment_id == req.body.commentID && o.new_comment == isUserComment
                }) :
                _.findIndex(user.feedAction[feedIndex].comments, function(o) {
                    return o.comment == req.body.commentID && o.new_comment == isUserComment
                });

            // If the user has not interacted with the comment before, add the comment to user.feedAction[feedIndex].comments
            if (commentIndex == -1) {
                const cat = {
                    comment: req.body.commentID
                };
                user.feedAction[feedIndex].comments.push(cat);
                commentIndex = user.feedAction[feedIndex].comments.length - 1;
            }

            // User liked the comment.
            if (req.body.like) {
                const like = req.body.like;
                user.feedAction[feedIndex].comments[commentIndex].likeTime.push(like);
                user.feedAction[feedIndex].comments[commentIndex].liked = true;
                if (req.body.isUserComment != 'true') user.numCommentLikes++;
            }

            // User unliked the comment.
            if (req.body.unlike) {
                const unlike = req.body.unlike;
                user.feedAction[feedIndex].comments[commentIndex].unlikeTime.push(unlike);
                user.feedAction[feedIndex].comments[commentIndex].liked = false;
                if (req.body.isUserComment != 'true') user.numCommentLikes--;
            }

            // User flagged the comment.
            else if (req.body.flag) {
                const flag = req.body.flag;
                user.feedAction[feedIndex].comments[commentIndex].flagTime.push(flag);
                user.feedAction[feedIndex].comments[commentIndex].flagged = true;
            }
        }
        // User interacted with the post.
        else {
            // User flagged the post.
            if (req.body.flag) {
                const flag = req.body.flag;
                user.feedAction[feedIndex].flagTime = [flag];
                user.feedAction[feedIndex].flagged = true;
            }

            // User liked the post.
            else if (req.body.like) {
                const like = req.body.like;
                user.feedAction[feedIndex].likeTime.push(like);
                user.feedAction[feedIndex].liked = true;
                user.numPostLikes++;
            }
            // User unliked the post.
            else if (req.body.unlike) {
                const unlike = req.body.unlike;
                user.feedAction[feedIndex].unlikeTime.push(unlike);
                user.feedAction[feedIndex].liked = false;
                user.numPostLikes--;
            }
            // User read the post.
            else if (req.body.viewed) {
                const view = req.body.viewed;
                user.feedAction[feedIndex].readTime.push(view);
                user.feedAction[feedIndex].rereadTimes++;
                user.feedAction[feedIndex].mostRecentTime = Date.now();
            } else {
                console.log('Something in feedAction went crazy. You should never see this.');
            }
        }
        await user.save();
        res.send({ result: "success", numComments: user.numComments });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /userPost_feed/
 * Record user's actions on USER posts. 
 */
exports.postUpdateUserPostFeedAction = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        // Find the index of object in user.posts
        let feedIndex = _.findIndex(user.posts, function(o) { return o.postID == req.body.postID; });

        if (feedIndex == -1) {
            // Should not happen.
        }
        // User created a new comment on the post.
        else if (req.body.new_comment) {
            user.numComments = user.numComments + 1;
            const cat = {
                body: req.body.comment_text,
                commentID: user.numComments,
                relativeTime: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                new_comment: true,
                liked: false,
                flagged: false,
                likes: 0
            };
            user.posts[feedIndex].comments.push(cat);
        }
        // User interacted with a comment on the post.
        else if (req.body.commentID) {
            const commentIndex = _.findIndex(user.posts[feedIndex].comments, function(o) {
                return o.commentID == req.body.commentID && o.new_comment == (req.body.isUserComment == 'true');
            });
            if (commentIndex == -1) {
                console.log("Should not happen.");
            }
            // User liked the comment.
            else if (req.body.like) {
                user.posts[feedIndex].comments[commentIndex].liked = true;
            }
            // User unliked the comment. 
            else if (req.body.unlike) {
                user.posts[feedIndex].comments[commentIndex].liked = false;
            }
            // User flagged the comment.
            else if (req.body.flag) {
                user.posts[feedIndex].comments[commentIndex].flagged = true;
            }
        }
        // User interacted with the post. 
        else {
            // User liked the post.
            if (req.body.like) {
                user.posts[feedIndex].liked = true;
            }
            // User unliked the post.
            if (req.body.unlike) {
                user.posts[feedIndex].liked = false;
            }
        }
        await user.save();
        res.send({ result: "success", numComments: user.numComments });
    } catch (err) {
        next(err);
    }
}

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is stored in your .env file
});

const openai = new OpenAIApi(configuration);

exports.createAiGeneratedComment = async (postId) => {
    try {
        const post = await Script.findById(postId);
        const aiActor = await Actor.findOne({ class: 'aiBot' }); // Update to use your actor's class

        // Use OpenAI API to generate a comment based on the post content
        const response = await openai.createChatCompletion({
            model: "gpt-4", // Use the appropriate model
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant generating comments for social media posts.",
                },
                {
                    role: "user",
                    content: `Post content: "${post.body}". Please generate a relevant comment.`,
                },
            ],
        });

        const commentContent = response.data.choices[0].message.content;

        // Add the generated comment to the post
        post.comments.push({
            actor: aiActor._id,
            body: commentContent,
            new_comment: false,
            absTime: Date.now(),
            relativeTime: Date.now() - aiActor.createdAt,
        });

        await post.save();
        console.log('AI-generated comment created');
    } catch (error) {
        console.error('Error creating AI-generated comment:', error);
    }
};
