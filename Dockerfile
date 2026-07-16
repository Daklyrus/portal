FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Nur für die Build-Analyse — zur Laufzeit kommen die echten Werte aus der Compose-Umgebung
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
	BETTER_AUTH_SECRET=build-only-secret-never-used-at-runtime \
	ORIGIN=http://localhost
RUN npm run build \
	&& npx esbuild scripts/seed-admin.ts --bundle --platform=node --format=esm --packages=external --outfile=scripts/seed-admin.mjs \
	&& npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build build
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json .
COPY --from=build /app/drizzle drizzle
COPY --from=build /app/scripts/migrate.js scripts/migrate.js
COPY --from=build /app/scripts/seed-admin.mjs scripts/seed-admin.mjs
RUN mkdir -p data/uploads
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
