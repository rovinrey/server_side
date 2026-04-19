# Railway Deployment Guide - Production Ready

## 🎯 Quick Start for Railway Deployment

### Prerequisites
- GitHub repository connected to Railway
- MySQL database service on Railway

---

## 📋 Step 1: Check Your Railway MySQL Service Variables

Go to **Railway Dashboard → Your Project → MySQL Service → Variables**

You should see these auto-provided by Railway:
- `MYSQLUSER` (usually "root")
- `MYSQLPASSWORD` (your generated password)
- `MYSQLHOST` (e.g., "mysql.railway.internal")
- `MYSQLPORT` (usually 3306)
- `MYSQL_DATABASE` (e.g., "railway")

---

## 🔐 Step 2: Configure Node.js Backend Service on Railway

Go to **Railway Dashboard → Your Project → Backend Service → Variables**

Add these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `JWT_SECRET` | *(your secret key)* |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:5174,http://localhost:5175,https://peso-juban.vercel.app` |

**IMPORTANT:** Do NOT manually set database variables (MYSQLUSER, MYSQLPASSWORD, etc.) in the Backend service. They are automatically inherited from the MySQL service in Railway's internal network.

---

## ✅ Step 3: Deploy

1. Railway auto-deploys when you push to the connected branch
2. Watch the deployment logs for:
   ```
   🔧 Database Config: PRODUCTION mode
   ✓ Using Railway production variables
   ✅ Database connected successfully!
   🚀 Server running on port 8080
   ```

---

## 🏠 Local Development Setup

### Setup

1. **Uncomment these lines in `.env`:**
   ```env
   NODE_ENV=development
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=capstone_db
   DB_PORT=3306
   ```

2. **Make sure you have local MySQL running:**
   - XAMPP MySQL or Docker MySQL
   - Database exists: `capstone_db`

3. **Run locally:**
   ```bash
   npm install
   npm start
   ```

3. **Expected output:**
   ```
   🔧 Database Config: DEVELOPMENT mode
   ✓ Using local development configuration
   ✅ Database connected successfully!
   ```

---

## 🐛 Troubleshooting

### Error: "Access denied for user 'root' (using password: NO)"
- **Cause:** Password variable is empty in Railway
- **Solution:** Verify MySQL service variables are set correctly in Railway

### Error: "Access denied for user 'root' (using password: YES)"
- **Cause:** Password doesn't match
- **Solution:** Make sure you're using the correct MySQL service credentials from Railway

### Error: "Cannot find database"
- **Cause:** `MYSQL_DATABASE` is not set or empty
- **Solution:** Verify `MYSQL_DATABASE=railway` in Railway MySQL variables

### Can't connect locally
- **Cause:** Local MySQL not running or wrong credentials
- **Solution:** 
  1. Start MySQL locally
  2. Create database: `CREATE DATABASE capstone_db;`
  3. Verify DB_* variables in `.env`

---

## 📝 Environment Variable Reference

### Production (Railway)
Uses Railway's auto-provided variables:
- `MYSQLUSER` → root user
- `MYSQLPASSWORD` → generated password
- `MYSQLHOST` → internal host
- `MYSQLPORT` → 3306
- `MYSQL_DATABASE` → database name

### Development (Local)
Uses custom variables:
- `DB_HOST` → localhost
- `DB_USER` → root
- `DB_PASSWORD` → (empty for XAMPP default)
- `DB_NAME` → capstone_db
- `DB_PORT` → 3306

---

## ✨ Best Practices

✅ **DO:**
- Let Railway manage database credentials
- Set NODE_ENV=production on Railway
- Test locally before pushing
- Keep .env in .gitignore

❌ **DON'T:**
- Hardcode credentials
- Commit .env to git
- Use same database for dev and prod
- Forget to set NODE_ENV

---

## 🚀 Deployment Checklist

- [ ] Railway MySQL service created
- [ ] Backend service connected to Git
- [ ] `NODE_ENV=production` set in Backend variables
- [ ] All other variables configured (JWT_SECRET, CORS_ORIGIN)
- [ ] Config.js uses correct strategy for production
- [ ] Tested locally with development variables
- [ ] Pushed code to GitHub
- [ ] Deployment logs show "Database connected successfully!"

