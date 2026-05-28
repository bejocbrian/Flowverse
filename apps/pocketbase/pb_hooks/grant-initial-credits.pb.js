/// <reference path="../pb_data/types.d.ts" />

// DISABLED.
//
// Email verification is currently turned off. The /auth/signup endpoint now
// grants the welcome credit balance directly at account creation and sets
// initial_credits_granted=true so this hook never fires.
//
// To restore the verification-gated flow:
//   1. Re-enable pb.collection('users').requestVerification(email) in
//      apps/api/src/routes/auth.js
//   2. Restore credits_balance: 0 and remove initial_credits_granted: true
//      from the create() payload in that same file
//   3. Restore the original onRecordAfterUpdateSuccess handler below
