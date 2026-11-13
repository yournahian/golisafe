# GitHub Copilot PR Review Instructions

When reviewing pull requests for **GoliSafe**, strictly enforce the following architecture, security, privacy, and team ownership rules:

## 1. Security & Architecture Isolation
- **Reject any PR** where `apps/mobile` imports `@supabase/supabase-js` or calls Supabase directly.
- All mobile client requests must go exclusively through the `backend` REST API.

## 2. Shared API Contract Alignment
- Verify that all request/response payloads and TypeScript interfaces in both `backend` and `apps/mobile` match the types defined in `packages/shared/api-contract.ts` (`HazardCategory`, `HazardSeverity`, `HazardRecord`, `CreateHazardRequest`).

## 3. Zero-PII Enforcement
- Reject any PR that introduces user accounts, authentication/login flows, names, phone numbers, email addresses, or any other Personally Identifiable Information (PII) in schemas, APIs, or UI components.

## 4. Strict Team Folder Ownership
- Ensure developers only modify files within their assigned folder ownership:
  - **Dev 1 (Naimul - Team Lead)**: `apps/mobile/src/screens/`, `apps/mobile/src/services/`, `backend/src/index.ts`
  - **Dev 2 (Apurba)**: `database/`, `backend/src/config/supabase.ts`
  - **Dev 3 (Arini)**: `apps/mobile/src/components/Report/`
  - **Dev 4 (Yasin)**: `backend/src/routes/hazards.ts`
- Flag and reject changes made outside the PR author's assigned directories unless explicitly coordinated.
