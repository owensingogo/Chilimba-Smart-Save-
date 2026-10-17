
/* =========================================
   CHILIMBA SMART SAVE
   Member Registration
   File: js/register.js
   ========================================= */

import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const form = document.getElementById("register-form");
const fullNameInput = document.getElementById("full-name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const locationInput = document.getElementById("location");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const termsInput = document.getElementById("agree-terms");
const message = document.getElementById("register-message");
const submitButton = document.getElementById("register-button");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `auth-message ${type}`;
  message.hidden = false;
}

function friendlyError(error) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/weak-password":
      return "Please choose a stronger password.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    case "auth/operation-not-allowed":
      return "Email registration is not enabled in Firebase.";

    case "permission-denied":
    case "firestore/permission-denied":
      return "Your account was created, but its profile could not be saved. Contact support before trying again.";

    default:
      return "Registration could not be completed. Please try again.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = fullNameInput.value.trim().replace(/\s+/g, " ");
  const email = emailInput.value.trim().toLowerCase();
  const phone = phoneInput.value.trim();
  const location = locationInput.value;
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (fullName.length < 2) {
    showMessage("Please enter your full name.");
    fullNameInput.focus();
    return;
  }

  if (!email) {
    showMessage("Please enter your email address.");
    emailInput.focus();
    return;
  }

  if (phone.length < 7 || phone.length > 20) {
    showMessage("Please enter a valid mobile number.");
    phoneInput.focus();
    return;
  }

  if (!location) {
    showMessage("Please select your town or city.");
    locationInput.focus();
    return;
  }

  if (password.length < 8) {
    showMessage("Your password must contain at least 8 characters.");
    passwordInput.focus();
    return;
  }

  if (password !== confirmPassword) {
    showMessage("Your passwords do not match.");
    confirmPasswordInput.focus();
    return;
  }

  if (!termsInput.checked) {
    showMessage("Please agree to the terms and conditions.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";
  message.hidden = true;

  let createdUser = null;
  let profileSaved = false;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    createdUser = credential.user;

    await updateProfile(createdUser, {
      displayName: fullName
    });

    await setDoc(doc(db, "users", createdUser.uid), {
      uid: createdUser.uid,
      fullName: fullName,
      phone: phone,
      email: email,
      location: location,
      role: "member",
      active: true,
      createdAt: serverTimestamp()
    });

    profileSaved = true;

    showMessage(
      "Your account and member profile have been created successfully.",
      "success"
    );

    form.reset();

    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error("Sign-out error:", signOutError.code);
    }

    window.setTimeout(() => {
      window.location.href = "login.html";
    }, 1800);

  } catch (error) {
    console.error(
      "Registration error:",
      error.code || error.message
    );

    if (createdUser && !profileSaved) {
      showMessage(
        "Your authentication account was created, but profile setup failed. Do not register again with the same email. Contact support.",
        "error"
      );
    } else {
      showMessage(friendlyError(error));
    }

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});
