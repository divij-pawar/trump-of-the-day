// WebSocket concurrency test: hold CONNECTIONS live connections open at once and
// measure application-level ping/pong round trips while they're all connected.
//
//   k6 run loadtest/websocket.js
//   k6 run -e CONNECTIONS=2000 -e BASE_URL=https://dxxxx.cloudfront.net loadtest/websocket.js
//
// While it runs, trigger a broadcast to measure fan-out to every client, e.g.
//   docker compose exec postgres psql -U owner -d news -c "NOTIFY news_updated, '2025-03-01'"
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import ws from "k6/ws";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws";
const CONNECTIONS = Number(__ENV.CONNECTIONS || 1000);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 60);
// The API only accepts WebSockets from the site's origins (WS_ALLOWED_ORIGINS).
const ORIGIN = __ENV.ORIGIN || "http://localhost:5173";

const rtt = new Trend("ws_ping_rtt", true);
const updates = new Counter("ws_news_updates_received");
const hellos = new Counter("ws_hello_received");

export const options = {
  scenarios: {
    hold: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { target: CONNECTIONS, duration: "30s" },
        { target: CONNECTIONS, duration: `${HOLD_SECONDS}s` },
        { target: 0, duration: "5s" },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    ws_connecting: ["p(95)<1000"],
    ws_ping_rtt: ["p(95)<100"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export default function () {
  const res = ws.connect(WS_URL, { headers: { Origin: ORIGIN } }, (socket) => {
    socket.on("open", () => {
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: "ping", t: Date.now() }));
      }, 5000);
      // Outlast the ramp-up too, so each VU holds one connection for the whole
      // plateau instead of reconnecting partway through; ramp-down closes them.
      socket.setTimeout(() => socket.close(), (HOLD_SECONDS + 35) * 1000);
    });

    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === "hello") hellos.add(1);
      if (msg.type === "pong") rtt.add(Date.now() - msg.t);
      if (msg.type === "news_updated") updates.add(1);
    });
  });

  check(res, { "upgraded to websocket": (r) => r && r.status === 101 });
}
