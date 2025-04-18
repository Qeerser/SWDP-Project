import Agenda from "agenda";

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: "agendaJobs",
    options: { useUnifiedTopology: true },
  },
  processEvery: "1 minute",
});

// Define job types
agenda.define("send reservation reminder", async (job) => {
  const { reservationId } = job.attrs.data;

  try {
    // Import here to avoid circular dependencies
    const { sendReservationReminderEmail } = await import(
      "../controllers/reservation.js"
    );
    await sendReservationReminderEmail(reservationId);
  } catch (error) {
    console.error("Error processing reminder job:", error);
  }
});

// Start Agenda
const startAgenda = async () => {
  await agenda.start();
  console.log("Agenda job scheduler started");
};

export { agenda, startAgenda };
