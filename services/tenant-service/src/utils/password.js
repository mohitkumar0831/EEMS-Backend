import crypto from 'crypto';

/**
 * Generates a secure random temporary password.
 * Format: 4 upper + 4 digits + 4 lower + special char = 13 chars
 */
export const generateTempPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';

  const rand = (chars) => chars[crypto.randomInt(chars.length)];

  const parts = [
    ...Array.from({ length: 4 }, () => rand(upper)),
    ...Array.from({ length: 4 }, () => rand(digits)),
    ...Array.from({ length: 4 }, () => rand(lower)),
    rand(special),
  ];

  // Shuffle array
  for (let i = parts.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join('');
};
