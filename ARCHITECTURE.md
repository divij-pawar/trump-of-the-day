# Architecture

A high-level picture of how Trump of the Day works. For the details (caching rules, failure handling, design decisions), see [docs/architecture.md](docs/architecture.md).

The whole system does two jobs:

1. **Once a day**, a robot collects the day's news, ranks it, and asks a free AI model to write a short summary.
2. **All day**, visitors open the site and read whatever the robot saved.

---

## 1. The big picture

```mermaid
flowchart LR
    visitor(["👤 Visitor"])

    netlify["🌐 Netlify<br/>website + CDN"]

    subgraph google["☁️ Google Cloud (~$0/month)"]
        api["⚙️ API<br/>Cloud Run, sleeps when idle"]
    end

    redis[("⚡ Upstash Redis<br/>cache + live-update channel")]

    db[("🗄️ Neon Postgres<br/>news, summaries,<br/>search vectors")]

    subgraph daily["🕑 GitHub Actions: daily robot"]
        pipeline["🐍 News pipeline<br/>Python"]
    end

    subgraph outside["🌍 Outside services"]
        sources["📰 GDELT +<br/>Google News"]
        openrouter["🤖 OpenRouter<br/>Free Router"]
        voyage["🧭 Voyage AI<br/>embeddings"]
    end

    visitor -->|"opens the site"| netlify
    netlify -->|"/api requests"| api
    visitor -.->|"live updates (WebSocket)"| api
    api --> redis
    api -->|"reads only"| db

    pipeline -->|"1 · fetch headlines"| sources
    pipeline -->|"2 · write summary"| openrouter
    pipeline -->|"3 · make search vectors"| voyage
    pipeline -->|"4 · save everything"| db
    pipeline -->|"5 · announce the new day"| redis
```

| Piece | In one sentence |
|---|---|
| **Netlify** | Serves the website from its CDN and forwards `/api` requests to the API. |
| **API (Cloud Run)** | A small server that answers "what's the news for this day?" and shuts itself off when nobody is asking. Open pages also keep a WebSocket to it for live updates. |
| **Upstash Redis** | Shared memory for the API: cached answers, rate-limit counters, and the channel the pipeline uses to say "a new day is ready". |
| **Neon Postgres** | The database: every article, each day's summary, and the vectors that power search. |
| **News pipeline** | Runs once a day on GitHub's computers: scrapes, ranks, summarizes and saves. |
| **OpenRouter Free Router** | Picks a free AI model to write the day's summary, with each sentence citing its stories. The site shows which model wrote it. |
| **Voyage AI** | Turns each headline into numbers that capture its meaning, so search can match on meaning rather than exact words. |

---

## 2. What happens every day at 14:00 UTC

```mermaid
flowchart TD
    start(["⏰ GitHub Actions starts the robot"])
    fetch["📰 Collect today's and yesterday's<br/>Trump headlines"]
    clean["🧹 Remove duplicates and<br/>non-English headlines"]
    rank["⭐ Give each story a relevance score"]
    save["💾 Save new stories to the database"]
    embed["🧭 Turn stories into search vectors<br/>(Voyage AI)"]
    summarize["🤖 Send the top 40 headlines to<br/>OpenRouter's Free Router"]
    pick["🎲 The router picks an available free model,<br/>which writes the summary, citing stories per sentence<br/>(up to 3 tries if a model runs out of tokens)"]
    store["📝 Save the summary, its citations and<br/>the name of the model that wrote it"]
    done(["✅ Done until tomorrow"])

    start --> fetch --> clean --> rank --> save --> embed --> summarize --> pick --> store --> done
```

If the AI step fails, the day still gets its news list, just without a summary. Tomorrow's run re-processes today and tries again.

---

## 3. What happens when someone opens the site

```mermaid
sequenceDiagram
    actor V as 👤 Visitor
    participant F as 🌐 Netlify
    participant A as ⚙️ API on Cloud Run
    participant R as ⚡ Upstash Redis
    participant D as 🗄️ Neon database

    V->>F: Open trumpoftheday site
    F-->>V: Website files (from the CDN)
    V->>F: News for March 1?
    F->>A: Forward the request
    Note over A: Wakes up if it was asleep
    alt Redis has a fresh copy
        R-->>A: Cached answer
    else Not cached yet
        A->>D: Stories + summary for March 1
        D-->>A: Rows
        A->>R: Keep a copy (1 min to 1 day)
    end
    A-->>F: Answer
    F-->>V: Answer
    V->>A: Open WebSocket for live updates (direct)
    Note over V: Shows the summary card, each sentence with<br/>numbered links [1] [2] to the stories it cites,<br/>"Summarized by ‹model› (free model via OpenRouter)",<br/>then the ranked stories
```

---

## 4. How a code change goes live

```mermaid
flowchart LR
    dev(["👩‍💻 Push to main"])
    ci["✅ CI<br/>tests, lint, build,<br/>Terraform checks"]
    deploy["🚀 Deploy (GCP)"]
    image["📦 New API image<br/>Artifact Registry"]
    run["⚙️ Cloud Run<br/>rolls to new version"]
    site["🌐 Netlify<br/>builds and publishes the website"]

    dev --> ci -->|"all green"| deploy
    deploy --> image --> run
    dev -->|"Netlify builds on push"| site
```

GitHub logs into Google Cloud with **Workload Identity Federation**: a short-lived pass issued per run, so no password or key is stored anywhere. Netlify builds the website by itself on every push; its build refuses to publish unless it knows where the API is.

---

## 5. Two clouds, same app

The application code is identical. Only where it runs differs, and both are described in Terraform (the website's Netlify settings are in `netlify.toml`).

```mermaid
flowchart TB
    code["📁 Same code<br/>website + API + pipeline"]

    subgraph gcp["☁️ Netlify + Google Cloud + Upstash: LIVE, ~$0/month"]
        direction LR
        g1["Netlify"] --> g2["Cloud Run<br/>0–2 instances"]
        g2 --> g3["Upstash Redis"]
    end

    subgraph aws["☁️ AWS: ON DEMAND, ~$70/month while up"]
        direction LR
        a1["CloudFront + S3"] --> a2["Load balancer"] --> a3["ECS Fargate<br/>2+ always on"]
        a3 --> a4["Redis cache"]
    end

    code -->|"infra/gcp"| gcp
    code -->|"infra/aws"| aws
```

| | Netlify + Google Cloud (live) | AWS (on demand) |
|---|---|---|
| Purpose | Run the real site cheaply | Show the full, always-on version for demos and load tests |
| Cost | About $0/month | About $2.30 per day while it's up |
| Scales by | Starting instances on demand, down to zero | Keeping 2+ servers running, adding more under load |
| Extras | Upstash Redis, live updates over WebSockets (Redis pub/sub) | ElastiCache Redis, live updates over WebSockets (Postgres LISTEN) |
| Turn on / off | Always on | `terraform apply` / `terraform destroy` |

More detail: [infrastructure](docs/infrastructure.md) · [costs](docs/costs.md) · [API](docs/api.md) · [load tests](docs/load-testing.md)
