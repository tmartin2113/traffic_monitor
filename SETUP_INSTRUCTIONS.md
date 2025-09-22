# 511 Bay Area Traffic Monitor - Setup Instructions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **npm** (v9.0.0 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Code Editor** (VS Code recommended) - [Download](https://code.visualstudio.com/)

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
# Install all required packages
npm install
```

### 3. Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your 511.org API key
# VITE_511_API_KEY=your_actual_api_key_here
```

### 4. Start Development Server

```bash
# Run the development server
npm run dev

# The app will open at http://localhost:3000
```

## 🔑 Getting a 511.org API Key

1. Visit [511.org Open Data](https://511.org/open-data/token)
2. Click "Request Token"
3. Fill out the registration form:
   - Enter your email address
   - Provide your name and organization
   - Agree to the terms of service
4. Check your email for the API key
5. Add the key to your `.env` file

## 📁 Creating the Repository Structure

Create the following directory structure:

```
511-traffic-monitor/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
│   └── (favicon and static files)
├── src/
│   ├── components/
│   │   ├── Map/
│   │   ├── EventPanel/
│   │   ├── FilterPanel/
│   │   └── shared/
│   ├── hooks/
│   ├── services/
│   │   ├── api/
│   │   ├── cache/
│   │   └── rateLimit/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   ├── styles/
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## 🛠️ Manual File Creation

For each file provided in the artifacts, create it in the appropriate directory:

### Essential Configuration Files (Root Directory)

1. **package.json** - NPM configuration
2. **tsconfig.json** - TypeScript configuration
3. **vite.config.ts** - Vite bundler configuration
4. **tailwind.config.js** - Tailwind CSS configuration
5. **postcss.config.js** - PostCSS configuration
6. **.eslintrc.cjs** - ESLint configuration
7. **.gitignore** - Git ignore rules
8. **.env.example** - Environment variables template
9. **index.html** - Main HTML file

### Source Files (src/)

1. **src/main.tsx** - Application entry point
2. **src/App.tsx** - Main App component
3. **src/vite-env.d.ts** - Vite environment types

### Type Definitions (src/types/)

1. **src/types/api.types.ts** - API type definitions
2. **src/types/filter.types.ts** - Filter type definitions
3. **src/types/map.types.ts** - Map type definitions

### Services (src/services/)

1. **src/services/api/trafficApi.ts** - Traffic API service
2. **src/services/cache/CacheManager.ts** - Cache management
3. **src/services/rateLimit/RateLimiter.ts** - Rate limiting

### Utilities (src/utils/)

1. **src/utils/constants.ts** - Application constants

### Hooks (src/hooks/)

1. **src/hooks/useTrafficEvents.ts** - Traffic events hook
2. **src/hooks/useLocalStorage.ts** - Local storage hook

### Styles (src/styles/)

1. **src/styles/globals.css** - Global styles
2. **src/styles/map.css** - Map-specific styles

## 🔧 VS Code Setup (Recommended)

### Install Recommended Extensions

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-typescript-next
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

## 🚀 Deployment to Vercel

### Automatic Deployment

1. Push your code to GitHub
2. Visit [Vercel](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure environment variables:
   - Add `VITE_511_API_KEY` with your API key
6. Click "Deploy"

### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. API Key Not Working

```bash
# Verify your API key is set correctly
echo $VITE_511_API_KEY

# Test the API directly
curl "https://api.511.org/traffic/events?api_key=YOUR_KEY&limit=1"
```

#### 2. Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
rm -rf dist .cache
npm run build
```

#### 3. TypeScript Errors

```bash
# Check for type errors
npm run type-check

# Update TypeScript
npm update typescript @types/react @types/react-dom
```

#### 4. Map Not Loading

- Ensure you have internet connectivity
- Check browser console for errors
- Verify Leaflet CSS is loaded correctly

#### 5. Rate Limiting Issues

- The app respects 511.org's rate limit (60 requests/hour)
- Check the rate limit indicator in the UI
- Wait for the reset time shown

## 📊 Monitoring & Logs

### Development Logs

```bash
# View development server logs
npm run dev -- --debug

# Check browser console for client-side errors
# Press F12 in Chrome to open DevTools
```

### Production Monitoring

- Use Vercel Analytics for performance monitoring
- Check Vercel Functions logs for API errors
- Monitor rate limit usage in the app UI

## 🔄 Updates and Maintenance

### Update Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install package-name@latest
```

### Database Migrations (if applicable)

The app uses localStorage for persistence. No database setup required.

## 📝 Next Steps

1. **Customize the geofence area** in `src/utils/constants.ts`
2. **Add custom event types** in `src/types/api.types.ts`
3. **Modify filter presets** in `src/types/filter.types.ts`
4. **Adjust polling interval** in `.env` file
5. **Configure deployment** for your preferred platform

## 🆘 Getting Help

- **GitHub Issues**: Report bugs or request features
- **511.org Support**: API-related questions
- **Stack Overflow**: Tag questions with `leaflet` and `react`

## ✅ Verification Checklist

- [ ] Node.js 18+ installed
- [ ] Repository created and files added
- [ ] Dependencies installed (`npm install`)
- [ ] 511.org API key obtained
- [ ] `.env` file configured
- [ ] Development server runs (`npm run dev`)
- [ ] Map loads with Bay Area boundaries
- [ ] Traffic events appear on map
- [ ] Filters work correctly
- [ ] No console errors

## 🎉 Success!

If you've completed all steps, you should now have a fully functional 511 Bay Area Traffic Monitor running locally. The application will:

- Display real-time traffic events on an interactive map
- Filter events by type, severity, and closure status
- Respect API rate limits automatically
- Cache data for optimal performance
- Update every 60 seconds

Visit http://localhost:3000 to see your application in action!

---

**Need more help?** Check the README.md file or open an issue on GitHub.
