
/* =========================================
   CHILIMBA SMART SAVE
   Firebase Login System
   Group Options for New Members Only
========================================= */

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const loginButton = document.getElementById("login-submit");
const messageBox = document.getElementById("login-message");
const togglePassword = document.getElementById("toggle-password");
const rememberCheckbox = document.getElementById("remember-me");

/* SHOW MESSAGE */

function showMessage(message, type = "error") {
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = `auth-message ${type}`;
  messageBox.hidden = false;
}

/* CLEAR MESSAGE */

function clearMessage() {
  if (!messageBox) return;

  messageBox.textContent = "";
  messageBox.className = "auth-message";
  messageBox.hidden = true;
}

/* SHOW OR HIDE PASSWORD */

togglePassword?.addEventListener("click", () => {
  const hidden = passwordInput.type === "password";

  passwordInput.type = hidden ? "text" : "password";
  togglePassword.textContent = hidden ? "Hide" : "Show";

  togglePassword.setAttribute(
    "aria-label",
    hidden ? "Hide password" : "Show password"
  );
});

/* REMEMBER EMAIL ONLY — NEVER PASSWORD */

try {
  const savedEmail = sessionStorage.getItem(
    "chilimbaRememberedEmail"
  );

  if (savedEmail && emailInput && rememberCheckbox) {
    emailInput.value = savedEmail;
    rememberCheckbox.checked = true;
  }
} catch {
  // Continue if browser storage is unavailable.
}

/* GET USER DESTINATION */

async function getLoginDestination(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error(
      "Your login succeeded, but your user profile was not found. " +
      "Please contact support."
    );
  }

  const profile = userSnapshot.data();

  const role = String(profile.role || "")
    .toLowerCase()
    .trim();

  if (profile.active !== true) {
    throw new Error(
      "Your account is inactive. Please contact support."
    );
  }

  /* CEO GOES DIRECTLY TO CEO DASHBOARD */

  if (role === "ceo") {
    return "../ceo/dashboard.html";
  }

  /* ONLY APPROVED PLATFORM ROLES */

  const allowedRoles = [
    "member",
    "owner",
    "secretary",
    "accountant"
  ];

  if (!allowedRoles.includes(role)) {
    throw new Error(
      "Your account role is not configured. Please contact support."
    );
  }

  /*
    Find groups containing this user.

    Owners are also expected to appear in memberUids.
    The query checks actual group membership instead of
    relying only on the role stored in the user profile.
  */

  const groupsQuery = query(
    collection(db, "groups"),
    where("memberUids", "array-contains", user.uid)
  );

  const groupsSnapshot = await getDocs(groupsQuery);

  /*
    NEW MEMBER:
    No group membership means the user needs to choose
    Create a Group or Join a Group.
  */

  if (groupsSnapshot.empty) {
    return "group-options.html";
  }

  /*
    EXISTING MEMBER:
    Use the group document to determine the user's
    responsibilities in that group.
  */

  let isOwner = false;
  let isSecretary = false;
  let isAccountant = false;

  groupsSnapshot.forEach((groupDocument) => {
    const group = groupDocument.data();

    if (group.ownerUid === user.uid) {
      isOwner = true;
    }

    if (group.secretaryUid === user.uid) {
      isSecretary = true;
    }

    if (group.accountantUid === user.uid) {
      isAccountant = true;
    }
  });

  /*
    OWNER PRIORITY:
    Group ownership is determined from ownerUid,
    not from users/{uid}.role.
  */

  if (isOwner) {
    return "member/dashboard.html";
  }

  /* APPOINTED SECRETARY */

  if (isSecretary) {
    return "member/secretary.html";
  }

  /* APPOINTED ACCOUNTANT */

  if (isAccountant) {
    return "member/accountant.html";
  }

  /* EXISTING ORDINARY MEMBER */

  return "member/dashboard.html";
}

/* LOGIN FORM */

if (!loginForm) {
  console.error(
    "Login form not found. Check the login HTML element IDs."
  );
} else {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage(
        "Please enter your email address and password."
      );
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
      const credentials = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      /* REMEMBER EMAIL, NEVER PASSWORD */

      if (rememberCheckbox?.checked) {
        try {
          sessionStorage.setItem(
            "chilimbaRememberedEmail",
            email
          );
        } catch {
          // Continue without storage.
        }
      } else {
        try {
          sessionStorage.removeItem(
            "chilimbaRememberedEmail"
          );
        } catch {
          // Continue without storage.
        }
      }

      const destination = await getLoginDestination(
        credentials.user
      );

      showMessage(
        "Login successful. Opening your page...",
        "success"
      );

      window.location.replace(destination);

    } catch (error) {
      console.error(
        "Login error:",
        error.code || error.message,
        error
      );

      if (error.code === "auth/invalid-credential") {
        showMessage(
          "Incorrect email or password. Please try again."
        );
      } else if (error.code === "auth/invalid-email") {
        showMessage(
          "Please enter a valid email address."
        );
      } else if (error.code === "auth/too-many-requests") {
        showMessage(
          "Too many login attempts. Please wait before trying again."
        );
      } else if (
        error.code === "auth/network-request-failed"
      ) {
        showMessage(
          "Network error. Check your internet connection."
        );
      } else if (
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
      ) {
        showMessage(
          "You signed in, but Firebase denied access to your profile " +
          "or group membership. Check your Firestore rules."
        );
      } else {
        showMessage(
          error.message ||
          "Unable to sign in. Please try again or contact support."
        );
      }

    } finally {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
      }
    }
  });
}
