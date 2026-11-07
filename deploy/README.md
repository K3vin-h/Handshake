# Vultr + domain deployment

`setup.sh` targets a dedicated, fresh Ubuntu 24.04 VM, run as root. It installs Node 24 and Caddy, builds the app, runs Express as `handshake` on loopback port 8787, and configures automatic HTTPS. It changes the Caddy configuration and firewall; review it before running on an existing server.

1. Create the VM and point the domain's A record to it. Confirm the domain meets the current event's GoDaddy Registry eligibility requirements. [NEEDS: eligible domain and VM IP].
2. Copy a filled `.env.example` to `/root/handshake.env` on the VM, mode 600. Keep secrets outside the repository. Caddy uses 8787 and the service enforces that port. Disable snapshot/cache export flags for submission.
3. Copy `setup.sh`, then run `bash setup.sh <domain> <https-repository-url>`. Private repositories require a separately provisioned read-only Git credential; never embed credentials in the URL.
4. If using Tiger Data, run the documented migration separately (`server/DATABASE.md`). Configure n8n and Maritime only after their services are ready.
5. Check `systemctl status handshake caddy`, `curl -I https://<domain>` and `curl https://<domain>/api/features`. Open the HTTPS app on a phone and confirm the camera prompt and lesson flow. From another machine verify `http://<vm-ip>:8787` cannot be reached. Review `journalctl -u handshake` without publishing secrets.

The script restarts the app on reruns. It pulls the clone's current branch with `--ff-only`; ensure it is the reviewed release branch. It does not purchase domains, create VMs or publish this worktree automatically. [NEEDS: deployed HTTPS URL, phone-camera verification and deployment evidence].
