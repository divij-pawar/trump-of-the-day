// HTTP load test for the news API.
//
//   k6 run loadtest/http.js                               # local stack (docker compose)
//   k6 run -e BASE_URL=https://dxxxx.cloudfront.net loadtest/http.js
//   k6 run -e RATE=800 -e HOT_SHARE=0.9 loadtest/http.js
//
// Traffic model: most visitors open the newest day ("hot" dates); the rest browse
// the archive, which spreads requests over hundreds of cold cache keys. That mix
// is what makes the Redis cache and the API's single-flight loading matter.
import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const RATE = Number(__ENV.RATE || 300); // requests per second at the plateau
const HOT_SHARE = Number(__ENV.HOT_SHARE || 0.8);
const DURATION = __ENV.DURATION || "2m";

const newsLatency = new Trend("news_latency", true);

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: RATE, duration: "30s" },
        { target: RATE, duration: DURATION },
        { target: 0, duration: "10s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:news}": ["p(95)<250", "p(99)<500"],
    "http_req_duration{endpoint:latest}": ["p(95)<150"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const FIRST_DAY = Date.UTC(2025, 0, 20);

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function setup() {
  const res = http.get(`${BASE_URL}/api/dates/latest`);
  check(res, { "latest date available": (r) => r.status === 200 && r.json("date") });
  const latest = res.json("date") || isoDay(Date.now());
  const latestMs = Date.parse(`${latest}T00:00:00Z`);
  return { latestMs, archiveDays: Math.floor((latestMs - FIRST_DAY) / 86_400_000) };
}

export default function (data) {
  if (Math.random() < 0.1) {
    const res = http.get(`${BASE_URL}/api/dates/latest`, { tags: { endpoint: "latest" } });
    check(res, { "latest 200": (r) => r.status === 200 });
    return;
  }

  const dayOffset =
    Math.random() < HOT_SHARE
      ? Math.floor(Math.random() * 2) // today or yesterday
      : Math.floor(Math.random() * (data.archiveDays + 1));
  const date = isoDay(data.latestMs - dayOffset * 86_400_000);

  const res = http.get(`${BASE_URL}/api/news?date=${date}`, { tags: { endpoint: "news" } });
  newsLatency.add(res.timings.duration);
  check(res, {
    "news 200": (r) => r.status === 200,
    "news has items": (r) => r.status !== 200 || Array.isArray(r.json("items")),
  });
}
