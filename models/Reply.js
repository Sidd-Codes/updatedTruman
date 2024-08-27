const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const replySchema = new Schema({
    postID: String,
    body: String,
    likes: Number,
    actor: { type: Schema.Types.ObjectId, ref: 'Actor' },
    time: Number,
    class: String
});

module.exports = mongoose.model('Reply', replySchema);
