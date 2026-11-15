# Subscription Tracker API

SubDub is a Node.js REST API for managing subscriptions and reminding users about upcoming renewals. It uses MongoDB to store accounts and subscriptions, JWTs to protect account actions, and Upstash Workflow to schedule reminder steps. Reminder emails are sent through Nodemailer.

> **Project status:** This repository is an API backend in active development. Authentication and subscription creation are implemented; some listed subscription and account routes are placeholders and are not yet full CRUD operations.

## Features

- Account registration with bcrypt password hashing and JWT authentication.
- MongoDB-backed users and subscriptions using Mongoose.
- Authenticated subscription creation and per-user subscription listing.
- Automatic renewal-date calculation when one is not supplied.
- Durable Upstash Workflow steps for reminders 7, 5, 2, and 1 day before renewal.
- HTML email templates delivered through Nodemailer and Gmail SMTP.
- Arcjet request protection middleware.

## Technology

- Node.js (20 or later recommended)
- Express 4
- MongoDB and Mongoose
- Upstash Workflow / QStash
- Nodemailer
- JWT, bcryptjs, Day.js, and dotenv

## Requirements

Before running the API, prepare:

- Node.js and npm.
- A MongoDB connection string. User registration uses a MongoDB transaction, so the MongoDB deployment must support transactions (for example, MongoDB Atlas or a local replica set).
- An Upstash QStash account for production workflows, or the QStash local development mode for local testing.
- Gmail SMTP credentials for sending reminders. Use a Google App Password when two-step verification is enabled; do not use your normal Gmail password.
- An Arcjet API key if Arcjet protection is enabled in your configuration.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file to the development environment file:

```powershell
Copy-Item .env.example .env.development.local
```

Then edit `.env.development.local` and provide the values for your environment. The development file is ignored by Git; never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Selects the environment file; use `development` locally. |
| `PORT` | Port for the Express API, for example `5500`. |
| `SERVER_URL` | Base URL used when triggering workflow callbacks. QStash must be able to reach it. |
| `DB_URI` | MongoDB connection string. |
| `JWT_SECRET` | Private signing key used for JWTs. Generate a long, random value. |
| `JWT_EXPIRES_IN` | JWT lifetime accepted by `jsonwebtoken`, for example `7d`. |
| `ARCJET_KEY` | Arcjet API key. |
| `ARCJET_ENV` | Arcjet environment label, if used by your setup. |
| `QSTASH_DEV` | Set to `true` for local QStash development mode; set to `false` in production. |
| `QSTASH_URL` | QStash API base URL. |
| `QSTASH_TOKEN` | QStash API token. |
| `QSTASH_CURRENT_SIGNING_KEY` | Current QStash request-signing key used to verify workflow callbacks. |
| `QSTASH_NEXT_SIGNING_KEY` | Next QStash request-signing key used during key rotation. |
| `EMAIL_PASSWORD` | Gmail App Password used by Nodemailer. |

For local development, `QSTASH_DEV=true` lets the Workflow SDK use its local development server. The URL and token fields are included for explicit/manual QStash configuration. For production, use the QStash URL, token, and signing keys from your Upstash console, set `QSTASH_DEV=false`, and configure `SERVER_URL` as a public HTTPS URL.

The email sender address is currently configured in `config/nodemailer.js`; ensure that the configured Gmail account matches the App Password supplied as `EMAIL_PASSWORD`.

### 3. Start the API

Development mode with automatic restart:

```bash
npm run dev
```

Normal start:

```bash
npm start
```

The root endpoint is `GET /`. The default development port in the example environment is `5500`.

## API overview

All API routes use the `/api/v1` prefix.

| Method | Path | Access | Status |
| --- | --- | --- | --- |
| `POST` | `/auth/sign-up` | Public | Implemented |
| `POST` | `/auth/sign-in` | Public | Implemented |
| `POST` | `/auth/sign-out` | Public | Placeholder |
| `POST` | `/subscriptions` | Bearer token | Implemented; creates a subscription and starts a workflow |
| `GET` | `/subscriptions/user/:id` | Bearer token for the same user | Implemented |
| `POST` | `/workflows/subscription/reminder` | QStash workflow callback | Implemented |
| Other subscription/user CRUD routes | See `routes/subscription.routes.js` and `routes/user.routes.js` | Varies | Some are placeholders |

Successful responses generally use a `success` property. Errors are passed to the shared Express error middleware.

### Authentication

Register with:

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "name": "Alex Example",
  "email": "alex@example.com",
  "password": "choose-a-strong-password"
}
```

The successful response includes a JWT at `data.token`. Send it on protected routes using:

```http
Authorization: Bearer <token>
```

### Create a subscription

```http
POST /api/v1/subscriptions
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Streaming service",
  "price": 12.99,
  "currency": "USD",
  "frequency": "monthly",
  "category": "entertainment",
  "paymentMethod": "Credit Card",
  "startDate": "2026-01-15T00:00:00.000Z"
}
```

Supported frequencies are `daily`, `weekly`, `monthly`, and `yearly`. Supported categories are `sports`, `news`, `technology`, `entertainment`, `productivity`, `education`, `health`, and `other`. Currency values are `USD`, `EUR`, or `GBP`.

The authenticated user is attached by the server; clients should not choose the subscription owner. When `renewalDate` is omitted, the model calculates it using the selected frequency. A successful response includes the created subscription under `data` and the Upstash `workflowRunId` for tracking.

### List a user's subscriptions

```http
GET /api/v1/subscriptions/user/:id
Authorization: Bearer <token>
```

The authenticated user ID must match `:id`.

## How reminder workflows work

1. The subscription controller saves a subscription in MongoDB.
2. It calls `workflowClient.trigger()` with the new subscription ID and the callback URL `${SERVER_URL}/api/v1/workflows/subscription/reminder`.
3. Upstash calls the Express workflow endpoint.
4. The workflow loads the subscription and its user, checks that the subscription is active, then schedules reminder steps for the configured days before renewal.
5. Each reminder step invokes the email utility, which selects a matching HTML template and sends it through Gmail SMTP.

QStash must be able to reach the callback URL. A local `localhost` URL is suitable only when the local QStash development setup can reach the API; hosted QStash cannot call a developer machine's private localhost. For production, deploy the API at a publicly reachable HTTPS address and set `SERVER_URL` to that address.

The `workflowRunId` confirms that the workflow was started; it does not by itself confirm that an email was delivered. Workflow and SMTP delivery failures should be checked in the application logs and the Upstash dashboard.

## Project layout

```text
config/          Environment, database integrations, and service clients
controllers/     Express handlers and the Upstash reminder workflow
database/        MongoDB connection
middlewares/     Authentication, Arcjet, and error handling
models/          Mongoose user and subscription schemas
routes/          Express API route definitions
utils/           Email templates and delivery helpers
app.js           Express application entry point
```

## Security notes

- Keep `.env.development.local`, `.env.production.local`, and all other secret files out of version control.
- Never publish JWT secrets, MongoDB credentials, QStash tokens/signing keys, or email App Passwords.
- Use a unique, high-entropy `JWT_SECRET` and rotate credentials if they are exposed.
- Use HTTPS for deployed API endpoints and configure production QStash signing keys.
- The project is still in development; review authorization, workflow callback verification, and placeholder routes before exposing it publicly.

## License

This project is distributed under the MIT License. See [LICENSE](./LICENSE).
