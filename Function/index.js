const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const CEO_SETUP_SECRET = defineSecret("CEO_SETUP_SECRET");

exports.createInitialCeo = onRequest(
  {
    secrets: [CEO_SETUP_SECRET],
    cors: true
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "POST requests only."
      });
    }

    const suppliedSecret = req.get("x-ceo-setup-secret");

    if (
      !suppliedSecret ||
      suppliedSecret !== CEO_SETUP_SECRET.value()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    const email = "owensingogo998@gmail.com";
    const fullName = "Owen Singogo";
    const phone = "0978362800";
    const password = req.body?.password;

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "A password of at least 8 characters is required."
      });
    }

    const db = admin.firestore();
    const setupRef = db.doc("systemConfig/ceoProvisioning");
    let uid;

    try {
      // Allow the initial setup only once.
      await db.runTransaction(async (transaction) => {
        const setupDoc = await transaction.get(setupRef);

        if (setupDoc.exists) {
          throw new Error("CEO_SETUP_ALREADY_USED");
        }

        transaction.create(setupRef, {
          status: "creating",
          startedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
        phoneNumber: "+260978362800",
        emailVerified: false,
        disabled: false
      });

      uid = userRecord.uid;

      await db.doc(`users/${uid}`).set({
        uid,
        fullName,
        phone,
        email,
        role: "ceo",
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await setupRef.update({
        status: "completed",
        uid,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(201).json({
        success: true,
        message: "CEO account created successfully."
      });
    } catch (error) {
      // Remove a partially created account if setup fails.
      if (uid) {
        try {
          await admin.auth().deleteUser(uid);
        } catch (_) {}
      }

      if (error.message === "CEO_SETUP_ALREADY_USED") {
        return res.status(409).json({
          success: false,
          message: "Initial CEO setup has already been used."
        });
      }

      // Keep the setup lock if an account may already exist.
      console.error("CEO setup failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "CEO setup failed. Check the server logs."
      });
    }
  }
);