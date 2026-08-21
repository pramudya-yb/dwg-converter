# Use Node.js 20 on Debian Bookworm (more complete standard libs than Alpine)
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
    && rm -rf /var/lib/apt/lists/*

# Fix potential missing symlink for libxcb-util.so.0 required by older QT apps
RUN cd /usr/lib/x86_64-linux-gnu && \
    if [ ! -f libxcb-util.so.0 ] && [ -f libxcb-util.so.1 ]; then ln -s libxcb-util.so.1 libxcb-util.so.0; fi

# 2. Download and install ODA File Converter
# Note: We are using a known public URL for the DEB package from ODA. 
# Alternatively, use the AppImage version.
RUN wget -O /tmp/odafileconverter.deb "https://www.opendesign.com/guestfiles/get?filename=ODAFileConverter_QT6_lnxX64_8.3dll_25.12.deb" && \
    apt-get update && \
    (apt-get install -y /tmp/odafileconverter.deb || apt-get install -y -f) && \
    rm /tmp/odafileconverter.deb && \
    rm -rf /var/lib/apt/lists/*

# Add to PATH (ODA installs to /usr/bin/ODAFileConverter by default, but let's be sure)
ENV PATH="/usr/bin:${PATH}"

# Set up working directory for the app
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Set the environment variable to tell Next.js it's running in production
ENV NODE_ENV=production
# Next.js telemetry disable
ENV NEXT_TELEMETRY_DISABLED=1
# Port
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run the Next.js server
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 &>/dev/null & export DISPLAY=:99 && npm start"]
