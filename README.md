# CKAN CORS Proxy

## Configuration

Call `ckan-proxy` with the path to a JSON configuration file as the first argument. E.g. `ckan-proxy /etc/ckan-proxy.json`.


### Default Configuration Options
```json
{
  "logging": {
    "level": "info"
  },
  "proxy": {
    "port": 9090,
    "cors": {
      "allowedHeaders": [
        "accept",
        "accept-charset",
        "accept-encoding",
        "accept-language",
        "authorization",
        "content-length",
        "content-type",
        "host",
        "origin",
        "proxy-connection",
        "referer",
        "user-agent",
        "x-requested-with"
      ],
      "allowedMethods": [
        "HEAD",
        "POST",
        "GET",
        "PUT",
        "PATCH",
        "DELETE"
      ]
    }
  },
  "whitelist": {
    "ckan": {
      "enabled": false,
      "url": "http://demo.ckan.org",
      "updateInterval": 0,
      "rowsPerRequest": 500
    },
    "domains": []
  }
}
```
## Installation

```sh
npm install -g '52North/ckan-proxy'
```

`ckan-proxy` uses [`bunyan`][bunyan] as the logging component. The JSON output of `bunyan` can be best viewed using the `bunyan` CLI tool:

```sh
npm install -g bunyan
```


### systemd
Add a `node` user:
```sh
useradd -rUmd /var/lib/node -s /bin/bash node
```

Create a unit file:
```sh
cat > /etc/systemd/system/ckan-proxy.service <<EOF
[Unit]
Description=CKAN Proxy Server
After=network.target
Requires=network.target

[Service]
ExecStart=/usr/bin/ckan-proxy /etc/ckan-proxy.json
User=node
Group=node
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

Create a minimal configuration in `/etc/ckan-proxy.json`:
```sh
echo '{}' > /etc/ckan-proxy.json
```

Start and enable the `ckan-proxy` service:
```sh
systemctl daemon-reload
systemctl enable ckan-proxy.service
systemctl start ckan-proxy.service
```

To view the log files (requires `bunyan`):

```sh
journalctl -f -u ckan-proxy.service -o cat | bunyan
```

[bunyan]: <https://github.com/trentm/node-bunyan> "bunyan"
