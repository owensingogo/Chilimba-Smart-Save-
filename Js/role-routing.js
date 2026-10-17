
import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

export async function routeAssignedOfficer(user) {
  if (!user) return false;

  try {
    const groupsQuery = query(
      collection(db, "groups"),
      where("memberUids", "array-contains", user.uid)
    );

    const snapshot = await getDocs(groupsQuery);

    const groups = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    const secretaryGroup = groups.find(
      group => group.secretaryUid === user.uid
    );

    const accountantGroup = groups.find(
      group => group.accountantUid === user.uid
    );

    let role = "";
    let group = null;
    let destination = "";

    if (secretaryGroup) {
      role = "secretary";
      group = secretaryGroup;
      destination = "secretary.html";
    } else if (accountantGroup) {
      role = "accountant";
      group = accountantGroup;
      destination = "accountant.html";
    } else {
      return false;
    }

    const welcomeKey =
      `chilimba-appointment-${user.uid}-${group.id}-${role}`;

    if (!sessionStorage.getItem(welcomeKey)) {
      alert(
        `Congratulations on your appointment as ${role === "secretary" ? "Secretary" : "Accountant"} ` +
        `of ${group.name || "your group"}!\n\n` +
        "We wish you all the best in your new role."
      );

      sessionStorage.setItem(welcomeKey, "shown");
    }

    const currentPath = window.location.pathname;
    const projectRoot = currentPath.split("/pages/")[0];

    window.location.replace(
      `${projectRoot}/pages/member/${destination}`
    );

    return true;
  } catch (error) {
    console.error("Appointment routing failed:", error);
    return false;
  }
}
