import { Schema, model } from "mongoose";

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address.']
    },
    admin: {
        type: Boolean,
        required: true
    }
});

const User = model('User', UserSchema);

export { User };
