import mongoose from 'mongoose';

export async function connectMongo(uri) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000
  });
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function checkMongoHealth() {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  await mongoose.connection.db.admin().ping();
  return true;
}
