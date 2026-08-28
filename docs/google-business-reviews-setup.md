# Google Business Profile reviews integration

This integration uses the official Google Business Profile APIs from the Cloudflare Worker. No Google credentials or access tokens are sent to the browser.

## Runtime flow

1. A Cloudflare Cron Trigger runs every three hours.
2. The Worker exchanges the stored OAuth refresh token for a short-lived access token.
3. The Worker calls the official Business Profile reviews endpoint and follows pagination.
4. The normalized response is stored in the existing D1 database.
5. Requests for `/reviews` receive HTML with the last successful D1 cache rendered server-side.
6. If Google is temporarily unavailable, the cache is not replaced and the last successful reviews remain visible.

## Required Google APIs

- Google My Business API (reviews endpoint)
- My Business Account Management API (account discovery)
- My Business Business Information API (location discovery)

The account and location discovery APIs are only needed while finding the correct IDs. The runtime reviews request uses:

`GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews`

with the OAuth scope:

`https://www.googleapis.com/auth/business.manage`

## Cloudflare secrets

In production, store these with `wrangler secret put`. For an approved local test, they may be placed in an ignored `.dev.vars` file, but that file must never be committed or shared. Never place them in HTML or browser JavaScript:

- `GOOGLE_BUSINESS_CLIENT_ID`
- `GOOGLE_BUSINESS_CLIENT_SECRET`
- `GOOGLE_BUSINESS_REFRESH_TOKEN`

## Cloudflare variables

These identifiers are not OAuth secrets, but should still be configured as Worker environment variables rather than duplicated in page code:

- `GOOGLE_BUSINESS_ACCOUNT_ID`
- `GOOGLE_BUSINESS_LOCATION_ID`

## One-time OAuth authorization

Use an OAuth client in the already-approved Google Cloud project. The Google account completing authorization must have access to the Apex Service Group Business Profile.

Request offline access and the `business.manage` scope. Store the resulting refresh token directly as a Cloudflare secret. Do not save it in this repository or share it in chat.

Before creating a new OAuth client, first check the approved project under **APIs & Services → Credentials** for an existing suitable Web application or Desktop application OAuth client. Also verify the three APIs above under **Enabled APIs & services**.

## Database migration

Apply `migrations/0004_google_reviews_cache.sql` to the existing D1 database before enabling the scheduled sync.

## First controlled sync

After the secrets, IDs, and migration are configured, an authorized administrator can trigger one sync with:

`POST /api/admin/google-reviews/sync`

using the existing `ADMIN_TOKEN` bearer authorization. A failed sync returns an error without deleting the previous cache.
