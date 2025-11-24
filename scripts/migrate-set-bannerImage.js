import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import Event from "../models/Event.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

(async () => {
  try {
    await connectDB();

    const events = await Event.find();
    console.log(`Found ${events.length} events`);

    for (const ev of events) {
      const current = (ev.bannerImage || ev.banner || "").toString().trim();
      if (!current) {
        ev.bannerImage = `https://source.unsplash.com/random/1200x400?event,cyber,tech,hackathon,neon&sig=${ev._id}`;
        await ev.save();
        console.log(`Updated bannerImage for event ${ev._id}`);
      }
    }

    console.log("Migration finished");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
