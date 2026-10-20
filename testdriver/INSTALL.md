# Install Magpi Test on your repository

Step-by-step setup for the Magpi Test GitHub App. After this, anyone with
write access can trigger a QA run from an issue or pull request comment.

## 1. Install the App on your account or organization

Open the install page (replace the name if your App slug differs):

```text
https://github.com/apps/magpi-test/installations/new
```

Choose your personal account or organization, then select **All repositories**
or only the repos you want tested. Works on public and private repositories.

If you are not an org owner, GitHub may ask an owner to approve the install.

## 2. Point the webhook at a reachable URL

The App needs a running Magpi Test GitHub App server whose webhook URL GitHub
can reach.

- **Hosted:** use the webhook URL your Magpi Test operator gave you (HTTPS).
- **Local dogfood:** run the server from `testdriver/`, then expose it with a
  tunnel such as [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
  or [localtunnel](https://localtunnel.github.io/www/), and set that public URL
  as the App’s webhook URL in GitHub → App settings → Webhook.

Keep the webhook secret in sync with the server’s `WEBHOOK_SECRET`.

## 3. Confirm the App is installed on the target repo

In the repo: **Settings → Integrations → GitHub Apps** (or your org’s
**Installed GitHub Apps**). Magpi Test should list that repository.

## 4. Trigger a run with a comment

On an issue or pull request, comment the configured trigger phrase (default
`@magpi-test`) and include a preview URL for your running app:

```text
@magpi-test please QA https://your-preview.example.com
```

The App replies on the same thread when the run is queued and when it finishes.

## 5. Where to find results

- **On GitHub:** the App’s comments on that issue or PR (summary and links).
- **In the target checkout** (when Magpi Test writes artifacts there):
  `magpi-tests/state/report.md` and related files under `magpi-tests/`.

## Permissions (what you approve at install)

In plain language, the App can:

- Read issues and pull requests, and post comments on them
- Read repository contents (and open a PR when it leaves accepted tests)
- Create check runs on commits when that feature is enabled

You can revoke or narrow repository access anytime from the App’s installation
settings on GitHub.
