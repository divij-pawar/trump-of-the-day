# Trump of the Day Dashboard

A modern dashboard application that displays daily updates with a calendar interface and dark/light mode support.

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
3. Run the migration script in the Supabase dashboard SQL editor:
   - Copy the contents of `supabase/migrations/create_updates_table.sql`
   - Paste and run in the Supabase SQL editor

## Project Structure

- `src/` - Source code
  - `components/` - Reusable UI components
  - `context/` - React context providers
  - `hooks/` - Custom React hooks
  - `lib/` - Utility functions and libraries
  - `types/` - TypeScript type definitions
- `supabase/` - Supabase configuration and migrations
- `public/` - Static assets

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Supabase
- date-fns
- Lucide React (for icons)

## License

This project is licensed under the MIT License.