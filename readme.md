# Installation

## Requirements
Node version: v18.18.0

## Step 1
npm install --save-dev
## Step 2 
ng build --base-href ./
## Step 3
electron .
## Deploy
npm run dist
Outputs in release-builds

## Misc
resources unpack:
\release-builds\win-unpacked\resources
npx asar extract app.asar unpackedcopy
