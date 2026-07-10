import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log('MongoDB connected:', mongoose.connection.name);
};

export default connectDB;
