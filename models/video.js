// models/video.js
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    url: String,
    description: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Video', videoSchema);
