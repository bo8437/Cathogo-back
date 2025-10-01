# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Install necessary system dependencies
RUN apk --no-cache add --virtual .build-deps python3 make g++

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Remove build dependencies to keep the image small
RUN apk del .build-deps

# Create uploads directory and set permissions
RUN mkdir -p /usr/src/app/uploads && \
    chown -R node:node /usr/src/app && \
    chmod -R 755 /usr/src/app/uploads

# Copy the rest of the application code
COPY --chown=node:node . .

# Switch to non-root user for security
USER node

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["node", "app.js"]
