#!/bin/bash
echo "Verifying NetGuard Step 1 setup..."
test -f AGENTS.md && echo "AGENTS.md OK" || echo "AGENTS.md MISSING"
test -f hooks/block-dangerous.sh && echo "hooks OK" || echo "hooks MISSING"
test -f rules/always/netguard.md && echo "rules OK" || echo "rules MISSING"
bash hooks/self-check.sh
