import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGoogleBusinessReviews,
  injectGoogleReviewsIntoHtml,
  normalizeGoogleReview
} from "../google-business-reviews.js";

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" }
});

test("normalizes Google review fields including owner reply", () => {
  const review = normalizeGoogleReview({
    reviewId: "review-1",
    reviewer: { displayName: "Alex", profilePhotoUrl: "https://example.com/avatar.jpg" },
    starRating: "FIVE",
    comment: "Great service",
    createTime: "2026-08-01T12:00:00Z",
    updateTime: "2026-08-02T12:00:00Z",
    reviewReply: { comment: "Thank you!", updateTime: "2026-08-03T12:00:00Z" }
  });

  assert.deepEqual(review, {
    id: "review-1",
    author: "Alex",
    avatarUrl: "https://example.com/avatar.jpg",
    rating: 5,
    text: "Great service",
    publishedAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-02T12:00:00Z",
    ownerReply: { text: "Thank you!", updatedAt: "2026-08-03T12:00:00Z" }
  });
});

test("refreshes OAuth, paginates reviews, deduplicates, and sorts newest first", async () => {
  const calls = [];
  const fetchMock = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    if (String(input).includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "temporary-token" });
    if (String(input).includes("pageToken=next")) {
      return jsonResponse({
        reviews: [{ reviewId: "new", starRating: "FIVE", createTime: "2026-08-03T00:00:00Z" }]
      });
    }
    return jsonResponse({
      averageRating: 4.8,
      totalReviewCount: 2,
      nextPageToken: "next",
      reviews: [
        { reviewId: "old", starRating: "FOUR", createTime: "2026-08-01T00:00:00Z" },
        { reviewId: "old", starRating: "FOUR", createTime: "2026-08-01T00:00:00Z" }
      ]
    });
  };

  const payload = await fetchGoogleBusinessReviews({
    GOOGLE_BUSINESS_CLIENT_ID: "client-id",
    GOOGLE_BUSINESS_CLIENT_SECRET: "client-secret",
    GOOGLE_BUSINESS_REFRESH_TOKEN: "refresh-token",
    GOOGLE_BUSINESS_ACCOUNT_ID: "123",
    GOOGLE_BUSINESS_LOCATION_ID: "456"
  }, fetchMock);

  assert.equal(payload.averageRating, 4.8);
  assert.equal(payload.totalReviewCount, 2);
  assert.deepEqual(payload.reviews.map((review) => review.id), ["new", "old"]);
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /accounts\/123\/locations\/456\/reviews/);
  assert.equal(calls[1].init.headers.Authorization, "Bearer temporary-token");
});

test("injects escaped server-rendered review HTML and removes the empty state", () => {
  const html = '<main data-google-reviews-state="empty"><!-- GOOGLE_REVIEWS_SUMMARY --><!-- GOOGLE_REVIEWS_LIST --></main>';
  const rendered = injectGoogleReviewsIntoHtml(html, {
    averageRating: 5,
    totalReviewCount: 1,
    reviews: [{
      id: "1",
      author: "A <Customer>",
      rating: 5,
      text: "Fast & clean",
      publishedAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      ownerReply: null,
      avatarUrl: ""
    }]
  });

  assert.match(rendered, /data-google-reviews-state="ready"/);
  assert.match(rendered, /A &lt;Customer&gt;/);
  assert.match(rendered, /Fast &amp; clean/);
  assert.match(rendered, /Based on 1 Google reviews/);
});

test("keeps long owner responses compact until the reader expands them", () => {
  const html = '<main data-google-reviews-state="empty"><!-- GOOGLE_REVIEWS_SUMMARY --><!-- GOOGLE_REVIEWS_LIST --></main>';
  const longReply = "Thank you for choosing Apex Service Group. ".repeat(8).trim();
  const rendered = injectGoogleReviewsIntoHtml(html, {
    averageRating: 5,
    totalReviewCount: 1,
    reviews: [{
      id: "1",
      author: "Customer",
      rating: 5,
      text: "Great service",
      publishedAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      ownerReply: { text: longReply, updatedAt: "2026-08-02T00:00:00Z" },
      avatarUrl: ""
    }]
  });

  assert.match(rendered, /<details class="google-review-reply google-review-reply-expandable">/);
  assert.match(rendered, /Read response/);
  assert.match(rendered, /Hide response/);
  assert.match(rendered, /google-review-reply-preview/);
  assert.match(rendered, new RegExp(longReply.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("limits server-rendered reviews for service page previews", () => {
  const html = '<main data-google-reviews-state="empty"><!-- GOOGLE_REVIEWS_LIST --></main>';
  const reviews = Array.from({ length: 4 }, (_, index) => ({
    id: String(index + 1),
    author: `Customer ${index + 1}`,
    rating: 5,
    text: `Review ${index + 1}`,
    publishedAt: `2026-08-0${index + 1}T00:00:00Z`,
    updatedAt: `2026-08-0${index + 1}T00:00:00Z`,
    ownerReply: null,
    avatarUrl: ""
  }));
  const rendered = injectGoogleReviewsIntoHtml(html, { reviews }, { limit: 3 });

  assert.match(rendered, /Customer 1/);
  assert.match(rendered, /Customer 3/);
  assert.doesNotMatch(rendered, /Customer 4/);
});
