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

    subgraph google["☁️ Google Cloud: the live site (~$0/month)"]
        firebase["🌐 Firebase Hosting<br/>website + CDN cache"]
        api["⚙️ API<br/>Cloud Run, sleeps when idle"]
    end

    db[("🗄️ Neon Postgres<br/>news, summaries,<br/>search vectors")]

    subgraph daily["🕑 GitHub Actions: daily robot"]
        pipeline["🐍 News pipeline<br/>Python"]
    end

    subgraph outside["🌍 Outside services"]
        sources["📰 GDELT +<br/>Google News"]
        openrouter["🤖 OpenRouter<br/>Free Router"]
        voyage["🧭 Voyage AI<br/>embeddings"]
    end

    visitor -->|"opens the site"| firebase
    firebase -->|"/api requests"| api
    api -->|"reads only"| db

    pipeline -->|"1 · fetch headlines"| sources
    pipeline -->|"2 · write summary"| openrouter
    pipeline -->|"3 · make search vectors"| voyage
    pipeline -->|"4 · save everything"| db
```

| Piece | In one sentence |
|---|---|
| **Firebase Hosting** | Serves the website and keeps copies of recent answers, so most visits never wake the API. |
| **API (Cloud Run)** | A small server that answers "what's the news for this day?" and shuts itself off when nobody is asking. |
| **Neon Postgres** | The database: every article, each day's summary, and the vectors that power search. |
| **News pipeline** | Runs once a day on GitHub's computers: scrapes, ranks, summarizes and saves. |
| **OpenRouter Free Router** | Picks a free AI model to write the day's summary. The site shows which model wrote it. |
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
    pick["🎲 The router picks an available free model,<br/>which writes the summary"]
    store["📝 Save the summary and<br/>the name of the model that wrote it"]
    done(["✅ Done until tomorrow"])

    start --> fetch --> clean --> rank --> save --> embed --> summarize --> pick --> store --> done
```

If the AI step fails, the day still gets its news list, just without a summary.

---

## 3. What happens when someone opens the site

```mermaid
sequenceDiagram
    actor V as 👤 Visitor
    participant F as 🌐 Firebase Hosting
    participant A as ⚙️ API on Cloud Run
    participant D as 🗄️ Neon database

    V->>F: Open trumpoftheday site
    F-->>V: Website files (from the CDN)
    V->>F: News for March 1?
    alt Firebase already has a fresh copy
        F-->>V: Cached answer (instant)
    else Not cached yet
        F->>A: Forward the request
        Note over A: Wakes up if it was asleep
        A->>D: Stories + summary for March 1
        D-->>A: Rows
        A-->>F: Answer (keep for 1–5 min)
        F-->>V: Answer
    end
    Note over V: Shows the summary card<br/>"Summarized by ‹model› (free model via OpenRouter)"<br/>followed by the ranked stories
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
    site["🌐 Firebase Hosting<br/>publishes new website"]

    dev --> ci -->|"all green"| deploy
    deploy --> image --> run
    deploy --> site
```

GitHub logs into Google Cloud with **Workload Identity Federation**: a short-lived pass issued per run, so no password or key is stored anywhere.

---

## 5. Two clouds, same app

The application code is identical. Only where it runs differs, and both are described in Terraform.

```mermaid
flowchart TB
    code["📁 Same code<br/>website + API + pipeline"]

    subgraph gcp["☁️ Google Cloud: LIVE, ~$0/month"]
        direction LR
        g1["Firebase Hosting"] --> g2["Cloud Run<br/>0–2 instances"]
    end

    subgraph aws["☁️ AWS: ON DEMAND, ~$70/month while up"]
        direction LR
        a1["CloudFront + S3"] --> a2["Load balancer"] --> a3["ECS Fargate<br/>2+ always on"]
        a3 --> a4["Redis cache"]
    end

    code -->|"infra/gcp"| gcp
    code -->|"infra/aws"| aws
```

| | Google Cloud (live) | AWS (on demand) |
|---|---|---|
| Purpose | Run the real site cheaply | Show the full, always-on version for demos and load tests |
| Cost | About $0/month | About $2.30 per day while it's up |
| Scales by | Starting instances on demand, down to zero | Keeping 2+ servers running, adding more under load |
| Extras | — | Redis cache, live updates over WebSockets |
| Turn on / off | Always on | `terraform apply` / `terraform destroy` |

More detail: [infrastructure](docs/infrastructure.md) · [costs](docs/costs.md) · [API](docs/api.md) · [load tests](docs/load-testing.md)
