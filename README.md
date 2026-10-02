# Kinpin Arts CRM

Clients, opportunities, quotations, invoices, ZMW currency, editable document numbers, and downloadable PDFs. Built with Next.js and a MySQL database, and designed to run on cPanel's **Setup Node.js App**.

## Deploying to cPanel

You need a cPanel account with **Setup Node.js App** (Node 20.9 or newer; 22 is best) and **MySQL Databases**.

### 1. Create the database
1. In cPanel open **MySQL Databases**. Create a database and a user, and add the user to the database with **All Privileges**.
2. cPanel prefixes both names with your account name, for example `acct_crm` and `acct_crmuser`. Note them and the password.

### 2. Build the upload on your computer
```bash
pnpm install
pnpm package:cpanel
```
This creates a `cpanel-deploy/` folder (about 20 MB). Zip its contents.

### 3. Create the Node.js app
1. Open **Setup Node.js App** and choose **Create Application**.
2. Pick the Node version, set **Application mode** to Production, choose an **Application root** such as `kinpin-crm`, and set the **Application URL**.
3. Set **Application startup file** to `server.js`.
4. Add these environment variables:

| Name | Value |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_NAME` | your database name |
| `DB_USER` | your database user |
| `DB_PASSWORD` | your database password |
| `SESSION_SECRET` | a random string of 32+ characters |

Generate the secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### 4. Upload and install
1. In **File Manager**, upload the zip into the application root and extract it, so `server.js` and `package.json` sit directly in that folder.
2. Back in **Setup Node.js App**, click **Run NPM Install**, then **Restart**.

### 5. Create the tables, your login, and import your data
The setup scripts run from your own computer against the cPanel database:

1. In cPanel enable **Remote MySQL** and add your computer's IP address.
2. Copy `.env.example` to `.env.local`, set `DB_HOST` to your server's hostname, and fill in the other `DB_*` values.
3. Run:

```bash
pnpm db:migrate
pnpm user:create you@example.com 'a-long-password' 'Your Name'
pnpm db:import
```

`db:migrate` creates the tables (or paste `sql/schema.sql` into **phpMyAdmin** instead). `user:create` makes your login; run it again with the same email to reset a password. `db:import` loads `backup/records.json` (your saved records), keeping the original ids and skipping records that already exist.

Then open your Application URL and sign in.

## Local development
```bash
pnpm install
cp .env.example .env.local   # fill in the database details
pnpm db:migrate
pnpm user:create you@example.com 'a-long-password'
pnpm dev                     # http://localhost:3000
```

You need a MySQL or MariaDB server to develop against: either one installed locally (XAMPP works), or your cPanel database with Remote MySQL enabled.

## Notes
- `backup/records.json` contains private business information. It is excluded from git; keep it private.
- Sessions last 7 days. Login cookies are `Secure`, so the site must be served over https (cPanel's AutoSSL is enough).
- To add another user, or reset a password, run `user:create` again with that email.
- To update the site later, run `pnpm package:cpanel`, upload the new `.next` folder and `public` folder over the old ones, and restart the app.
