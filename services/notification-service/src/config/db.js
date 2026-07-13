import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('MONGO_URI is not set. Real-time notifications will work, but persistence is disabled.');
    return;
  }
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log('MongoDB connected for Notifications:', mongoose.connection.name);
};

export const getTenantModel = (dbName, modelName, schema) => {
  if (mongoose.connection.readyState !== 1) return null;
  const db = mongoose.connection.useDb(dbName, { useCache: true });
  return db.models[modelName] || db.model(modelName, schema);
};

export default connectDB;
