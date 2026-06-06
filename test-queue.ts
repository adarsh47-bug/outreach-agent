import { getAdminDb } from "./server/services/firebaseAdmin.js";
import { config } from "dotenv";

config();

async function run() {
  const db = await getAdminDb();
  const usersSnap = await db.collection("users").get();
  for (const user of usersSnap.docs) {
    const queueSnap = await db.collection(`users/${user.id}/emailQueue`).where("status", "==", "Pending").get();
    console.log(`User ${user.id} has ${queueSnap.size} pending queue items.`);
    if (queueSnap.size > 0) {
      console.log(queueSnap.docs[0].data());
    }
  }
}
run();
