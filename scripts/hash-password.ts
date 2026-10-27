/** Usage: npm run owner:hash -- "your password"   -> prints the value for OWNER_PASSWORD_HASH */
import { hashPassword } from "../src/lib/password";

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('Usage: npm run owner:hash -- "a password of at least 8 characters"');
  process.exit(1);
}
console.log(hashPassword(pw));
