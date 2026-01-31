#!/bin/bash

# UK Parliament Bill Amendment App - Setup Script
# This script sets up the project and runs the initial sync

set -e

echo "==================================="
echo "UK Parliament Bill Amendment App"
echo "Setup Script"
echo "==================================="
echo ""

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Installing via npm..."
    npm install -g pnpm
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Generate Prisma client
echo "Generating Prisma client..."
pnpm --filter @bill-data-app/backend run db:generate

# Create database and run migrations
echo "Creating database..."
pnpm --filter @bill-data-app/backend run db:push

# Build shared package
echo "Building shared package..."
pnpm --filter @bill-data-app/shared run build

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Run initial data sync: pnpm sync"
echo "2. Start development servers: pnpm dev"
echo ""
echo "The backend will run on http://localhost:3001"
echo "The frontend will run on http://localhost:5173"
