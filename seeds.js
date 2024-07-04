import mongoose from 'mongoose'
import bcrypt  from 'bcrypt';
import { User } from './models/User.js';
import 'dotenv/config.js'


const seedAdminUser = async () => {
  try {
    await mongoose.connect(process.env.mongoDB, {
        dbName: 'Application'
    });

    const existingAdmin = await User.findOne({ email: process.env.superAdminEmail });
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    const hashedPassword = await bcrypt.hash(process.env.superAdminKey, 10);
    const adminUser = new User({
      username: process.env.superAdminUsername,
      password: hashedPassword,
      email: process.env.superAdminEmail,
      admin: true,
    });

    await adminUser.save();
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    mongoose.disconnect();
  }
};

seedAdminUser();
