
/* ==========================================
   CHILIMBA SMART SAVE
   Member Dashboard Controller
   File: js/member-dashboard.js
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
  where
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

/* ==========================================
   PAGE ELEMENTS
========================================== */

const memberName = document.getElementById("member-name");
const memberLocation = document.getElementById("member-location");
const memberAvatar = document.getElementById("member-avatar");
const welcomeName = document.getElementById("welcome-name");

const dashboardMessage = document.getElementById("dashboard-message");
const logoutButton = document.getElementById("logout-button");
const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");

const contributionsElement = document.getElementById("personal-savings");
const groupSavingsElement = document.getElementById("group-savings");
const groupSavingsNote = document.getElementById("group-savings-note");
const groupSelector = document.getElementById("group-selector");
const subscriptionStatusElement =
  document.getElementById("group-subscription-status");
const subscriptionDatesElement =
  document.getElementById("group-subscription-dates");

const groupsElement = document.getElementById("total-groups");
const transactionsElement = document.getElementById("total-transactions");
const recentTransactions = document.getElementById("recent-transactions");

let loggingOut = false;
let dashboardLoadId = 0;
let routingToOfficer = false;
let loadedGroups = [];
let groupBalances = new Map();

/* ==========================================
   STATUS MESSAGES
========================================== */

function showMessage(message) {
  if (!dashboardMessage) return;

  dashboardMessage.textContent = message;
  dashboardMessage.hidden = false;
}

function clearMessage() {
  if (!dashboardMessage) return;

  dashboardMessage.textContent = "";
  dashboardMessage.hidden = true;
}

/* ==========================================
   LOADING STATE
========================================== */

function showLoadingState() {
  if (contributionsElement) contributionsElement.textContent = "Loading...";
  if (groupSavingsElement) groupSavingsElement.textContent = "Loading...";
  if (groupsElement) groupsElement.textContent = "Loading...";
  if (transactionsElement) transactionsElement.textContent = "Unavailable";

  if (groupSelector) {
    groupSelector.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Loading your groups...";
    groupSelector.appendChild(option);
    groupSelector.disabled = true;
  }

  if (subscriptionStatusElement) {
    subscriptionStatusElement.textContent = "Loading...";
  }

  if (subscriptionDatesElement) {
    subscriptionDatesElement.textContent = "";
  }

  showEmptyTransactions(
    "Transaction history is not enabled by the current Firestore rules."
  );
}

/* ==========================================
   PROFILE DISPLAY
========================================== */

function displayMember(profile, user) {
  const name =
    typeof profile.fullName === "string" && profile.fullName.trim()
      ? profile.fullName.trim()
      : user.displayName || "Member";

  const location =
    typeof profile.place === "string" && profile.place.trim()
      ? profile.place.trim()
      : typeof profile.location === "string" && profile.location.trim()
        ? profile.location.trim()
        : "Location not provided";

  if (memberName) memberName.textContent = name;
  if (memberLocation) memberLocation.textContent = location;

  if (welcomeName) {
    welcomeName.textContent = name.split(/\s+/)[0];
  }

  if (memberAvatar) {
    memberAvatar.textContent = name.charAt(0).toUpperCase();
  }
}

/* ==========================================
   FORMAT HELPERS
========================================== */

function formatMoney(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value)) return "Unavailable";

  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function timestampToDate(timestamp) {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }

  if (timestamp instanceof Date) {
    return timestamp;
  }

  return null;
}

function formatDate(timestamp) {
  const date = timestampToDate(timestamp);

  if (!date) return "Date unavailable";

  return date.toLocaleDateString("en-ZM", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function readAmount(record) {
  const rawAmount = record.amount ?? record.amountZmw;
  const amount = Number(rawAmount);

  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function isConfirmed(record) {
  return String(record.status || "").toLowerCase() === "confirmed";
}

/* ==========================================
   EMPTY TRANSACTION STATE
========================================== */

function showEmptyTransactions(message) {
  if (!recentTransactions) return;

  recentTransactions.replaceChildren();

  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 4;
  cell.textContent = message;

  row.appendChild(cell);
  recentTransactions.appendChild(row);
}

/* ==========================================
   GROUP APPOINTMENTS
========================================== */

function showAppointmentMessage(uid, group, role) {
  const welcomeKey = `chilimba-appointment-${uid}-${group.id}-${role}`;

  let alreadyShown = false;

  try {
    alreadyShown = sessionStorage.getItem(welcomeKey) === "shown";
  } catch {
    // Session storage is optional.
  }

  if (alreadyShown) return;

  const roleName = role === "secretary" ? "Secretary" : "Accountant";
  const groupName =
    typeof group.name === "string" && group.name.trim()
      ? group.name.trim()
      : "your group";

  alert(
    `Congratulations on your appointment as ${roleName} of ${groupName}!\n\n` +
    "We wish you all the best in your new role."
  );

  try {
    sessionStorage.setItem(welcomeKey, "shown");
  } catch {
    // Continue if session storage is unavailable.
  }
}

async function checkOfficerAppointment(user) {
  const groupsSnapshot = await getDocs(
    query(
      collection(db, "groups"),
      where("memberUids", "array-contains", user.uid)
    )
  );

  const groups = groupsSnapshot.docs.map((groupDoc) => ({
    id: groupDoc.id,
    ...groupDoc.data()
  }));

  const secretaryGroup = groups.find(
    (group) => group.secretaryUid === user.uid
  );

  if (secretaryGroup) {
    showAppointmentMessage(user.uid, secretaryGroup, "secretary");
    return "./secretary.html";
  }

  const accountantGroup = groups.find(
    (group) => group.accountantUid === user.uid
  );

  if (accountantGroup) {
    showAppointmentMessage(user.uid, accountantGroup, "accountant");
    return "./accountant.html";
  }

  return null;
}

/* ==========================================
   LOAD GROUPS
========================================== */

async function getMemberGroups(user) {
  const snapshot = await getDocs(
    query(
      collection(db, "groups"),
      where("memberUids", "array-contains", user.uid)
    )
  );

  return snapshot.docs.map((groupDoc) => ({
    id: groupDoc.id,
    ...groupDoc.data()
  }));
}

/* ==========================================
   LOAD CONTRIBUTIONS FOR ONE GROUP

   The groupId query is intentional: the current
   Firestore rules authorize reads based on group
   membership, not merely memberUid.
========================================== */

async function getGroupContributionSummary(group, uid) {
  const snapshot = await getDocs(
    query(
      collection(db, "contributions"),
      where("groupId", "==", group.id)
    )
  );

  let groupTotal = 0;
  let personalTotal = 0;

  snapshot.forEach((contributionDoc) => {
    const contribution = contributionDoc.data();

    if (!isConfirmed(contribution)) return;

    const amount = readAmount(contribution);
    groupTotal += amount;

    if (contribution.memberUid === uid) {
      personalTotal += amount;
    }
  });

  return {
    groupTotal,
    personalTotal,
    contributionCount: snapshot.size,
    available: true
  };
}

/* ==========================================
   SUBSCRIPTION DISPLAY
========================================== */

function getSubscriptionLabel(group) {
  const status = String(group.subscriptionStatus || "").toLowerCase();
  const now = new Date();

  const trialEnd = timestampToDate(group.trialEndsAt);
  const paidUntil = timestampToDate(group.subscriptionPaidUntil);

  if (status === "trial") {
    if (trialEnd && now >= trialEnd) return "Trial expired";
    return "Free trial";
  }

  if (status === "active") {
    if (paidUntil && now >= paidUntil) return "Subscription expired";
    if (!paidUntil) return "Active status needs verification";
    return "Active subscription";
  }

  if (status === "expired") return "Subscription expired";
  if (status === "pending") return "Payment pending";

  return "Not configured";
}

function displaySubscription(group) {
  if (!subscriptionStatusElement || !subscriptionDatesElement) return;

  subscriptionStatusElement.textContent = getSubscriptionLabel(group);

  const details = [];

  if (group.trialStartedAt) {
    details.push(`Trial started: ${formatDate(group.trialStartedAt)}`);
  }

  if (group.trialEndsAt) {
    details.push(`Trial ends: ${formatDate(group.trialEndsAt)}`);
  }

  if (group.subscriptionPaidUntil) {
    details.push(`Paid until: ${formatDate(group.subscriptionPaidUntil)}`);
  }

  subscriptionDatesElement.textContent = details.join(" · ");
}

/* ==========================================
   GROUP SELECTOR AND BALANCES
========================================== */

function displaySelectedGroup(groupId) {
  const group = loadedGroups.find((item) => item.id === groupId);

  if (!group) {
    if (contributionsElement) contributionsElement.textContent = formatMoney(0);
    if (groupSavingsElement) groupSavingsElement.textContent = formatMoney(0);
    if (groupSavingsNote) {
      groupSavingsNote.textContent = "Join a group to view shared savings.";
    }
    if (subscriptionStatusElement) {
      subscriptionStatusElement.textContent = "No group selected";
    }
    if (subscriptionDatesElement) subscriptionDatesElement.textContent = "";
    return;
  }

  displaySubscription(group);

  const balance = groupBalances.get(group.id);

  if (!balance || !balance.available) {
    if (contributionsElement) contributionsElement.textContent = "Unavailable";
    if (groupSavingsElement) groupSavingsElement.textContent = "Unavailable";
    if (groupSavingsNote) {
      groupSavingsNote.textContent =
        "Could not read contribution records for this group.";
    }
    return;
  }

  if (contributionsElement) {
    contributionsElement.textContent = formatMoney(balance.personalTotal);
  }

  if (groupSavingsElement) {
    groupSavingsElement.textContent = formatMoney(balance.groupTotal);
  }

  if (groupSavingsNote) {
    groupSavingsNote.textContent =
      `${group.name || "Selected group"} · Confirmed contributions only`;
  }
}

function populateGroupSelector(groups) {
  if (!groupSelector) return;

  groupSelector.replaceChildren();

  if (groups.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "You have not joined a group yet";
    groupSelector.appendChild(option);
    groupSelector.disabled = true;
    displaySelectedGroup("");
    return;
  }

  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name || "Unnamed group";
    groupSelector.appendChild(option);
  });

  groupSelector.disabled = false;
  groupSelector.value = groups[0].id;
  displaySelectedGroup(groups[0].id);
}

/* ==========================================
   LOAD DASHBOARD RECORDS
========================================== */

async function loadMemberRecords(user, loadId) {
  const groups = await getMemberGroups(user);

  if (
    loadId !== dashboardLoadId ||
    !auth.currentUser ||
    auth.currentUser.uid !== user.uid
  ) {
    return;
  }

  loadedGroups = groups;
  groupBalances = new Map();

  if (groupsElement) {
    groupsElement.textContent = String(groups.length);
  }

  if (groups.length === 0) {
    populateGroupSelector([]);
    if (contributionsElement) contributionsElement.textContent = formatMoney(0);
    if (groupSavingsElement) groupSavingsElement.textContent = formatMoney(0);
    showMessage("You have not joined a Chilimba group yet. You can join using an invitation code.");
    return;
  }

  populateGroupSelector(groups);

  const summaries = await Promise.allSettled(
    groups.map((group) => getGroupContributionSummary(group, user.uid))
  );

  if (
    loadId !== dashboardLoadId ||
    !auth.currentUser ||
    auth.currentUser.uid !== user.uid
  ) {
    return;
  }

  let personalGrandTotal = 0;
  let anySummaryFailed = false;

  summaries.forEach((result, index) => {
    const group = groups[index];

    if (result.status === "fulfilled") {
      groupBalances.set(group.id, result.value);
      personalGrandTotal += result.value.personalTotal;
    } else {
      anySummaryFailed = true;
      groupBalances.set(group.id, {
        groupTotal: 0,
        personalTotal: 0,
        available: false
      });

      console.error(
        `Could not load contributions for group ${group.id}:`,
        result.reason
      );
    }
  });

  // The original summary card now reflects personal contributions
  // across all groups, without counting pending records.
  // If any group could not be read, don't show a misleading total.
  if (anySummaryFailed) {
    showMessage(
      "Some contribution records could not be loaded. " +
      "Check Firestore rules and your internet connection."
    );
  } else {
    clearMessage();
  }

  // Refresh the selected group balances after loading the records.
  if (groupSelector && groupSelector.value) {
    displaySelectedGroup(groupSelector.value);
  }

  // The two prominent cards show the selected group's balances.
  // The total personal contributions across all groups remain available
  // in the same dashboard controller for the overall summary.
  if (anySummaryFailed && contributionsElement) {
    const selected = groupBalances.get(groupSelector?.value);
    if (selected && !selected.available) {
      contributionsElement.textContent = "Unavailable";
    }
  }

  // Transaction history remains unavailable until its collection
  // and matching Firestore read rules are implemented.
  if (transactionsElement) {
    transactionsElement.textContent = "Unavailable";
  }

  showEmptyTransactions(
    "Transaction history is unavailable because the current Firestore rules do not allow reads from the transactions collection."
  );
}

/* ==========================================
   LOAD MEMBER DASHBOARD
========================================== */

async function loadMemberDashboard(user) {
  const loadId = ++dashboardLoadId;

  clearMessage();
  showLoadingState();

  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));

    if (loadId !== dashboardLoadId) return;

    if (!profileSnapshot.exists()) {
      showMessage(
        "Your member profile could not be found. Please contact support."
      );
      return;
    }

    const profile = profileSnapshot.data();
    const role = String(profile.role || "").toLowerCase().trim();

    if (profile.active !== true) {
      showMessage(
        "Your account is inactive. Please contact the platform administrator."
      );
      await signOut(auth);
      window.location.replace("../login.html");
      return;
    }

    if (role === "ceo") {
      window.location.replace("../ceo/dashboard.html");
      return;
    }

    const allowedRoles = [
      "member",
      "owner",
      "assistant manager",
      "secretary",
      "accountant",
      "financial treasurer",
      "treasurer"
    ];

    if (!allowedRoles.includes(role)) {
      showMessage(
        "Your account role is not configured. Please contact support."
      );
      return;
    }

    let officerDestination;

    try {
      officerDestination = await checkOfficerAppointment(user);
    } catch (appointmentError) {
      console.error("Could not check officer appointment:", appointmentError);

      showMessage(
        "We could not verify your group appointment. " +
        "Check your internet connection and Firestore rules."
      );
      return;
    }

    if (
      loadId !== dashboardLoadId ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      return;
    }

    if (officerDestination) {
      routingToOfficer = true;
      window.location.replace(officerDestination);
      return;
    }

    routingToOfficer = false;
    displayMember(profile, user);
    await loadMemberRecords(user, loadId);

  } catch (error) {
    console.error(
      "Dashboard loading error:",
      error.code || error.message
    );

    showMessage(
      "We could not load your dashboard. " +
      "Check your internet connection and Firestore rules."
    );

    if (contributionsElement) contributionsElement.textContent = "Unavailable";
    if (groupSavingsElement) groupSavingsElement.textContent = "Unavailable";
    if (groupsElement) groupsElement.textContent = "Unavailable";
    if (transactionsElement) transactionsElement.textContent = "Unavailable";

    showEmptyTransactions("Transaction history is unavailable.");
  }
}

/* ==========================================
   AUTHENTICATION PROTECTION
========================================== */

onAuthStateChanged(auth, async (user) => {
  if (loggingOut || routingToOfficer) return;

  if (!user) {
    window.location.replace("../login.html");
    return;
  }

  await loadMemberDashboard(user);
});

/* ==========================================
   GROUP SELECTOR
========================================== */

if (groupSelector) {
  groupSelector.addEventListener("change", () => {
    displaySelectedGroup(groupSelector.value);
  });
}

/* ==========================================
   SIGN OUT
========================================== */

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    if (loggingOut) return;

    loggingOut = true;
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    try {
      await signOut(auth);
      window.location.replace("../login.html");
    } catch (error) {
      loggingOut = false;
      logoutButton.disabled = false;
      logoutButton.textContent = "🚪 Sign Out";

      console.error("Sign-out error:", error.code || error.message);

      showMessage(
        "We could not sign you out. Check your connection and try again."
      );
    }
  });
}

/* ==========================================
   MOBILE NAVIGATION
========================================== */

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation"
    );
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });

  document.querySelectorAll(".dashboard-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      sidebar.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (
    sidebar &&
    menuToggle &&
    !sidebar.contains(event.target) &&
    !menuToggle.contains(event.target)
  ) {
    sidebar.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});