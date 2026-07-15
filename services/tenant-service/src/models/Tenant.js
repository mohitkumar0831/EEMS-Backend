import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    // Basic Company Information
    companyName: { type: String, required: true, trim: true },
    companyCode: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    industryType: { 
      type: String, 
      required: true,
      enum: ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Other']
    },
    registrationNumber: { type: String, default: null },
    gstNumber: { type: String, default: null },
    website: { type: String, default: null },
    companyEmail: { type: String, required: true, lowercase: true, trim: true },
    companyPhone: { type: String, default: null },

    // Company Capacity
    employeeCapacity: { type: Number, default: 0 },
    branchCapacity: { type: Number, default: 0 },
    storageLimitGb: { type: Number, default: 0 },
    monthlyExpenseLimit: { type: Number, default: 0 },

    // Subscription Details
    subscriptionPlan: {
      type: String,
      enum: ['Free', 'Basic', 'Standard', 'Enterprise'],
      default: 'Free'
    },
    planStartDate: { type: Date, default: null },
    planExpiryDate: { type: Date, default: null },
    billingCycle: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Yearly'],
      default: 'Monthly'
    },
    subscriptionStatus: {
      type: String,
      enum: ['Active', 'Expired', 'Trial', 'Suspended'],
      default: 'Trial'
    },

    // Company Address
    address: {
      line1: { type: String, default: null },
      line2: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { 
        type: String, 
        enum: ['United States', 'United Kingdom', 'Canada', 'India', 'Australia', 'Other'],
        default: 'Other'
      },
      postalCode: { type: String, default: null }
    },

    // Admin Details
    adminName: { type: String, required: true, trim: true },
    adminEmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
    adminPhone: { type: String, default: null },

    // System Configuration
    config: {
      timeZone: {
        type: String,
        enum: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata'],
        default: 'UTC'
      },
      currency: {
        type: String,
        enum: ['USD', 'EUR', 'GBP', 'INR', 'AUD'],
        default: 'USD'
      },
      dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        default: 'YYYY-MM-DD'
      },
      language: {
        type: String,
        enum: ['English', 'French', 'German', 'Spanish'],
        default: 'English'
      },

    },

    // Status and System Fields
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active',
    },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    
    dbName: { type: String, required: true, unique: true },
    tenantUrl: { type: String, required: true },
    registeredBy: { type: String, required: true }, // super_admin userId
  },
  { timestamps: true }
);

export default mongoose.model('Tenant', tenantSchema);
