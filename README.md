# Kinpin Arts CRM

Project files for the Kinpin Arts CRM: clients, opportunities, quotations, invoices, ZMW currency, editable document numbers, and downloadable PDFs. The interface and PDFs use Poppins.

## Saved records
backup/records.json is a snapshot of your saved records. It contains private business information; keep this package in your private project storage. This is a data backup, not an automatic import.

## Running the application
Requires Node.js 22.13 or later and pnpm.
1. Extract the archive.
2. Run pnpm install --frozen-lockfile.
3. Run pnpm dev.
The application uses Cloudflare D1. Apply the included Drizzle SQL migrations to the configured database before using a fresh installation. Existing data is not automatically restored from the JSON backup.

## Access from other devices
This package contains the project source and data backup. The application has not yet been published online. The local address http://127.0.0.1:5173 only works on the computer running it. Online access requires completing the Sites deployment and transferring the saved records.
