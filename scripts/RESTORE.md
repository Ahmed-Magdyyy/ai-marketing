# Disaster Recovery & Restore Runbook

> **Platform:** AI Marketing Agency  
> **Last Updated:** 2026-03-08  
> **RTO Target:** < 1 hour (MongoDB), < 2 hours (Qdrant), < 30 min (R2)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [MongoDB Restore (Atlas)](#mongodb-restore-atlas)
3. [Qdrant Restore (Snapshot)](#qdrant-restore-snapshot)
4. [R2 Object Recovery (Cloudflare)](#r2-object-recovery-cloudflare)
5. [Post-Restore Verification](#post-restore-verification)

---

## Prerequisites

- `mongosh` CLI installed (or Atlas UI access)
- `curl` for Qdrant snapshot API
- AWS CLI / `wrangler` for R2 access
- `.env` with all production credentials loaded
- **Kill Switch:** Set `KILL_ALL=true` during restore to prevent writes

```bash
# Activate read-only mode before restoring
export KILL_ALL=true
# Restart application
pm2 restart all   # or docker compose restart
```

---

## MongoDB Restore (Atlas)

### Option A — Atlas UI Point-in-Time Restore

1. Go to **Atlas → Cluster → Backup → Restore**
2. Select **Point-in-Time** and choose a timestamp **before** the incident
3. Choose **Restore to this cluster** (in-place) or a staging cluster
4. Wait for restore to complete (usually 10–40 min depending on size)
5. Verify data via `mongosh`:

```bash
mongosh "$MONGODB_URI" --eval "db.users.countDocuments()"
mongosh "$MONGODB_URI" --eval "db.brands.countDocuments()"
mongosh "$MONGODB_URI" --eval "db.contentplans.countDocuments()"
```

### Option B — Atlas Snapshot Restore

1. Go to **Atlas → Cluster → Backup → Snapshots**
2. Select the most recent snapshot **before** the incident
3. Click **Restore** → choose target cluster
4. Wait for completion

### Option C — `mongodump` / `mongorestore` (Self-managed backup)

```bash
# Restore from a local dump directory
mongorestore --uri="$MONGODB_URI" --drop ./backup/dump/

# Restore a specific collection
mongorestore --uri="$MONGODB_URI" --drop \
  --nsInclude="ai-marketing.users" ./backup/dump/
```

### RTO: ~30–60 minutes

---

## Qdrant Restore (Snapshot)

### Step 1 — List Available Snapshots

Check R2 for uploaded snapshots (created by `scripts/backup-qdrant.ts`):

```bash
# List snapshots in R2
aws s3 ls s3://$R2_BUCKET/backups/qdrant/ \
  --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

### Step 2 — Download Snapshot from R2

```bash
aws s3 cp \
  s3://$R2_BUCKET/backups/qdrant/<snapshot-file>.snapshot \
  ./qdrant-restore.snapshot \
  --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

### Step 3 — Upload Snapshot to Qdrant

```bash
# Replace QDRANT_URL and COLLECTION_NAME with actual values
curl -X POST "$QDRANT_URL/collections/$COLLECTION_NAME/snapshots/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "snapshot=@./qdrant-restore.snapshot"
```

### Step 4 — Verify Qdrant Data

```bash
# Check collection info
curl "$QDRANT_URL/collections/$COLLECTION_NAME" | jq '.result.points_count'
```

### RTO: ~1–2 hours (depends on snapshot size and transfer speed)

---

## R2 Object Recovery (Cloudflare)

R2 supports **object versioning**. If versioning is enabled:

### Recover a Specific Object

```bash
# List object versions
aws s3api list-object-versions \
  --bucket $R2_BUCKET \
  --prefix "uploads/some-file.png" \
  --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com

# Restore a specific version (copy it back as the latest)
aws s3api copy-object \
  --bucket $R2_BUCKET \
  --copy-source "$R2_BUCKET/uploads/some-file.png?versionId=VERSION_ID" \
  --key "uploads/some-file.png" \
  --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

### Bulk Recover (from B2 development backup)

If production R2 data is lost and a B2 development copy exists:

```bash
# Sync from B2 to R2 (use rclone for cross-provider sync)
rclone sync b2:$B2_BUCKET r2:$R2_BUCKET --transfers 16 --progress
```

### RTO: ~10–30 minutes (single objects), ~1–4 hours (full bucket)

---

## Post-Restore Verification

Run these checks **after every restore operation** before disabling read-only mode:

### 1. Health Check

```bash
curl http://localhost:3000/api/health | jq .
# Expect: { "status": "ok", "mongo": true, "redis": true }
```

### 2. Readiness Probe

```bash
curl http://localhost:3000/api/health/ready | jq .
# Expect: { "ready": true }
```

### 3. Data Integrity Spot Checks

```bash
mongosh "$MONGODB_URI" <<'EOF'
print("Users:", db.users.countDocuments());
print("Brands:", db.brands.countDocuments());
print("Content Plans:", db.contentplans.countDocuments());
print("Transactions:", db.transactions.countDocuments());
print("Social Accounts:", db.socialaccounts.countDocuments());
EOF
```

### 4. Disable Read-Only Mode

```bash
# Remove kill switch
unset KILL_ALL
# or set KILL_ALL=false in .env

# Restart
pm2 restart all   # or docker compose restart
```

### 5. Monitor

- Watch application logs for 15 minutes
- Check `/metrics` for error rate spikes
- Verify Slack alerts are not firing

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| DB Admin | (fill in) |
| DevOps Lead | (fill in) |
| Project Owner | (fill in) |

---

> **Note:** Always test restore procedures in staging before applying to production. Schedule quarterly restore drills.
