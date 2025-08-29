# 🚀 Deployment Guide for newfurniture.live

## Current Status
✅ Code is ready
✅ Cloudinary configured (credentials in .env.example)
⏳ Waiting: Database setup
⏳ Waiting: Vercel deployment
⏳ Waiting: Domain configuration

## Next Steps (In Order)

### Step 1: Create Planetscale Database (5 minutes)

1. Go to [planetscale.com](https://planetscale.com)
2. Sign up/login with GitHub
3. Click "Create database"
4. Name it: `ar-furniture`
5. Select: Free tier
6. Region: Choose closest to you
7. Click "Create database"

8. Once created, click "Connect"
9. Choose: "Connect with Node.js"
10. Copy the DATABASE_URL (looks like: `mysql://xxxxx@aws.connect.psdb.cloud/ar-furniture?ssl={"rejectUnauthorized":true}`)

11. Click on "Console" tab and run this SQL:
```sql
CREATE TABLE models (
    id VARCHAR(10) PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    filename VARCHAR(255),
    cloudinary_url TEXT,
    cloudinary_public_id VARCHAR(255),
    file_size BIGINT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INT DEFAULT 0,
    metadata JSON
);
```

### Step 2: Update Local Environment (2 minutes)

1. Rename `.env.example` to `.env.local`:
```bash
mv .env.example .env.local
```

2. Edit `.env.local` and add your Planetscale DATABASE_URL:
```
DATABASE_URL=mysql://xxxxx@aws.connect.psdb.cloud/ar-furniture?ssl={"rejectUnauthorized":true}
```

### Step 3: Test Locally (5 minutes)

```bash
# Install dependencies
npm install

# Run locally
npm run dev
```

Visit http://localhost:3000 and test:
- Upload a small GLB file
- View it in AR
- Check admin panel

### Step 4: Deploy to Vercel (10 minutes)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

Answer the prompts:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- Project name? **ar-furniture**
- Directory? **./ar-platform**
- Override settings? **No**

4. Add environment variables:
```bash
# Add each variable
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
vercel env add DATABASE_URL
vercel env add ADMIN_PASSWORD
vercel env add DOMAIN
```

5. Deploy to production:
```bash
vercel --prod
```

### Step 5: Configure Custom Domain (5 minutes)

1. In Vercel Dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add domain: `newfurniture.live`
4. Choose: Add `newfurniture.live`

5. Update your domain DNS:
   - Go to your domain registrar
   - Add Vercel's DNS records:
     ```
     Type: A
     Name: @
     Value: 76.76.21.21
     
     Type: CNAME
     Name: www
     Value: cname.vercel-dns.com
     ```

6. Wait for DNS propagation (5-30 minutes)

### Step 6: Final Testing

Once deployed, test the full flow:

1. **Upload Test**: https://newfurniture.live
   - Upload a GLB file
   - Copy the generated link

2. **AR View Test**: Open link on phone
   - Must use Safari (iOS) or Chrome (Android)
   - Tap "View in Your Space"
   - Place furniture in your room

3. **Admin Test**: https://newfurniture.live/admin
   - Enter password: FurnitechMVP
   - View uploaded models
   - Test delete function

## Troubleshooting

### "Database connection failed"
- Check DATABASE_URL is correct in Vercel env vars
- Ensure Planetscale database is active (not sleeping)
- Try waking database from Planetscale dashboard

### "Upload failed"
- Check Cloudinary credentials
- Verify file is under 100MB
- Check Vercel function logs

### Domain not working
- DNS can take up to 48 hours
- Verify DNS records are correct
- Check Vercel domain settings

## Monitoring

### Vercel Dashboard
- Function logs: See all API calls
- Analytics: Track usage
- Errors: Debug issues

### Cloudinary Dashboard
- Storage usage (25GB free)
- Bandwidth usage (25GB/month free)
- Transformation credits

### Planetscale Dashboard
- Query insights
- Database metrics
- Connection status

## Commands Reference

```bash
# Local development
npm run dev

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# Add environment variable
vercel env add KEY_NAME

# List environment variables
vercel env ls
```

## Support Contacts

- **Vercel Support**: support.vercel.com
- **Cloudinary Support**: support.cloudinary.com
- **Planetscale Support**: planetscale.com/support

---

**Ready to Deploy!** 🎉

Total time needed: ~30 minutes
Your platform will be live at: https://newfurniture.live