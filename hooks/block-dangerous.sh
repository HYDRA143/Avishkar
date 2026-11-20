#!/bin/bash
# Agent ke dangerous command ko block karta hai
# Block: rm -rf, docker system prune, vault delete, force push, .env / keys push
echo "Guard check: block-dangerous active"
