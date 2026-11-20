#!/bin/bash
echo "===== NetGuard Full Setup Check ====="
echo ""
echo "--- 1. PWD + Git ---"
pwd
git status --short | head -20
git log --oneline -3
echo ""
echo "--- 2. Rules + Guards ---"
ls -R rules/ hooks/ .githooks/ 2>&1
test -f AGENTS.md && echo "AGENTS.md OK" || echo "AGENTS.md MISSING"
test -f CLAUDE.md && echo "CLAUDE.md OK" || echo "CLAUDE.md MISSING"
test -f GEMINI.md && echo "GEMINI.md OK" || echo "GEMINI.md MISSING"
echo ""
echo "--- 3. Root Files ---"
ls -1 vercel.json .vercelignore .dockerignore .gitignore package.json tsconfig.json README.md requirements.txt 2>&1
echo ""
echo "--- 4. Folder Count ---"
echo "Directories: $(find . -type d -not -path "./node_modules*" -not -path "./.git*" | wc -l)"
echo "Files: $(find . -type f -not -path "./node_modules*" -not -path "./.git*" -not -path "./.pnpm-store*" | wc -l)"
echo ""
echo "--- 5. Key Folders Exist? ---"
for d in api vault/keys vault/hashes src/features/wifi-monitor src/features/sim-monitor src/features/vault src/features/reports src/features/security-gateway src/mobile/app src/mobile/components src/mobile/services src/mobile/hooks src/shared src/cloud agents docker scripts; do
  if [ -d "$d" ]; then echo "OK $d"; else echo "MISSING $d"; fi
done
echo ""
echo "--- 6. Typecheck ---"
pnpm run typecheck
echo "Typecheck exit: $?"
echo ""
echo "--- 7. No Scope in Code? ---"
grep -r "# Scope:" src/ api/ agents/ --include="*.py" --include="*.ts" --include="*.tsx" -n || echo "Clean - No Scope in src/api/agents"
grep -r "PRIVATE_KEY\|PLACEHOLDER_PRIVATE" vault/keys/ -n
echo ""
echo "--- 8. Docker ---"
docker --version
docker compose -f docker/docker-compose.yml config 2>&1 | head -20
echo ""
echo "--- 9. Tree ---"
tree -a -I 'node_modules|.git|.pnpm-store' --dirsfirst | tail -20
echo ""
echo "===== Check Done ====="
