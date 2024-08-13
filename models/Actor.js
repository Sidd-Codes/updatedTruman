const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    profile: {
        name: String,
        gender: String,
        age: Number,
        location: String,
        bio: String,
        picture: String
    },
    class: String, // For experimental use (can be used to define the type of actor)
    isLexBot: { type: Boolean, default: false }, // Indicates if the actor is an Amazon Lex bot
}, { timestamps: true });

const Actor = mongoose.model('Actor', actorSchema);
module.exports = Actor;
