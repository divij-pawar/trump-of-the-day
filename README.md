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

3. Set up Supabase:
   - Create a Supabase account at [supabase.com](https://supabase.com)
   - Create a new project
   - Click the "Connect to Supabase" button in the application
   - Run the migration script to create the necessary tables

4. Start the development server:

```bash
npm run dev
```

## Database Setup

The application uses Supabase as its database. To set up the database:

1. Create a `.env` file based on the `.env.example` template
2. Add your Supabase URL and anonymous key
```env
# Supabase connection details
VITE_SUPABASEURL=
VITE_SUPABASEANON_KEY=
VITE_SERVER_URL=http://localhost:3001
VITE_PORT=3000
```

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Supabase
- date-fns
- Lucide React (for icons)

## License

This project is licensed under the MIT License.