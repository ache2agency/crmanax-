#!/bin/bash
git add .
git commit -m "update $(date '+%Y-%m-%d %H:%M')"
npx vercel --prod
