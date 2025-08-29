# AR Furniture Platform - newfurniture.live

A serverless platform for uploading and sharing 3D furniture models with AR viewing capabilities.

## Features

- 📤 **Upload 3D Models** - Support for GLB/GLTF files up to 100MB
- 🔗 **Instant Share Links** - Generate unique URLs for each model
- 📱 **AR Viewing** - View furniture in your space using phone camera
- 📊 **Admin Dashboard** - Manage all uploaded models
- ☁️ **Serverless** - Deploys to Vercel with automatic scaling
- 🔒 **Secure Storage** - Models stored on Cloudinary CDN

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Vercel account (free)
- Cloudinary account (free)
- Planetscale account (free) or Vercel KV

### 2. Install Dependencies

```bash
cd ar-platform
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
- Cloudinary credentials from dashboard
- Planetscale database URL
- Admin password of your choice

### 4. Initialize Database

Create a new database in Planetscale and run this SQL:

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

### 5. Local Development

```bash
npm run dev
```

Visit http://localhost:3000 to test locally.

### 6. Deploy to Vercel

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy
vercel --prod
```

### 7. Configure Production Environment

In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Add all variables from `.env.local`
3. Redeploy for changes to take effect

### 8. Setup Custom Domain

In Vercel Dashboard:
1. Go to Settings → Domains
2. Add `newfurniture.live`
3. Follow DNS configuration instructions

## API Endpoints

- `POST /api/upload` - Upload new model
- `GET /api/model/[id]` - Get model file
- `GET /api/model/[id]/info` - Get model metadata
- `POST /api/model/[id]/view` - Track view
- `GET /api/models` - List all models
- `DELETE /api/models` - Delete model (requires admin password)

## Project Structure

```
ar-platform/
├── api/                # Serverless functions
│   ├── upload.js       # Handle uploads
│   ├── models.js       # List/delete models
│   └── model/          # Model-specific endpoints
├── pages/              # Frontend pages
│   ├── index.html      # Upload interface
│   ├── view.html       # AR viewer
│   └── admin.html      # Admin dashboard
├── lib/                # Utilities
│   ├── cloudinary.js   # Storage handler
│   └── database.js     # Database operations
└── public/             # Static assets
```

## Usage

### Uploading Models
1. Visit https://newfurniture.live
2. Drag & drop or select GLB/GLTF file
3. Add title and description
4. Click upload to get shareable link

### Viewing in AR
1. Open share link on phone
2. Tap "View in Your Space"
3. Point camera at floor
4. Tap to place furniture

### Admin Dashboard
1. Visit https://newfurniture.live/admin
2. View all uploaded models
3. Copy links or delete models
4. Monitor usage statistics

## Troubleshooting

### Upload fails
- Check file is GLB/GLTF format
- Ensure file is under 100MB
- Verify Cloudinary credentials

### AR not working
- Use Safari on iOS or Chrome on Android
- Ensure good lighting
- Clear flat surface needed

### Database errors
- Check Planetscale connection string
- Ensure table is created
- Verify database is active

## Support

For issues or questions, check the main project documentation or create an issue.

---

Built with ❤️ for newfurniture.live