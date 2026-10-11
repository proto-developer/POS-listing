// Prints a LISTER_PASSWORD_HASH line for .env.local. Same format as server/auth/credentials.ts.
//   npm run hash-password            (asks for the password, nothing is echoed)
//   npm run hash-password -- "pw"    (passes it as an argument; note it lands in your shell history)
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

// Colons, not "$": .env files expand "$VAR" references.
function hash(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

function print(password) {
  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }
  console.log(`LISTER_PASSWORD_HASH=${hash(password)}`);
}

const arg = process.argv[2];
if (arg) print(arg);
else {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write("Password: ");
  rl._writeToOutput = () => {}; // hide what is typed
  rl.question("", (pw) => {
    process.stdout.write("\n");
    rl.close();
    print(pw);
  });
}
