FINAL FRONTEND PASS

Replace these project files:
frontend/src/pages/LoginPage.tsx
frontend/src/pages/DashboardPage.tsx
frontend/src/pages/VerificationPage.tsx

App.tsx, services/api.ts and types/verification.ts are included as the matching integration versions.

Main runtime fix:
The backend case endpoint returns a wrapper containing `verification`. DashboardPage now unwraps it before rendering and safely handles missing issues/check counts.

VerificationPage fix:
The backend case-level `checks` is an object such as { fullName: "PASS", ... }, not an array. The page now renders Object.entries(checks).

Backend is unchanged.
