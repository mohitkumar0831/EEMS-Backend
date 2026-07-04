import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log('MongoDB connected:', mongoose.connection.name);
};

export const getTenantModel = (dbName, modelName, schema) => {
  // useDb switches the database on the same connection pool
  const db = mongoose.connection.useDb(dbName, { useCache: true });
  return db.model(modelName, schema);
};

export default connectDB;
