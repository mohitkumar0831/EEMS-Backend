import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export const hashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
