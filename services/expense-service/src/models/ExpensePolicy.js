import mongoose from 'mongoose';

const expensePolicySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
    },
    limit: {
      type: Number,
      required: true,
      min: 0,
    },
    rule: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

export { expensePolicySchema };
