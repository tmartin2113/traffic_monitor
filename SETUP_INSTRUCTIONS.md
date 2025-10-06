# 511 Bay Area Traffic Monitor - Setup Instructions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **npm** (v9.0.0 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Code Editor** (VS Code recommended) - [Download](https://code.visualstudio.com/)

### Verify Prerequisites

```bash
# Check Node.js version (should be 18.0.0 or higher)
node --version

# Check npm version (should be 9.0.0 or higher)
npm --version

# Check Git installation
git --version
```

---

## 🚀 Quick Setup (5 minutes)

### 1. Clone or Create Repository

```bash
# Create a new directory
mkdir 511-traffic-monitor
cd 511-traffic-monitor

# Initialize git repository
git init

# Create all the files from the artifacts provided
# Copy all the provided files into their respective directories
```

### 2. Install Dependencies

```bash
# Install all required packages (uses exact versions from package.json)
npm install

# Verify installation
npm list --depth=0
```

**Expected output**: All dependencies installed with exact versions, no warnings.

### 3. Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your 511.org API key
# Use your preferred editor: nano, vim, or VS Code
nano .env
```

**Required in `.env`:**
```env
VITE_511_API_KEY=your_actual_api_key_here
```

### 4. Validate Configuration

```bash
# Test your API key works
curl "https://api.511.org/traffic/events?api_key=YOUR_KEY_HERE&limit=1"
```

**Expected response:**
```json
{
  "events": [{
    "id": "...",
    "event_type": "...",
    ...
  }]
}
```

**Error responses:**
- `401 Unauthorized`: Invalid API key
- `429 Too Many Requests`: Rate limit exceeded, wait 1 hour
- Connection errors: Check your internet connection

### 5. Start Development Server

```bash
# Run the development server
npm run dev
```

**Expected output:**
```
VITE v5.0.11  ready in 523 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
➜  press h to show help
```

The application will open at `http://localhost:3000`

---

## 🔑 Getting a 511.org API Key

1. Visit [511.org Open Data](https://511.org/open-data/token)
2. Click "Request Token"
3. Fill out the registration form:
   - Enter your email address
   - Provide your name and organization
   - Agree to the terms of service
4. Check your email for the API key
5. Add the key to your `.env` file

**API Key Limits:**
- 60 requests per hour (rolling window)
- Free for personal and educational use
- Commercial use requires approval

---

## 📁 Creating the Repository Structure

Create the following directory structure:

```
511-traffic-monitor/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD pipeline
├── public/
│   └── favicon.ico                 # Static assets
├── scripts/
│   └── check-coverage.js           # Coverage validation
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── TrafficMap.tsx
│   │   │   ├── EventMarker.tsx
│   │   │   └── MarkerCluster.tsx
│   │   ├── EventPanel/
│   │   │   ├── EventList.tsx
│   │   │   └── EventDetails.tsx
│   │   ├── FilterPanel/
│   │   │   └── FilterControls.tsx
│   │   └── shared/
│   │       ├── ErrorBoundary.tsx
│   │       └── LoadingSpinner.tsx
│   ├── hooks/
│   │   ├── useTrafficEvents.ts
│   │   └── useLocalStorage.ts
│   ├── services/
│   │   ├── api/
│   │   │   └── trafficApi.ts
│   │   ├── cache/
│   │   │   └── CacheManager.ts
│   │   └── rateLimit/
│   │       └── RateLimiter.ts
│   ├── stores/
│   │   ├── mapStore.ts
│   │   └── filterStore.ts
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── filter.types.ts
│   │   └── map.types.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   └── logger.ts
│   ├── config/
│   │   └── env.ts                  # Environment validation
│   ├── styles/
│   │   ├── globals.css
│   │   └── map.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env                            # Your local environment (DO NOT COMMIT)
├── .env.example                    # Environment template (commit this)
├── .eslintrc.cjs                   # Linting configuration
├── .gitignore                      # Git ignore rules
├── index.html                      # Main HTML file
├── package.json                    # Dependencies
├── postcss.config.js               # PostCSS configuration
├── README.md                       # Project documentation
├── tailwind.config.js              # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript configuration
├── tsconfig.node.json              # TypeScript Node configuration
└── vite.config.ts                  # Vite bundler configuration
```

---

## ✅ Post-Setup Verification

### Automated Verification

Run the verification script:

```bash
# Run all checks
npm run lint && npm run type-check && npm run test:run
```

**Expected output:**
- ✅ Linting: 0 errors, 0 warnings
- ✅ Type checking: No TypeScript errors
- ✅ Tests: All tests passing

### Manual Verification Checklist

#### 1. **Development Server**
- [ ] Server starts without errors
- [ ] Browser opens to `http://localhost:3000`
- [ ] No console errors in browser DevTools (F12)

#### 2. **Map Display**
- [ ] Map loads and shows Bay Area region
- [ ] Zoom controls work (+ and - buttons)
- [ ] Can pan the map by clicking and dragging
- [ ] Geofence boundaries visible (optional purple outline)

#### 3. **Traffic Events**
- [ ] Purple markers appear on map within 30-60 seconds
- [ ] Clicking a marker shows event details
- [ ] Event panel on right side displays event list
- [ ] Event count shows in header (e.g., "45 Events")

#### 4. **Filters**
- [ ] Filter panel visible on left side
- [ ] Can toggle event types (Construction, Accident, etc.)
- [ ] Map updates when filters change
- [ ] "Show Closures Only" filter works
- [ ] "Clear Filters" button resets all

#### 5. **Performance Indicators**
- [ ] Rate limit counter in footer shows "60 remaining" initially
- [ ] After first API call, rate limit decrements
- [ ] Cache indicator shows "Cached" for subsequent requests
- [ ] Last updated timestamp displays correctly

#### 6. **Responsiveness**
- [ ] Layout adjusts on window resize
- [ ] Mobile view: filter panel becomes collapsible
- [ ] No horizontal scrollbar
- [ ] Touch events work on mobile (if testing on device)

### Expected Behavior

**First Load (No Cache):**
```
1. Map renders empty                 (0-1s)
2. Loading spinner shows             (0-2s)
3. API request sent                  (1-2s)
4. Events appear on map              (2-3s)
5. Rate limit: 59 remaining
6. Cache: Active (30s TTL)
```

**Subsequent Loads (With Cache):**
```
1. Map renders with cached events    (0-1s)
2. No loading spinner                (instant)
3. No API request                    (cached)
4. Rate limit: Unchanged
5. Cache: Serving from cache
```

### Performance Benchmarks

Run a Lighthouse audit:

```bash
# Build and preview production version
npm run build
npm run preview

# Open browser to http://localhost:4173
# Press F12 → Lighthouse tab → Run audit
```

**Expected Scores (minimum):**
- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: ≥90

**Load Time Targets:**
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Time to Interactive: <3.0s
- Total Blocking Time: <200ms

---

## 🐛 Troubleshooting

### Common Issues and Solutions

#### Issue 1: API Key Not Working

**Symptoms:**
- No events appear on map
- Console error: `401 Unauthorized`
- Error message: "Invalid API key"

**Solutions:**
```bash
# 1. Verify API key is in .env file
cat .env | grep VITE_511_API_KEY

# 2. Ensure no extra spaces or quotes
# CORRECT:   VITE_511_API_KEY=abc123xyz
# INCORRECT: VITE_511_API_KEY="abc123xyz"
# INCORRECT: VITE_511_API_KEY = abc123xyz

# 3. Test API key directly
curl "https://api.511.org/traffic/events?api_key=YOUR_KEY&limit=1"

# 4. Restart development server after changing .env
# Press Ctrl+C to stop
npm run dev
```

#### Issue 2: Build Errors

**Symptoms:**
- `npm install` fails
- TypeScript errors during build
- Module not found errors

**Solutions:**
```bash
# 1. Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# 2. Clear build cache
rm -rf dist .vite
npm run build

# 3. Check Node.js version
node --version  # Should be 18.0.0 or higher

# 4. Update npm
npm install -g npm@latest
```

#### Issue 3: TypeScript Errors

**Symptoms:**
- Red squiggly lines in VS Code
- Build fails with type errors
- `tsc` command shows errors

**Solutions:**
```bash
# 1. Run type checker
npm run type-check

# 2. Check for missing type definitions
npm install --save-dev @types/react @types/react-dom

# 3. Restart TypeScript server in VS Code
# Press: Ctrl+Shift+P (or Cmd+Shift+P on Mac)
# Type: "TypeScript: Restart TS Server"
```

#### Issue 4: Map Not Loading

**Symptoms:**
- Gray/blank map area
- Console error: "Failed to load Leaflet CSS"
- Map tiles not appearing

**Solutions:**
```bash
# 1. Check browser console for errors (F12)

# 2. Verify Leaflet CSS is loaded
# Open DevTools → Network tab → Filter by CSS
# Should see: leaflet.css (Status 200)

# 3. Check internet connectivity
# Leaflet uses OpenStreetMap tiles from the internet

# 4. Clear browser cache
# In Chrome: Ctrl+Shift+Delete → Clear cache
```

#### Issue 5: Rate Limiting Issues

**Symptoms:**
- No new events loading
- Console error: `429 Too Many Requests`
- Rate limit counter shows 0

**Solutions:**
```bash
# The app respects 511.org's rate limit (60 requests/hour)

# 1. Check rate limit status in UI footer
# Shows: "Rate Limit: X remaining (Resets at HH:MM)"

# 2. Wait for reset time
# Rate limit resets every hour on a rolling window

# 3. Check localStorage for rate limit data
# Open DevTools → Application → Local Storage
# Key: "rate-limit-state"

# 4. Clear rate limit (for testing only)
localStorage.removeItem('rate-limit-state');
window.location.reload();
```

#### Issue 6: Port Already in Use

**Symptoms:**
- Error: `Port 3000 is already in use`
- Development server won't start

**Solutions:**
```bash
# Option 1: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use a different port
VITE_DEV_SERVER_PORT=3001 npm run dev

# Option 3: Add to .env file
echo "VITE_DEV_SERVER_PORT=3001" >> .env
```

### Getting More Help

**Check Logs:**
```bash
# Development server logs
npm run dev -- --debug

# Browser console logs
# Press F12 → Console tab

# Check for errors in:
# - Application tab (Service Workers, Storage)
# - Network tab (Failed requests)
# - Sources tab (Breakpoints for debugging)
```

**Verify File Structure:**
```bash
# List all source files
find src -type f -name "*.ts" -o -name "*.tsx"

# Check for missing files
ls -la src/components/Map/
ls -la src/services/api/
```

---

## 📊 Monitoring & Logs

### Development Logs

```bash
# View development server logs with debug info
npm run dev -- --debug

# Check browser console for client-side errors
# Press F12 in Chrome → Console tab
```

### Production Monitoring

- **Vercel Analytics**: View performance metrics in Vercel dashboard
- **Error Tracking**: Check Vercel Functions logs for API errors
- **Rate Limit Monitoring**: View rate limit usage in app UI footer

---

## 🔄 Updates and Maintenance

### Update Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all dependencies to latest allowed versions
# (respects exact versions in package.json)
npm update

# Update specific package to latest version
npm install package-name@latest --save-exact

# After updates, run tests
npm run test:run
```

### Update 511.org API

The 511.org API may change. Check for updates:

1. Visit [511.org Open Data Documentation](https://511.org/open-data/traffic)
2. Check `src/types/api.types.ts` for current schema
3. Update types if API response structure changes
4. Update `src/services/api/trafficApi.ts` if endpoints change

### Database Migrations

The app uses **localStorage** for persistence. No database setup required.

If you need to clear all local data:

```javascript
// Run in browser console (F12)
localStorage.clear();
window.location.reload();
```

---

## 📝 Next Steps

### Customization

1. **Customize the geofence area** in `src/utils/constants.ts`
   ```typescript
   export const GEOFENCE = {
     BBOX: {
       xmin: -122.57031250,  // Adjust longitude
       ymin: 37.21559028,    // Adjust latitude
       xmax: -121.66525694,
       ymax: 37.86217361,
     }
   };
   ```

2. **Add custom event types** in `src/types/api.types.ts`

3. **Modify filter presets** in `src/types/filter.types.ts`

4. **Adjust polling interval** in `.env` file
   ```env
   VITE_POLL_INTERVAL=120000  # 2 minutes
   ```

5. **Configure deployment** for your preferred platform (see README.md)

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   npm run lint
   npm run type-check
   npm run test:run
   ```

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

---

## 🆘 Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/511-traffic-monitor/issues)
- **511.org Support**: [API-related questions](https://511.org/open-data/token)
- **Stack Overflow**: Tag questions with `leaflet`, `react`, `typescript`
- **Documentation**: Check `README.md` for comprehensive project info

---

## ✅ Final Verification Checklist

Before considering setup complete, verify:

### Code Quality
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] All tests pass: `npm run test:run`
- [ ] Coverage meets threshold: `npm run test:coverage-check`

### Functionality
- [ ] Node.js 18+ installed and verified
- [ ] Repository created with all files
- [ ] Dependencies installed successfully
- [ ] 511.org API key obtained and configured
- [ ] `.env` file exists and is valid
- [ ] Development server runs without errors
- [ ] Map loads with Bay Area boundaries
- [ ] Traffic events appear on map within 60s
- [ ] Filters work correctly
- [ ] No console errors in browser DevTools

### Performance
- [ ] Initial load: <3 seconds (simulated 3G)
- [ ] Lighthouse performance score: ≥90
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] Build size: <2MB (check `dist/` folder after `npm run build`)

### Security
- [ ] No hardcoded API keys in source code
- [ ] `.env` file is in `.gitignore`
- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] No sensitive data in git history

---

## 🎉 Success!

If you've completed all verification steps, you now have a **production-ready** 511 Bay Area Traffic Monitor running locally!

**Your application:**
- ✅ Displays real-time traffic events on an interactive map
- ✅ Filters events by type, severity, and closure status
- ✅ Respects API rate limits automatically (60/hour)
- ✅ Caches data for optimal performance (30s TTL)
- ✅ Updates every 60 seconds with fresh data
- ✅ Meets all production-ready standards

**Visit** `http://localhost:3000` **to see your application in action!**

---

**Ready to deploy?** Check the deployment section in `README.md` for instructions on deploying to Vercel, Netlify, or other platforms.

**Need more help?** Open an issue on GitHub or check the troubleshooting section above.
