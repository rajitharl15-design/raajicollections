FROM node:20-slim

WORKDIR /app

# Static website (served at /)
COPY *.html ./
COPY css ./css
COPY js ./js
COPY images ./images
COPY database ./database
COPY manifest.json sw.js ./

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/src ./backend/src
COPY backend/.env.example ./backend/.env.example

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
