# 511 Bay Area Traffic Monitor 🚦

A production-ready, real-time traffic monitoring application for the San Francisco Bay Area using the 511.org Open Data API. Built with React, TypeScript, and Leaflet.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Vite](https://img.shields.io/badge/Vite-5.0-646cff)

## 🌟 Features

### Core Functionality
- **Real-time Traffic Monitoring**: Live updates every 60 seconds
- **Geofenced Area**: Automatically filters events to Bay Area boundaries
- **Road Closure Detection**: Prioritizes and highlights road closures
- **Interactive Map**: OpenStreetMap with clustered markers
- **Event Filtering**: Filter by type, severity, and closure status

### Technical Features
- **Rate Limiting**: Respects 511.org's API limits (60 requests/hour)
- **Smart Caching**: 30-second cache to minimize API calls
- **Offline Support**: LocalStorage persistence for resilience
- **Type Safety**: Full TypeScript implementation
- **Performance Optimized**: Code splitting and lazy loading

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- 511.org API key ([Get one here](https://511.org/open-data/token))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/511-traffic-monitor.git
cd 511-traffic-monitor

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your API key to .env
echo "VITE_511_API_KEY=your_api_key_here" >> .env

# Start development server
npm run dev
```

The application will open at `http://localhost:3000`

## 📦 Project Structure

```
src/
├── components/         # React components
│   ├── Map/           # Map-related components
│   ├── EventPanel/    # Event list and details
│   └── FilterPanel/   # Filter controls
├── services/          # API and business logic
│   ├── api/          # 511.org API integration
│   ├── cache/        # Caching system
│   └── rateLimit/    # Rate limiting
├── hooks/            # Custom React hooks
├── stores/           # State management
├── types/            # TypeScript definitions
└── utils/            # Utilities and constants
```

## 🔧 Configuration

### Environment Variables

```env
# Required
VITE_511_API_KEY=your_511_api_key

# Optional
VITE_API_BASE_URL=https://api.511.org
VITE_POLL_INTERVAL=60000
VITE_CACHE_TTL=30000
```

### Customizing the Geofence

Edit `src/utils/constants.ts` to modify the monitored area:

```typescript
export const GEOFENCE = {
  BBOX: {
    xmin: -122.57031250,
    ymin: 37.21559028,
    xmax: -121.66525694,
    ymax: 37.86217361,
  }
};
```

## 🛠️ Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

### API Rate Limiting

The application implements intelligent rate limiting:

- **Maximum**: 60 requests per hour
- **Window**: Rolling 1-hour window
- **Caching**: 30-second cache for identical requests
- **Persistence**: Rate limit state survives page refreshes

### Adding New Features

1. **New Event Types**: Update `src/types/api.types.ts`
2. **Custom Filters**: Modify `src/components/FilterPanel/FilterPanel.tsx`
3. **Map Styles**: Edit `src/utils/constants.ts` → `MARKER_CONFIG`

## 📊 API Usage

### Supported Endpoints

- `/traffic/events` - Real-time traffic events
- `/traffic/wzdx` - Work Zone Data Exchange

### Event Types

- 🚧 **CONSTRUCTION** - Planned road work
- ⚠️ **INCIDENT** - Accidents and unexpected events  
- 📍 **SPECIAL_EVENT** - Parades, games, etc.
- 🛣️ **ROAD_CONDITION** - Road surface issues
- 🌧️ **WEATHER_CONDITION** - Weather-related hazards

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_511_API_KEY
```

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

## 📈 Performance

- **Initial Load**: < 2s
- **Time to Interactive**: < 3s
- **Lighthouse Score**: 95+
- **Bundle Size**: < 250KB gzipped

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [511.org](https://511.org) for providing the Open Data API
- [OpenStreetMap](https://www.openstreetmap.org) contributors
- [Leaflet](https://leafletjs.com) for the mapping library

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/511-traffic-monitor/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/511-traffic-monitor/wiki)
- **API Documentation**: [511.org API Docs](https://511.org/open-data/traffic)

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Traffic prediction ML model
- [ ] Route planning integration
- [ ] Historical data analytics
- [ ] Push notifications for closures
- [ ] Multi-region support

---

Built with ❤️ for Bay Area commuters
