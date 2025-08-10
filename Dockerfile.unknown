# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Build the app
RUN npm run build

# Set environment variable for production
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the app
CMD ["npm", "start"]

