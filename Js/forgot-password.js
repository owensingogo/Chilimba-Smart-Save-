
/* =========================================
   CHILIMBA SMART SAVE
   Password Recovery
   File: js/forgot-password.js
   ========================================= */

import { auth } from "./firebase.js";
import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const form = document.getElementById("forgot-password-form");
const emailInput = document.getElementById("email");
const message = document.getElementById("reset-message");
const resetButton = document.getElementById("reset-button");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `auth-message ${type}`;
  message.hidden = false;
}

function getFriendlyError(error) {
  switch (error.code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-not-found":
      return "If an account exists for this email, a password-reset email can be requested. Check the address and try again.";

    case "auth/too-many-requests":
      return "Too many attempts. Please wait a while before trying again.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection and try again.";

    case "auth/invalid-credential":
      return "We could not process this request. Please check your details and try again.";

    default:
      return "We could not process your request right now. Please try again later.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  if (!email) {
    showMessage("Please enter your registered email address.");
    emailInput.focus();
    return;
  }

  resetButton.disabled = true;
  resetButton.textContent = "Sending reset link...";

  message.hidden = true;

  try {
    await sendPasswordResetEmail(auth, email);

    showMessage(
      "If an account exists for this email, a password-reset email has been sent. Check your inbox and spam folder.",
      "success"
    );

    form.reset();

  } catch (error) {
    console.error("Password recovery error:", error.code);

    if (error.code === "auth/user-not-found") {
      showMessage(
        "If an account exists for this email, a password-reset email can be requested. Check the address and try again.",
        "success"
      );
    } else {
      showMessage(getFriendlyError(error));
    }
  } finally {
    resetButton.disabled = false;
    resetButton.textContent = "Send reset link";
  }
});
