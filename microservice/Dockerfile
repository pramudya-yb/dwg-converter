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
    && rm -rf /var/lib/apt/lists/*

# Fix potential missing symlink for libxcb-util.so.0 required by older QT apps
RUN cd /usr/lib/x86_64-linux-gnu && \
    if [ ! -f libxcb-util.so.0 ] && [ -f libxcb-util.so.1 ]; then ln -s libxcb-util.so.1 libxcb-util.so.0; fi

# 2. Download and install ODA File Converter
RUN wget -O /tmp/odafileconverter.deb "https://www.opendesign.com/guestfiles/get?filename=ODAFileConverter_QT6_lnxX64_8.3dll_25.12.deb" && \
    apt-get update && \
    apt-get install -y /tmp/odafileconverter.deb || apt-get install -y -f && \
    rm /tmp/odafileconverter.deb && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/bin:${PATH}"

# Set up working directory for the microservice
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy the rest of the microservice
COPY . .

# Expose port
EXPOSE 8080
ENV PORT=8080

# Run the Express server
CMD ["node", "server.js"]
