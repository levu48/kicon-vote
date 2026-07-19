# Deploying the consumer surface to vote.kicon.com

Auto-deploy pipeline: push to `main` → GitHub Actions builds the consumer bundle
(checking out both this repo and the private `kicon-platform` sibling) → rsyncs
`consumer/dist/` over SSH into the nginx docroot at `68.183.121.168`.

Workflow: [`.github/workflows/deploy-consumer.yml`](../.github/workflows/deploy-consumer.yml)
nginx site: [`nginx/vote.kicon.com.conf`](nginx/vote.kicon.com.conf)

Admin (`admin.vote.kicon.com`) is **not** covered here — separate origin, separate
pipeline, must deny framing. Wire it up on its own when it's ready.

## One-time setup

### 1. Server (`68.183.121.168`, as a sudo user)

```bash
# Deploy user that CI logs in as (no password, key-only).
sudo adduser --disabled-password --gecos "" deploy

# Docroot, owned by the deploy user so rsync can write it.
sudo mkdir -p /var/www/vote.kicon.com/html
sudo chown -R deploy:deploy /var/www/vote.kicon.com

# Authorize the CI deploy key.
sudo -u deploy mkdir -p /home/deploy/.ssh && sudo -u deploy chmod 700 /home/deploy/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAlcES88s34mfjWwAIeLOSgZkr3G48Ogx/LSaurFEIce github-actions-deploy@vote.kicon.com' \
  | sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys

# nginx site + TLS. First get deploy/nginx/vote.kicon.com.conf from this repo onto
# the box (the server has no repo checkout — CI only ships the built dist/). e.g.
# from your local machine:  scp deploy/nginx/vote.kicon.com.conf USER@68.183.121.168:/tmp/
sudo cp /tmp/vote.kicon.com.conf /etc/nginx/sites-available/vote.kicon.com
sudo ln -s /etc/nginx/sites-available/vote.kicon.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d vote.kicon.com   # issues cert, rewrites the 443 block
```

If nginx (via certbot) runs as `www-data`, it only needs read access to the
docroot — the `deploy` ownership above is fine.

### 2. GitHub repo secrets (`levu48/kicon-vote` → Settings → Secrets → Actions)

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_KEY` | The **private** key `kicon_vote_deploy` (matching the public key above). Paste the whole file including the BEGIN/END lines. |
| `PLATFORM_REPO_TOKEN` | A fine-grained PAT with **read-only Contents** on `levu48/kicon-platform`, so CI can clone the private platform lib. |

Host/user/docroot are non-secret and live as `env:` at the top of the workflow —
edit them there if any of these change.

## Deploying

- **Automatic:** merge/push to `main`. Only consumer/shared changes trigger it.
- **Manual:** Actions tab → *Deploy consumer → vote.kicon.com* → Run workflow.

## Rotating the deploy key

Generate a new keypair, replace the line in the server's
`/home/deploy/.ssh/authorized_keys`, and update the `DEPLOY_SSH_KEY` secret.
