// Creates the first owner if the database has no users yet, and writes a one-time link for them
// to set their password to owner-setup-link.txt (git-ignored). Never deletes anything.
//   OWNER_NAME="Your Name" OWNER_EMAIL="you@example.com" APP_URL="https://your-app.vercel.app" npm run db:seed
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { INVITE_DAYS, newInviteToken } from "../src/lib/auth";

const db = new PrismaClient();

async function main() {
  const name = process.env.OWNER_NAME?.trim();
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!name || !email) throw new Error("Set OWNER_NAME and OWNER_EMAIL");

  if ((await db.user.count()) > 0) {
    console.log("Users already exist, nothing to do. Use Settings → Reset link to regain access.");
    return;
  }
  const owner = await db.user.create({ data: { name, email, role: "OWNER" } });
  const { token, tokenHash } = newInviteToken();
  await db.invite.create({
    data: { userId: owner.id, tokenHash, expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5) },
  });
  writeFileSync("owner-setup-link.txt", `${appUrl}/invite/${token}\n`);
  console.log(`Created owner ${owner.email}. Open the link in owner-setup-link.txt to set your password.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
