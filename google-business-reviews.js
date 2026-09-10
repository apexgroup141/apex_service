const GOOGLE_REVIEWS_ENDPOINT = "https://mybusiness.googleapis.com/v4";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const STAR_VALUES = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5
};

const normalizeResourceId = (value, label) => {
  const normalized = String(value || "").trim().replace(/^accounts\//, "").replace(/^locations\//, "");
  if (!normalized || normalized.includes("/") || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(`${label} is missing or invalid`);
  }
  return normalized;
};

export const getGoogleBusinessAccessToken = async (env, fetchImpl = fetch) => {
  const clientId = String(env.GOOGLE_BUSINESS_CLIENT_ID || "").trim();
  const clientSecret = String(env.GOOGLE_BUSINESS_CLIENT_SECRET || "").trim();
  const refreshToken = String(env.GOOGLE_BUSINESS_REFRESH_TOKEN || "").trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Business OAuth secrets are not configured");
  }

  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token refresh failed with ${response.status}`);
  }

  const body = await response.json();
  if (!body.access_token) throw new Error("Google OAuth response did not include an access token");
  return body.access_token;
};

export const normalizeGoogleReview = (review) => ({
  id: String(review.reviewId || ""),
  author: review.reviewer?.isAnonymous ? "Google user" : String(review.reviewer?.displayName || "Google user"),
  avatarUrl: review.reviewer?.isAnonymous ? "" : String(review.reviewer?.profilePhotoUrl || ""),
  rating: STAR_VALUES[review.starRating] || 0,
  text: String(review.comment || ""),
  publishedAt: String(review.createTime || ""),
  updatedAt: String(review.updateTime || review.createTime || ""),
  ownerReply: review.reviewReply?.comment
    ? {
        text: String(review.reviewReply.comment),
        updatedAt: String(review.reviewReply.updateTime || "")
      }
    : null
});

export const fetchGoogleBusinessReviews = async (env, fetchImpl = fetch) => {
  const accountId = normalizeResourceId(env.GOOGLE_BUSINESS_ACCOUNT_ID, "Google Business account ID");
  const locationId = normalizeResourceId(env.GOOGLE_BUSINESS_LOCATION_ID, "Google Business location ID");
  const accessToken = await getGoogleBusinessAccessToken(env, fetchImpl);
  const reviews = [];
  let averageRating = null;
  let totalReviewCount = null;
  let pageToken = "";

  do {
    const endpoint = new URL(`${GOOGLE_REVIEWS_ENDPOINT}/accounts/${accountId}/locations/${locationId}/reviews`);
    endpoint.searchParams.set("pageSize", "50");
    endpoint.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) endpoint.searchParams.set("pageToken", pageToken);

    const response = await fetchImpl(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Google Business reviews request failed with ${response.status}`);
    }

    const body = await response.json();
    if (averageRating === null && Number.isFinite(Number(body.averageRating))) {
      averageRating = Number(body.averageRating);
    }
    if (totalReviewCount === null && Number.isFinite(Number(body.totalReviewCount))) {
      totalReviewCount = Number(body.totalReviewCount);
    }
    reviews.push(...(body.reviews || []).map(normalizeGoogleReview));
    pageToken = String(body.nextPageToken || "");
  } while (pageToken);

  const uniqueReviews = [...new Map(reviews.filter((review) => review.id).map((review) => [review.id, review])).values()]
    .sort((left, right) => Date.parse(right.updatedAt || right.publishedAt) - Date.parse(left.updatedAt || left.publishedAt));

  return {
    source: "google_business_profile",
    averageRating,
    totalReviewCount,
    reviews: uniqueReviews
  };
};

const formatReviewDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles"
  }).format(date);
};

const renderStars = (rating) => {
  const safeRating = Math.min(Math.max(Number(rating) || 0, 0), 5);
  const stars = Array.from({ length: 5 }, (_, index) => (index < safeRating ? "★" : "☆")).join("");
  return `<span class="google-review-stars" aria-label="${safeRating} out of 5 stars">${stars}</span>`;
};

const OWNER_REPLY_PREVIEW_LENGTH = 180;

const createReplyPreview = (value) => {
  const text = String(value || "").trim();
  if (text.length <= OWNER_REPLY_PREVIEW_LENGTH) return text;
  const shortened = text.slice(0, OWNER_REPLY_PREVIEW_LENGTH + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 120 ? lastSpace : OWNER_REPLY_PREVIEW_LENGTH).trimEnd()}…`;
};

const renderOwnerReply = (ownerReply) => {
  const replyText = String(ownerReply?.text || "").trim();
  if (!replyText) return "";

  const replyDate = ownerReply.updatedAt
    ? `<time datetime="${escapeHtml(ownerReply.updatedAt)}">${escapeHtml(formatReviewDate(ownerReply.updatedAt))}</time>`
    : "";

  if (replyText.length <= OWNER_REPLY_PREVIEW_LENGTH) {
    return `<div class="google-review-reply google-review-reply-short">
      <div class="google-review-reply-heading"><strong>Response from Apex Service Group</strong>${replyDate}</div>
      <p>${escapeHtml(replyText)}</p>
    </div>`;
  }

  return `<details class="google-review-reply google-review-reply-expandable">
    <summary>
      <span class="google-review-reply-summary-copy">
        <strong>Response from Apex Service Group</strong>
        <span class="google-review-reply-preview">${escapeHtml(createReplyPreview(replyText))}</span>
      </span>
      <span class="google-review-reply-action" aria-hidden="true">
        <span class="google-review-reply-action-closed">Read response</span>
        <span class="google-review-reply-action-open">Hide response</span>
      </span>
    </summary>
    <div class="google-review-reply-full"><p>${escapeHtml(replyText)}</p>${replyDate}</div>
  </details>`;
};

const renderReview = (review) => {
  const avatar = review.avatarUrl
    ? `<img class="google-review-avatar" src="${escapeHtml(review.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<span class="google-review-avatar google-review-avatar-fallback" aria-hidden="true">${escapeHtml(review.author.slice(0, 1).toUpperCase())}</span>`;
  const published = formatReviewDate(review.publishedAt);
  const text = review.text
    ? `<p class="google-review-text">${escapeHtml(review.text)}</p>`
    : `<p class="google-review-text google-review-text-empty">Rating provided without written feedback.</p>`;
  const reply = renderOwnerReply(review.ownerReply);

  return `<article class="google-review-card">
    <header class="google-review-card-header">${avatar}<div><strong>${escapeHtml(review.author)}</strong><span class="google-review-source">Google Review</span></div></header>
    <div class="google-review-rating">${renderStars(review.rating)}${published ? `<time datetime="${escapeHtml(review.publishedAt)}">${escapeHtml(published)}</time>` : ""}</div>
    ${text}${reply}
  </article>`;
};

export const renderGoogleReviewsHtml = (payload, options = {}) => {
  const sourceReviews = Array.isArray(payload?.reviews) ? payload.reviews : [];
  const limit = Number(options.limit);
  const reviews = Number.isInteger(limit) && limit > 0 ? sourceReviews.slice(0, limit) : sourceReviews;
  if (!reviews.length) return null;

  const rating = Number(payload.averageRating);
  const count = Number(payload.totalReviewCount);
  const summary = Number.isFinite(rating) && Number.isFinite(count)
    ? `<div class="google-rating-summary"><strong>${escapeHtml(rating.toFixed(1))}</strong>${renderStars(Math.round(rating))}<span>Based on ${escapeHtml(count.toLocaleString("en-US"))} Google reviews</span></div>`
    : "";

  return {
    summary,
    reviews: `<div class="google-reviews-grid">${reviews.map(renderReview).join("")}</div>`
  };
};

export const injectGoogleReviewsIntoHtml = (html, payload, options = {}) => {
  const rendered = renderGoogleReviewsHtml(payload, options);
  if (!rendered) return html;

  return html
    .replace("<!-- GOOGLE_REVIEWS_SUMMARY -->", rendered.summary)
    .replace("<!-- GOOGLE_REVIEWS_LIST -->", rendered.reviews)
    .replace("data-google-reviews-state=\"empty\"", "data-google-reviews-state=\"ready\"");
};
