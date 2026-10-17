
/* ==========================================
   CHILIMBA SMART SAVE
   Group Owner Dashboard Controller
   File: js/owner-dashboard.js
========================================== */

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

/* PAGE ELEMENTS */

const $ = (id) => document.getElementById(id);

const ownerName = $("owner-name");
const ownerPlace = $("owner-place");
const ownerAvatar = $("owner-avatar");
const welcomeName = $("welcome-name");
const message = $("dashboard-message");
const groupSelector = $("group-selector");
const logoutButton = $("logout-button");
const menuToggle = $("menu-toggle");
const sidebar = $("sidebar");

let ownerGroups = [];
let loadingId = 0;
let signingOut = false;

/* MESSAGES */

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function clearMessage() {
  message.textContent = "";
  message.hidden = true;
}

/* FORMATTING */

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "Unavailable";

  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function dateValue(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) return value;

  return null;
}

function formatDate(value) {
  const date = dateValue(value);

  if (!date) return "Date unavailable";

  return date.toLocaleDateString("en-ZM", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function confirmed(record) {
  return String(record.status || "").toLowerCase() === "confirmed";
}

function amountOf(record) {
  const value = Number(record.amount ?? record.amountZmw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

/* SAFE TABLE DISPLAY */

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = String(value ?? "Unavailable");
  row.appendChild(cell);
}

function showEmptyContributions(text) {
  const body = $("recent-contributions");
  if (!body) return;

  body.replaceChildren();

  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 4;
  cell.textContent = text;

  row.appendChild(cell);
  body.appendChild(row);
}

/* OWNER IDENTIFICATION
   Verify these field names against your actual
   group-creation code and Firestore records.
*/

function isGroupOwner(group, uid) {
  return [
    group.ownerUid,
    group.ownerId,
    group.groupOwnerUid,
    group.createdByUid,
    group.creatorUid
  ].some((value) => value === uid);
}

/* PROFILE DISPLAY */

function displayProfile(profile, user) {
  const name =
    typeof profile.fullName === "string" &&
    profile.fullName.trim()
      ? profile.fullName.trim()
      : user.displayName || "Group Owner";

  const place =
    profile.place ||
    profile.location ||
    "Location not provided";

  setText("owner-name", name);
  setText("owner-place", place);
  setText("welcome-name", name.split(/\s+/)[0]);
  setText("owner-avatar", name.charAt(0).toUpperCase());
}

/* LOAD THE OWNER'S GROUPS */

async function loadOwnerGroups(user) {
  const snapshot = await getDocs(
    query(
      collection(db, "groups"),
      where("memberUids", "array-contains", user.uid)
    )
  );

  const groups = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  return groups.filter((group) => isGroupOwner(group, user.uid));
}

/* GROUP SUBSCRIPTION */

function displaySubscription(group) {
  const status = String(
    group.subscriptionStatus || ""
  ).toLowerCase();

  const now = new Date();
  const trialEnd = dateValue(group.trialEndsAt);
  const paidUntil = dateValue(group.subscriptionPaidUntil);

  let label = "Not configured";

  if (status === "trial") {
    label = trialEnd && now >= trialEnd
      ? "Trial expired"
      : "Free trial";
  } else if (status === "active") {
    label = paidUntil && now >= paidUntil
      ? "Subscription expired"
      : paidUntil
        ? "Active subscription"
        : "Active status needs verification";
  } else if (status === "expired") {
    label = "Subscription expired";
  } else if (status === "pending") {
    label = "Payment pending";
  }

  setText("subscription-status", label);

  const details = [];

  if (group.trialStartedAt) {
    details.push(
      `Trial started: ${formatDate(group.trialStartedAt)}`
    );
  }

  if (group.trialEndsAt) {
    details.push(
      `Trial ends: ${formatDate(group.trialEndsAt)}`
    );
  }

  if (group.subscriptionPaidUntil) {
    details.push(
      `Paid until: ${formatDate(group.subscriptionPaidUntil)}`
    );
  }

  setText("subscription-dates", details.join(" · "));
}

/* LEADERSHIP DISPLAY */

async function displayLeadership(group, uid) {
  setText("lead-owner", "You");

  setText(
    "lead-secretary",
    group.secretaryUid || "Not assigned"
  );

  setText(
    "lead-accountant",
    group.accountantUid || "Not assigned"
  );

  // Resolve profile names when permitted by Firestore rules.
  for (const [elementId, memberUid] of [
    ["lead-secretary", group.secretaryUid],
    ["lead-accountant", group.accountantUid]
  ]) {
    if (!memberUid) continue;

    try {
      const profile = await getDoc(doc(db, "users", memberUid));

      if (profile.exists()) {
        const data = profile.data();

        setText(
          elementId,
          data.fullName || memberUid
        );
      }
    } catch (error) {
      // A UID is still useful if profile access is restricted.
      console.warn("Could not load officer profile:", error.code);
    }
  }
}

/* LOAD CONTRIBUTIONS */

async function loadContributions(group, uid, requestId) {
  const body = $("recent-contributions");

  setText("group-balance", "Loading...");
  setText("personal-balance", "Loading...");
  setText("contribution-count", "Loading...");
  showEmptyContributions("Loading contribution records...");

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "contributions"),
        where("groupId", "==", group.id)
      )
    );

    if (requestId !== loadingId) return;

    let groupTotal = 0;
    let personalTotal = 0;
    let confirmedCount = 0;

    const records = [];

    snapshot.forEach((item) => {
      const record = item.data();

      if (!confirmed(record)) return;

      const amount = amountOf(record);

      groupTotal += amount;
      confirmedCount += 1;

      if (record.memberUid === uid) {
        personalTotal += amount;
      }

      records.push({
        id: item.id,
        uid: record.memberUid || "Unknown",
        amount,
        status: record.status || "Unknown",
        date: record.createdAt || record.date || record.timestamp
      });
    });

    if (requestId !== loadingId) return;

    setText("group-balance", money(groupTotal));
    setText("personal-balance", money(personalTotal));
    setText("contribution-count", String(confirmedCount));

    if (!body) return;

    body.replaceChildren();

    records.sort((a, b) => {
      const first = dateValue(a.date)?.getTime() || 0;
      const second = dateValue(b.date)?.getTime() || 0;
      return second - first;
    });

    const recent = records.slice(0, 10);

    if (recent.length === 0) {
      showEmptyContributions("No confirmed contributions found.");
      return;
    }

    recent.forEach((record) => {
      const row = document.createElement("tr");

      addCell(row, record.uid);
      addCell(row, formatDate(record.date));
      addCell(row, record.status);
      addCell(row, money(record.amount));

      body.appendChild(row);
    });

  } catch (error) {
    if (requestId !== loadingId) return;

    console.error(
      "Contribution loading failed:",
      error.code || error.message
    );

    setText("group-balance", "Unavailable");
    setText("personal-balance", "Unavailable");
    setText("contribution-count", "Unavailable");

    showEmptyContributions(
      "Could not load contributions. Check Firestore rules and connectivity."
    );
  }
}

/* SELECT A GROUP */

async function selectGroup(groupId, uid, requestId) {
  const group = ownerGroups.find((item) => item.id === groupId);

  if (!group) return;

  setText("selected-group-name", group.name || "Unnamed group");
  setText("member-count", Array.isArray(group.memberUids)
    ? String(new Set(group.memberUids).size)
    : "Unavailable");

  displaySubscription(group);
  await displayLeadership(group, uid);
  await loadContributions(group, uid, requestId);
}

/* GROUP SELECTOR */

function populateGroups(user) {
  groupSelector.replaceChildren();

  if (ownerGroups.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No owner-managed groups found";
    groupSelector.appendChild(option);
    groupSelector.disabled = true;

    setText("selected-group-name", "No group selected");
    setText("group-balance", money(0));
    setText("personal-balance", money(0));
    setText("member-count", "0");
    setText("contribution-count", "0");
    setText("subscription-status", "Not available");
    setText("subscription-dates", "");
    setText("lead-owner", "Not available");
    setText("lead-secretary", "Not assigned");
    setText("lead-accountant", "Not assigned");

    showEmptyContributions("No group selected.");
    showMessage(
      "No owner-managed groups were found. Verify the group owner UID field and Firestore rules."
    );

    return;
  }

  ownerGroups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name || "Unnamed group";
    groupSelector.appendChild(option);
  });

  groupSelector.disabled = false;
  clearMessage();

  groupSelector.value = ownerGroups[0].id;

  const requestId = ++loadingId;
  selectGroup(ownerGroups[0].id, user.uid, requestId);
}

/* MAIN DASHBOARD */

async function loadDashboard(user) {
  const requestId = ++loadingId;
  clearMessage();

  try {
    const profileSnapshot = await getDoc(
      doc(db, "users", user.uid)
    );

    if (requestId !== loadingId) return;

    if (!profileSnapshot.exists()) {
      showMessage("Your profile could not be found.");
      await signOut(auth);
      window.location.replace("../login.html");
      return;
    }

    const profile = profileSnapshot.data();
    const role = String(profile.role || "").toLowerCase().trim();

    if (profile.active !== true) {
      showMessage("Your account is inactive. Contact the platform administrator.");
      await signOut(auth);
      window.location.replace("../login.html");
      return;
    }

    if (role === "ceo") {
      window.location.replace("../ceo/dashboard.html");
      return;
    }

    if (role !== "owner") {
      showMessage("Access denied. This dashboard is for group owners only.");
      await signOut(auth);
      window.location.replace("../login.html");
      return;
    }

    displayProfile(profile, user);

    ownerGroups = await loadOwnerGroups(user);

    if (requestId !== loadingId) return;

    populateGroups(user);

  } catch (error) {
    console.error(
      "Owner dashboard error:",
      error.code || error.message
    );

    showMessage(
      "The dashboard could not load. Check your internet connection and Firestore rules."
    );
  }
}

/* AUTHENTICATION */

onAuthStateChanged(auth, (user) => {
  if (signingOut) return;

  if (!user) {
    window.location.replace("../login.html");
    return;
  }

  loadDashboard(user);
});

/* GROUP SWITCHING */

groupSelector.addEventListener("change", () => {
  const user = auth.currentUser;

  if (!user || !groupSelector.value) return;

  const requestId = ++loadingId;
  clearMessage();
  selectGroup(groupSelector.value, user.uid, requestId);
});

/* SIGN OUT */

logoutButton.addEventListener("click", async () => {
  if (signingOut) return;

  signingOut = true;
  logoutButton.disabled = true;
  logoutButton.textContent = "Signing out...";

  try {
    await signOut(auth);
    window.location.replace("../login.html");
  } catch (error) {
    signingOut = false;
    logoutButton.disabled = false;
    logoutButton.textContent = "🚪 Sign Out";

    showMessage("Sign out failed. Please try again.");
    console.error("Sign-out error:", error.code || error.message);
  }
});

/* MOBILE NAVIGATION */

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");

    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation"
    );
    menuToggle.textContent = open ? "✕" : "☰";
  });
}
