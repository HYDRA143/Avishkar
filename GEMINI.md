# Generated from rules/ - Do not edit by hand
# NetGuard - Always Rules

- No KVM, No Java / JDK, No STM32, No AWS / GCP, No Render / Koyeb, No Nginx
- Backend only on Vercel, Vercel rewrites / load balancer use karna hai
- Strict TypeScript, pnpm only, npm nahi
- Feature-based structure, ek feature ka code usi folder me, dusre ki file mat chhedo
- Vault keys kabhi 【entity-GitHub¦canonical_name=GitHub】 pe nahi, sirf placeholder .txt + README
- SIM auto-block nahi, sirf warning + alarm + manual off
- Uno Q 4GB, 49% RAM target, heavy code nahi
- Ek 【entity-GitHub¦canonical_name=GitHub】 push se bifurcate, folder by folder push nahi
- docs/ abhi drop hai
# Scope: all
- Ye defensive system hai, hacking / attack wala code nahi likhna
- Sirf user ka apna network, apna device, apna code monitor karna hai
# Scope: vault/ + src/features/vault/
- Is folder ki file ko read/edit karne se pehle puchna hai
- Real key, hash, private key kabhi print / push / copy nahi karna
- Sirf placeholder .txt use karna hai
# Scope: src/features/wifi-monitor/
- Sirf apne folder me kaam, dusre feature ki file mat chhedo
- Arduino naya WiFi nahi banayega, kisi bhi hotspot / WiFi se monitor karega
- Stage 1: direct check, device_tracker + bandwidth_logger only
