/*
 * Chilimba Smart Save — CEO Account Setup
 *
 * IMPORTANT:
 * This file is for a trusted server environment only.
 * Never place Firebase Admin credentials or CEO passwords
 * in your public website's js/ folder.
 *
 * CEO account:
 * Name: Owen Singogo
 * Phone: 0978362800
 * Email: owensingogo998@gmail.com
 */

export const CEO_ACCOUNT = Object.freeze({
  fullName: "Owen Singogo",
  phone: "0978362800",
  email: "owensingogo998@gmail.com",
  role: "ceo",
  active: true
});

/*
 * A secure server-side Firebase Admin function must:
 *
 * 1. Create or locate the Firebase Authentication user.
 * 2. Obtain the user's real Firebase UID.
 * 3. Create users/{uid} in Firestore.
 * 4. Set role to "ceo" and active to true.
 * 5. Restrict this operation to trusted administrators.
 *
 * Do not create a public endpoint that lets anyone assign
 * themselves the CEO role.
 *
 * This file only holds the account details. It does not
 * create an account until connected to that secure function.
 */