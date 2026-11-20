#!/bin/bash
# rules/always + rules/scoped se AGENTS.md banata hai, haath se edit mat karo
cat rules/always/*.md rules/scoped/*.md > AGENTS.md
echo "# Generated from rules/ - Do not edit by hand" | cat - AGENTS.md > temp && mv temp AGENTS.md
cp AGENTS.md CLAUDE.md
cp AGENTS.md GEMINI.md
cp AGENTS.md .agents/rules/netguard.md
cp AGENTS.md .cursor/rules/netguard.md
cp AGENTS.md .qoder/rules/netguard.md
echo "AGENTS.md synced"
