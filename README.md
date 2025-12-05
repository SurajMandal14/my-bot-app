 p# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Getting Started

Follow these steps to set up and run the application locally.

### Prerequisites

*   **Node.js**: Version 18.x or later.
*   **npm**: Included with Node.js (or you can use yarn/pnpm).
*   **MongoDB**: A running instance of MongoDB. You can get a free database from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).

### 1. Install Dependencies

First, install the necessary project packages using npm:

```bash
npm install
```

### 2. Set Up Environment Variables

Create a file named `.env` in the root of the project directory and add your MongoDB connection string.

```env
# .env
MONGODB_URI="your_mongodb_connection_string"
MONGODB_DB_NAME="your_database_name" # Optional, defaults to 'campusflow'
```

Replace `your_mongodb_connection_string` with the actual URI you get from your MongoDB provider (e.g., MongoDB Atlas).

### 3. Run the Development Server

The application has two main parts that run in development: the Next.js frontend/backend and the Genkit AI server for AI-powered features. You'll need to run them in separate terminal windows.

**Terminal 1: Run the Next.js App**

This command starts the main application on `http://localhost:9002`.

```bash
npm run dev
```

**Terminal 2: Run the Genkit AI Server**

This command starts the Genkit server, which makes AI flows available to the main app.

```bash
npm run genkit:dev
```

Once both are running, open your browser and navigate to `http://localhost:9002` to see the application.

### 4. Build and Run for Production

To create a production-ready build of the application, run the following command:

```bash
npm run build
```

This will create an optimized version of your app in the `.next` directory. To run this production version, use:

```bash
npm run start
```

This will start the application on the default port (usually `3000`).
