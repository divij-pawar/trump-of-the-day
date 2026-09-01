# Trump of the Day🦅
 <em>What did he do today?</em>


<br>
<a href="https://resilient-soapwort-1d7.notion.site/1ab52d9abebe80fb845eea01a73b12c0?v=1ab52d9abebe816a83e6000c4639b1c3&pvs=4">Notion Project Dashboard </a>

## Features

- Interactive calendar for date selection
- Dynamic updates based on selected date
- Dark mode and light mode with system preference detection
- Responsive design for mobile and desktop
- Supabase integration for data storage

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up Neon:
   - Create a Neon project at [neon.tech](https://neon.tech)
   - Create the read-only role via **plain SQL** (an SQL client, not the Neon Console/API/CLI) — see `db/schema.sql` in the server repo. Console/API/CLI-created roles are automatically added to `neon_superuser`, which grants far more than read access and can't be scoped down afterward.
   - Add that role's connection string to `.env` as shown below

4. Start the development server:

```bash
npm run dev
```

## Database Setup

The application uses Neon (serverless Postgres) as its database, queried directly from the browser via a read-only role. To set up the database:

1. Create a `.env` file at the repo root
2. Add the read-only role's Neon connection string
```env
# Neon connection details (read-only role, SELECT on `news` only)
VITE_NEON_NEWS_URL=
```

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Neon (serverless Postgres)
- date-fns
- Lucide React (for icons)

## License

This project is licensed under the MIT License.