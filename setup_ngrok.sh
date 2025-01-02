#!/bin/bash

PORT=$(grep -w "PORT" .env | cut -d '=' -f2)

# Open ngrok in a new terminal
gnome-terminal -- bash -c "ngrok http --host-header=rewrite $PORT; exec bash"

sleep 3

# Run "npm run sync-ngrok"
npm run sync-ngrok