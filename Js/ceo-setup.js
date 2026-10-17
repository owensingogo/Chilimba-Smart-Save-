
import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const CEO_EMAIL = "owensingogo998@gmail.com";
const CEO_UID = "A3kbzOCEddgnSFzxlSHG8FQF3Y02";

const form = document.getElementById("setupForm");
const status = document.getElementById("status");
const button = document.getElementById("setupButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  button.disabled = true;
  status.textContent = "Signing in and checking CEO permissions...";

  try {
    const password = document.getElementById("password").value;

    const credential = await signInWithEmailAndPassword(
      auth,
      CEO_EMAIL,
      password
    );

    const user = credential.user;

    if (user.uid !== CEO_UID ||
        user.email?.toLowerCase() !== CEO_EMAIL) {
      throw new Error(
        "The signed-in account does not match the configured CEO account."
      );
    }

    const profileRef = doc(db, "users", user.uid);
    const profileSnapshot = await getDoc(profileRef);

    if (!profileSnapshot.exists()) {
      throw new Error(
        "Your login works, but your Firestore CEO profile is missing. " +
        "It must be created through the trusted administrative setup."
      );
    }

    const profile = profileSnapshot.data();

    if (profile.role !== "ceo" || profile.active !== true) {
      throw new Error(
        "The profile exists, but it is not authorized for active CEO access."
      );
    }

    status.textContent = "Verified. Opening your CEO dashboard...";

    window.location.replace("./ceo/dashboard.html");

  } catch (error) {
    console.error("CEO setup:", error);
    status.textContent = error.message ||
      "Unable to verify the CEO account.";
  } finally {
    button.disabled = false;
  }
});
