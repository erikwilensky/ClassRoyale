import { db } from "../db/database.js";

console.log("\n=== Verification Links for All Users ===\n");

const users = db.prepare("SELECT email, verificationToken FROM players WHERE verified = 0 AND verificationToken IS NOT NULL").all();

if (users.length === 0) {
    console.log("No unverified users found.\n");
} else {
    users.forEach((user, index) => {
        const link = `http://localhost:3000/api/verify?token=${user.verificationToken}`;
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Link: ${link}\n`);
    });
}

process.exit(0);



