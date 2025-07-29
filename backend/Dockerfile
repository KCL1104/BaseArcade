# Use the official lightweight Node.js 20 image
FROM node:20-slim

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available)
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci && npm cache clean --force

# Copy local code to the container image
COPY . ./

# Build the TypeScript application
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Create a non-root user to run the application
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

# Run the web service on container startup
CMD ["npm", "start"]