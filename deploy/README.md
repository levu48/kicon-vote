# Deploying the vote surfaces

Two surfaces, two origins, **two independent pipelines** — a push to `main`
builds the changed surface(s) (checking out both this repo and the private
`kicon-platform` sibling) and rsyncs the built `dist/` over SSH into that
surface's own nginx docroot on `68.183.121.168`. The consumer and admin bundles
never co-mingle.

| Surface | Origin | Workflow | nginx site | docroot |
| --- | --- | --- | --- | --- |
| consumer | `vote.kicon.com` | [`deploy-consumer.yml`](../.github/workflows/deploy-consumer.yml) | [`nginx/vote.kicon.com.conf`](nginx/vote.kicon.com.conf) | `/var/www/vote.kicon.com/html` |
| admin | `admin.vote.kicon.com` | [`deploy-admin.yml`](../.github/workflows/deploy-admin.yml) | [`nginx/admin.vote.kicon.com.conf`](nginx/admin.vote.kicon.com.conf) | `/var/www/admin.vote.kicon.com/html` |

`deploy-consumer.yml` fires on `consumer/**` + `shared/**` changes; `deploy-admin.yml`
on `admin/**` + `shared/**`. A change under `shared/` redeploys both. Both reuse
the same `DEPLOY_SSH_KEY` and `PLATFORM_REPO_TOKEN` secrets.

**Admin is the highest-privilege origin and MUST deny framing** — its nginx site
serves `X-Frame-Options: DENY` / `frame-ancestors 'none'`. Never put those on the
consumer site (it is deliberately embeddable), and never copy admin's docroot into
the consumer one.

## One-time setup

### 1. Server (`68.183.121.168`, as a sudo user)

```bash
# Deploy user that CI logs in as (no password, key-only).
sudo adduser --disabled-password --gecos "" deploy

# Docroots (one per surface), owned by the deploy user so rsync can write them.
sudo mkdir -p /var/www/vote.kicon.com/html /var/www/admin.vote.kicon.com/html
sudo chown -R deploy:deploy /var/www/vote.kicon.com /var/www/admin.vote.kicon.com

# Authorize the CI deploy key.
sudo -u deploy mkdir -p /home/deploy/.ssh && sudo -u deploy chmod 700 /home/deploy/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAlcES88s34mfjWwAIeLOSgZkr3G48Ogx/LSaurFEIce github-actions-deploy@vote.kicon.com' \
  | sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys

# nginx sites + TLS. First get both site files from this repo onto the box (the
# server has no repo checkout — CI only ships the built dist/). e.g. from your
# local machine:
#   scp deploy/nginx/vote.kicon.com.conf deploy/nginx/admin.vote.kicon.com.conf USER@68.183.121.168:/tmp/
sudo cp /tmp/vote.kicon.com.conf /etc/nginx/sites-available/vote.kicon.com
sudo cp /tmp/admin.vote.kicon.com.conf /etc/nginx/sites-available/admin.vote.kicon.com
sudo ln -s /etc/nginx/sites-available/vote.kicon.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.vote.kicon.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d vote.kicon.com -d admin.vote.kicon.com  # issues certs, rewrites 443 blocks
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

- **Automatic:** merge/push to `main`. Consumer/shared changes trigger the consumer
  deploy; admin/shared changes trigger the admin deploy (shared changes trigger both).
- **Manual:** Actions tab → *Deploy consumer → vote.kicon.com* or *Deploy admin →
  admin.vote.kicon.com* → Run workflow.

## Rotating the deploy key

Generate a new keypair, replace the line in the server's
`/home/deploy/.ssh/authorized_keys`, and update the `DEPLOY_SSH_KEY` secret.


