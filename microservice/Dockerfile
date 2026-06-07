# Use Node.js 20 on Debian Bookworm
FROM node:20-bookworm

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install Linux dependencies for ODA File Converter and headless execution
RUN apt-get update && apt-get install -y \
    wget \
    xvfb \
    libxcb-util1 \
    libxcb-cursor0 \
    libxcb-shape0 \
    libgl1 \
    libfontconfig1 \
    libxrender1 \
    libxext6 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    libglib2.0-0 \
    libdbus-1-3 \
    libxcb-xinerama0 \
    libxcb-keysyms1 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-render-util0 \
    && rm -rf /var/lib/apt/lists/*

# Fix potential missing symlink for libxcb-util.so.0 required by older QT apps
RUN cd /usr/lib/x86_64-linux-gnu && \
    if [ ! -f libxcb-util.so.0 ] && [ -f libxcb-util.so.1 ]; then ln -s libxcb-util.so.1 libxcb-util.so.0; fi

# 2. Install ODA File Converter
# Since the official URL changes frequently, we expect the .deb file to be in this folder
COPY ODAFileConverter*.deb /tmp/odafileconverter.deb
RUN apt-get update && \
    apt-get install -y /tmp/odafileconverter.deb || apt-get install -y -f && \
    rm /tmp/odafileconverter.deb && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/bin:${PATH}"

# We use the existing 'node' user (UID 1000) for Hugging Face Spaces compatibility


# Set up working directory for the microservice
WORKDIR /app
RUN chown -R node:node /app

# Copy package files
COPY --chown=node:node package*.json ./

# Install npm dependencies
RUN npm install

# Copy the rest of the microservice
COPY --chown=node:node . .

# Switch to the non-root user
USER node

# Expose port (Hugging Face Spaces requires 7860)
EXPOSE 7860
ENV PORT=7860

# Run the Express server
CMD ["node", "server.js"]
