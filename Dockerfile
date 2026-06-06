# Use the official Node.js image as the base image
FROM node:22-slim

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the pre-built files and env
COPY dist/ ./dist/
COPY .env ./

# Set the environment variable to production
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]
