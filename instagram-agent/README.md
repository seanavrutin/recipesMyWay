# Instagram agent

Instagram shows logged-out visitors a login page with no post content, so the server can only read
a post's caption with a logged-in session. This agent keeps one alive, without a human:

```
agent (VM 102, daily) --POST /agent/instagram-session--> server --> Firestore config/instagramSession
server --Instagram private API with those cookies--> caption --> Gemini
```

Each run: open a real Chrome (own profile, visible on VM 102's desktop), check the login, log in
again if needed (reading emailed security codes from the account's Gmail), push the cookies, close.
Anything it can't get past → screenshot in `~/.local/state/instagram-agent/` + one alert to
`ALERT_WEBHOOK_URL`.

## Install on VM 102

Runs from a deploy clone, not the working clone in `~/homelab/repos` (branch switches there would
pull the agent out from under the timer).

```bash
git clone https://github.com/seanavrutin/recipesMyWay.git ~/apps/recipesMyWay
cd ~/apps/recipesMyWay/instagram-agent && npm ci
mkdir -p ~/.config/instagram-agent
cp agent.env.example ~/.config/instagram-agent/agent.env && chmod 600 ~/.config/instagram-agent/agent.env
# fill it in, then:
ln -sf ~/apps/recipesMyWay/instagram-agent/systemd/instagram-agent.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now instagram-agent.timer
```

Update: `git -C ~/apps/recipesMyWay pull && (cd ~/apps/recipesMyWay/instagram-agent && npm ci)`.

## Operate

- Run now: `systemctl --user start instagram-agent` (or `npm run dry-run` to skip the push)
- Logs: `journalctl --user -u instagram-agent -n 50`
- Next run: `systemctl --user list-timers instagram-agent.timer`
- Server side: `/health` → `instagram.status` is `ok`, `stale` (no push for 48h: the agent is
  down), `expired` (Instagram rejected the session) or `missing`.
