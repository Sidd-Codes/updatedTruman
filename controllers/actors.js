const Actor = require('../models/Actor.js');
const Script = require('../models/Script.js');
const User = require('../models/User');
const helpers = require('./helpers');
const lexService = require('../lexService.js');

// Function to create a Lex bot actor
exports.createLexBotActor = async(req, res, next) => {
    try {
        const lexBotActor = new Actor({
            username: 'lexBot_' + Date.now(), // Create a unique username
            profile: {
                name: 'Lex Bot',
                gender: 'N/A',
                age: 0,
                location: 'Cloud',
                bio: 'An AI-powered bot interacting through Amazon Lex.',
                picture: 'default_lexbot.png' // Provide a default image or icon for Lex bot
            },
            class: 'lexBot' // Mark this actor as a Lex bot
        });

        await lexBotActor.save();
        res.status(201).send({ message: 'Lex bot actor created successfully', actor: lexBotActor });
    } catch (err) {
        next(err);
    }
};

exports.handleLexBotInteraction = async (req, res, next) => {
    try {
        // Your Lex bot interaction logic here
        // For example:
        const userInput = req.body.userInput;
        const lexResponse = await lexService.getLexBotResponse(userInput);
        res.json({ message: lexResponse.message });
    } catch (error) {
        next(error);
    }
};

exports.getActors = async(req, res) => {
    if (!req.user.isAdmin) {
        res.redirect('/');
    } else {
        try {
            const actors = await Actor.find().exec();
            res.render('actors', { actors: actors });
        } catch (err) {
            next(err);
        }
    }
};

/**
 * GET /user/:userId
 * Retrieve the profile and relevant experimental posts of the actor whose username field value matches the query parameter value 'userId'.
 * Process the posts with the helper function .getFeed() in ./helpers.js.
 * Check if the current user has blocked or reported the actor.
 * Render the actor's profile page along with the relevant data.
 */
exports.getActor = async(req, res, next) => {
    const time_diff = Date.now() - req.user.createdAt;
    try {
        const user = await User.findById(req.user.id).exec();
        const actor = await Actor.findOne({ username: req.params.userId }).exec();
        if (actor == null) {
            const myerr = new Error('Actor object not found!');
            return next(myerr);
        }

        if (actor.class === 'lexBot') {
            // If the actor is a Lex bot, send the initial interaction
            const lexResponse = await lexService.getLexBotResponse("start");
            const finalfeed = [{ content: lexResponse.message }]; // Display the Lex bot's initial message
            res.render('actor', { script: finalfeed, actor: actor, isBlocked: false, isReported: false, title: actor.profile.name });
        } else {
            const isBlocked = user.blocked.includes(req.params.userId);
            const isReported = user.reported.includes(req.params.userId);
            const script_feed = await Script.find({ actor: actor.id, class: { "$in": ["", user.experimentalCondition] } })
                .where('time').lte(time_diff)
                .sort('-time')
                .populate('actor')
                .populate('comments.actor')
                .exec();

            const finalfeed = helpers.getFeed([], script_feed, user, 'CHRONOLOGICAL', true, false);
            await user.save();
            res.render('actor', { script: finalfeed, actor: actor, isBlocked: isBlocked, isReported: isReported, title: actor.profile.name });
        }
    } catch (err) {
        next(err);
    }
};

/**
 * POST /user
 * Handle post requests to block, unblock, report, follow, and unfollow an actor.
 */
exports.postBlockReportOrFollow = async(req, res, next) => {
    const currDate = Date.now();
    try {
        const user = await User.findById(req.user.id).exec();
        // Block an actor
        if (req.body.blocked) {
            if (!(user.blocked.includes(req.body.blocked))) {
                user.blocked.push(req.body.blocked)
            };
            const log = {
                time: currDate,
                action: "block",
                actorName: req.body.blocked,
            };
            user.blockReportAndFollowLog.push(log);
        }
        // Unblock a user
        else if (req.body.unblocked) {
            if (user.blocked.includes(req.body.unblocked)) {
                const index = user.blocked.indexOf(req.body.unblocked);
                user.blocked.splice(index, 1);
            }
            const log = {
                time: currDate,
                action: "unblock",
                actorName: req.body.unblocked,
            };
            user.blockReportAndFollowLog.push(log);
        }
        // Report an actor
        else if (req.body.reported) {
            if (!(user.reported.includes(req.body.reported))) {
                user.reported.push(req.body.reported);
            }
            const log = {
                time: currDate,
                action: "report",
                actorName: req.body.reported,
                report_issue: req.body.report_issue
            };
            user.blockReportAndFollowLog.push(log);
        }
        // Follow an actor
        else if (req.body.followed) {
            if (!(user.followed.includes(req.body.followed))) {
                user.followed.push(req.body.followed)
            };
            const log = {
                time: currDate,
                action: "follow",
                actorName: req.body.followed,
            };
            user.blockReportAndFollowLog.push(log);
        } // Unfollow an actor
        else if (req.body.unfollowed) {
            if (user.followed.includes(req.body.unfollowed)) {
                const index = user.followed.indexOf(req.body.unfollowed);
                user.followed.splice(index, 1);
            }
            const log = {
                time: currDate,
                action: "unfollow",
                actorName: req.body.unfollowed,
            };
            user.blockReportAndFollowLog.push(log);
        }
        await user.save();
        res.send({ result: "success" });
    } catch (err) {
        next(err);
    }
};
