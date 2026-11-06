---
title: "Oracle 免费服务器搭建双节点：从 SSH、REALITY 到 FlClash 订阅"
permalink: "oracle-free-xray-reality-guide"
date: 2026-10-30
notion_id: 409f66ff-04f8-8170-8893-ca73e2789bdb
notion_hash: 86c1a10d1cdb005a70deb079f73a07a3
tags:
categories:
---

<!-- more -->

最近用 Oracle Cloud 的两台免费 AMD 服务器搭了两个个人节点。最花时间的不是安装，而是分清“云端放行”“主机放行”和“客户端握手”，以及最后把节点做成订阅。

这篇按第一次接触服务器的顺序写：先跑通一台，再复制到第二台，最后按需加订阅。每组命令都注明在哪执行，并给出成功标准。方案是 Xray + VLESS/REALITY + Vision，客户端使用 FlClash。

核对日期：2026-10-31。服务端实测 Xray v26.10.29，隔离连接验证使用 mihomo v1.19.33。这是本文验证过的组合，不代表任意新版都兼容。203.0.113 开头的地址、sub.example.com、YOUR 开头的字段都是示例，不能直接连接。本文不公开真实节点地址、账号、私钥、UUID 或订阅链接。

![双节点搭建流程示意，非控制台截图](https://img.heyyao.com/2026/11/fd4e4be712b31fe63b56c8207fdf2002.png)

## 一、先明白我们要搭什么

服务器是你自己的远程电脑；Xray 是上面的代理程序；FlClash 是你设备上的连接工具。订阅只是一个能下载节点配置的 HTTPS 地址，不是新的服务器，也不会让网络加速。

REALITY 节点本身不要求购买域名或申请自己的证书；可选的 HTTPS 订阅托管才需要域名和证书。先把节点跑通，再做订阅。

准备：已开通的 Oracle 账号、可运行 FlClash 的电脑、免费实例额度。只有一台也能先开始，第二台用于备用。两台都在同一区域，仍可能受同一条线路或区域故障影响。

## 二、创建实例前，先核对免费额度

当前官方说明中，AMD 的 VM.Standard.E2.1.Micro 最多两台。主区域内启动盘与块存储共用 200 GB 免费额度；本文每台选 50 GB，两台合计 100 GB，还要加上账号里已经存在的卷。

ARM 是另一种规格，当前 Always Free A1 总量为 2 OCPU / 12 GB；本文不需要它。AMD 最多两台，不是可以一直继续开 AMD。提示无库存就先停，不要切换到收费规格。

核对 Always Free 资格、Home region、已有存储和费用用量，不能仅凭估价框或某一个免费标签判断整套配置不会收费。不要额外开启付费备份、高性能存储等选项。

进入 Oracle 控制台的 Compute → Instances → Create instance，名字可以填 oracle-main。按下面顺序核对：

- 区域：自己的 Home region（主区域），不要选到其他区域。
- 镜像：Canonical 提供的 Ubuntu 24.04 免费镜像。
- Shape：VM.Standard.E2.1.Micro，并显示 Always Free eligible。
- 启动盘：50 GB，所有卷合计不超免费额度。
- 网络：有 Internet Gateway 的公网子网，并分配公网 IPv4。
- SSH：在 Add SSH keys 生成密钥对，下载并妥善保存私钥。私钥不要传到博客、GitHub 或公开聊天。
没有网络的新账号，可以先用 VCN Wizard 的 Internet Connectivity 选项创建 VCN。公网 IP、公共子网、默认路由和 Internet Gateway 都要正确，不是出现一个公网 IP 就一定能连接。

创建后等状态成为 Running，记下自己的公网 IPv4。第一台跑通后，再创建 oracle-backup，避免两台同时失败时不知道从哪排查。

官方创建说明：https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm

## 三、SSH 登录：在自己的电脑执行

Mac 打开终端；Windows 打开 PowerShell / Windows Terminal，确保有 OpenSSH Client。下载文件名以 ssh-key.key 举例，路径和 IP 必须换成自己的。

Mac / Linux：

```bash
chmod 600 ~/Downloads/ssh-key.key
ssh -i ~/Downloads/ssh-key.key ubuntu@203.0.113.10
```

Windows：

```powershell
ssh -i "$HOME\Downloads\ssh-key.key" ubuntu@203.0.113.10
```

Ubuntu 默认用户是 ubuntu，不是 root；Oracle Linux 的用户不同，本文不使用 Oracle Linux。首次连接先核对目标 IP / 主机指纹，确认是刚创建的机器再接受记录，不用关闭主机校验的参数绕过提示。

看到 ubuntu@... 的命令提示符，才是进入了服务器。Permission denied (publickey) 优先查用户名和私钥；Connection timed out 优先查公网 IP、路由和 TCP 22。

## 四、两层防火墙都要放行

### 4.1 Oracle 控制台：云端入站规则

实例详情 → Primary VNIC → Subnet → Security Lists，打开实际关联的安全列表，添加 Stateful Ingress Rule。若你使用 NSG，也可以在实际关联的 NSG 配置同等规则。

代理规则填写：Source Type = CIDR，Source CIDR = 0.0.0.0/0，IP Protocol = TCP，Source Port Range 留空 / All，Destination Port Range = 443，Stateless 不勾选。

TCP 22 是 SSH 管理端口，建议来源限制为你当前公网 IPv4/32。网络换了、自己的公网 IP 变了，要更新 SSH 来源规则；修改时保留已有会话，并测试能否新开一个会话。不要顺手开放全部端口；本文不需要开 UDP 443。

同一子网的多台实例可能共用安全列表，所以每台主机还要只放行自己真正需要的端口。

### 4.2 Ubuntu：主机规则（服务器执行）

先看现状，不清空：

```bash
sudo apt-get update
sudo apt-get install -y iptables
sudo iptables -S INPUT
sudo ufw status
```

下面的方法用于新建 Ubuntu，且 UFW 未启用、没有其他防火墙管理器。UFW 如果显示 active，改用 sudo ufw allow 443/tcp，并继续由 UFW 管理，不要叠加下面的模板。已有业务服务器先按既有规则维护。

UFW inactive 不等于没有 iptables 规则。下面的服务模板只管理一个端口的规则，开机自动恢复，不保存或覆盖整套防火墙：

```bash
sudo tee /etc/systemd/system/oracle-port@.service >/dev/null <<'UNIT'
[Unit]
Description=Oracle tutorial TCP port %i
After=network-pre.target netfilter-persistent.service ufw.service
Before=xray.service caddy.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c '/usr/sbin/iptables -w 10 -C INPUT -p tcp --dport %i -m comment --comment oracle-guide -j ACCEPT 2>/dev/null || /usr/sbin/iptables -w 10 -I INPUT 1 -p tcp --dport %i -m comment --comment oracle-guide -j ACCEPT'
ExecStop=/bin/sh -c 'if /usr/sbin/iptables -w 10 -C INPUT -p tcp --dport %i -m comment --comment oracle-guide -j ACCEPT 2>/dev/null; then /usr/sbin/iptables -w 10 -D INPUT -p tcp --dport %i -m comment --comment oracle-guide -j ACCEPT; fi'
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now oracle-port@443.service
sudo iptables -C INPUT -p tcp --dport 443 -m comment --comment oracle-guide -j ACCEPT
```

最后一条命令没有输出且退出成功，说明规则存在。不要执行 iptables -F，也不要关闭整个防火墙。本教程按 IPv4 部署；如果改用 IPv6，需要单独核对 IPv6 防火墙。

## 五、安装并配置第一台 Xray（服务器执行）

### 5.1 确认 443 没被占用

```bash
sudo ss -lntp | grep ':443' || true
```

全新机器通常没有输出。有 Nginx / Caddy / 其他程序监听时先停下来核对，不要随手停网站。可以改用 24443，但云端规则、主机规则、下一段 Python 的 port、客户端 port 四处都要改。本文默认用 443。

### 5.2 安装固定验证版本

```bash
bash <<'INSTALL_XRAY'
set -euo pipefail
if [ -e /usr/local/bin/xray ] || [ -e /usr/local/etc/xray/config.json ]; then
  echo '检测到已有 Xray，停止。请不要在现有业务机器直接重装。' >&2
  exit 1
fi
sudo apt-get install -y curl ca-certificates unzip python3 openssl
id xray >/dev/null 2>&1 || sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin xray
curl -fL --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/XTLS/Xray-install/9433c4e7ce293e0a930fa0708d6865212129510c/install-release.sh \
  -o /tmp/xray-install.sh
printf '%s  %s\n' 6e91a3041ee4328f6d30330cdd2916439eb0c61cbeb5fbcf8165fe963cec0872 /tmp/xray-install.sh | sha256sum -c -
bash -n /tmp/xray-install.sh
sudo bash /tmp/xray-install.sh install --version 26.10.29
/usr/local/bin/xray version
INSTALL_XRAY
```

安装器固定到官方仓库的一个提交，下载后校验 SHA256；下载或校验失败就停止，不改用来历不明的一键脚本。成功标准：版本含 26.10.29，id xray 能查到专用用户。这不是“永远适用的最新版本”承诺。

官方安装器：https://github.com/XTLS/Xray-install

### 5.3 自动生成这台机器的独立参数

下面只用于新服务器。它生成 UUID、REALITY 密钥和 short ID，先检查候选配置再替换；已有入站配置或已有凭据会停止。整块复制，最后一行 PY 也要一起复制：

```bash
sudo python3 - <<'PY'
"""Run as root on a NEW Ubuntu server after installing official Xray."""
import grp
import json
import os
from pathlib import Path
import secrets
import subprocess
import uuid

port = 443
config_path = Path('/usr/local/etc/xray/config.json')
client_path = Path('/root/oracle-reality-client.json')
if client_path.exists():
    raise SystemExit('已有客户端凭据，停止以免覆盖。请不要重复执行。')
old = json.loads(config_path.read_text().strip() or '{}') if config_path.exists() else {}
if old.get('inbounds'):
    raise SystemExit('检测到已有入站配置，停止。请先确认这是一台全新服务器。')
raw = subprocess.check_output(['/usr/local/bin/xray', 'x25519'], text=True)
keys = {}
for line in raw.splitlines():
    name, separator, value = line.partition(':')
    if separator:
        keys[''.join(name.lower().split())] = value.strip()
private_key = keys.get('privatekey')
public_key = keys.get('password(publickey)') or keys.get('password') or keys.get('publickey')
if not private_key or not public_key:
    raise SystemExit('无法识别密钥输出，未写入配置。')
client = {'port': port, 'uuid': str(uuid.uuid4()), 'public_key': public_key,
          'short_id': secrets.token_hex(8), 'server_name': 'dl.google.com'}
config = {
    'log': {'access': 'none', 'loglevel': 'warning'},
    'inbounds': [{
        'listen': '0.0.0.0', 'port': port, 'protocol': 'vless',
        'settings': {'clients': [{'id': client['uuid'], 'flow': 'xtls-rprx-vision'}],
                     'decryption': 'none'},
        'streamSettings': {
            'network': 'raw', 'security': 'reality',
            'realitySettings': {'show': False, 'target': 'dl.google.com:443',
                'xver': 0, 'serverNames': ['dl.google.com'],
                'privateKey': private_key, 'shortIds': [client['short_id']]}
        }
    }],
    'outbounds': [{'tag': 'direct', 'protocol': 'freedom'},
                  {'tag': 'blocked', 'protocol': 'blackhole'}],
    'routing': {'domainStrategy': 'IPIfNonMatch', 'rules': [{
        'type': 'field', 'ip': ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10',
            '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.168.0.0/16',
            '198.18.0.0/15', '224.0.0.0/4', '240.0.0.0/4',
            '::/128', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8'],
        'outboundTag': 'blocked'}]}
}
candidate = config_path.with_name('config.guide-candidate.json')
fd = os.open(candidate, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
with os.fdopen(fd, 'w') as stream:
    json.dump(config, stream, indent=2)
os.chown(candidate, 0, grp.getgrnam('xray').gr_gid)
check = subprocess.run(['sudo', '-u', 'xray', '/usr/local/bin/xray',
    'run', '-test', '-config', str(candidate)], capture_output=True)
if check.returncode:
    candidate.unlink()
    raise SystemExit('配置检查失败，原配置未改。请核对安装版本。')
if config_path.exists():
    backup = config_path.with_name('config.before-guide.json')
    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(config_path.read_bytes())
os.replace(candidate, config_path)
fd = os.open(client_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as stream:
    json.dump(client, stream, indent=2)
print('配置检查通过。客户端参数已私密保存到 /root/oracle-reality-client.json')
PY
```

客户端记录不含服务端 privateKey。新版密钥输出可能把公钥标成 Password (PublicKey) / Password，脚本兼容这些字段。不要把 PrivateKey 填进客户端。

dl.google.com 是本文实测使用的 TLS 目标，不是你要购买、解析的域名。若以后服务器无法连接这个目标，需要同时调整服务端 target / serverNames 和客户端 servername；不要只改一边。

### 5.4 收紧权限并启动

```bash
bash <<'START_XRAY'
set -euo pipefail
sudo mkdir -p /etc/systemd/system/xray.service.d
sudo tee /etc/systemd/system/xray.service.d/20-oracle-guide.conf >/dev/null <<'UNIT'
[Service]
User=xray
Group=xray
CapabilityBoundingSet=
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=
AmbientCapabilities=CAP_NET_BIND_SERVICE
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/run/xray
UNIT
sudo systemctl daemon-reload
sudo -u xray /usr/local/bin/xray run -test -config /usr/local/etc/xray/config.json
sudo systemctl enable --now xray
sudo systemctl restart xray
sudo systemctl is-active xray
sudo systemctl is-enabled xray
sudo ss -lntp | grep ':443'
START_XRAY
```

成功标准：配置测试通过，服务为 active / enabled，并监听 0.0.0.0:443。这里只证明程序启动，不代表客户端一定能上网。

查看客户端参数：

```bash
sudo cat /root/oracle-reality-client.json
```

记录 port、uuid、public_key、short_id、server_name，保存在自己的密码管理器或私密笔记。不要把这个输出截图公开。

## 六、第二台照做，凭据独立

在第二台 SSH 窗口重复第四、第五节。共用的云端列表已有 TCP 443 时不用再加同样规则；主机规则和 Xray 配置每台都要做。

把两台参数分别标记“主用”和“备用”。第二台应生成另一套参数，不复制第一台的客户端记录当作备用参数。

## 七、FlClash 导入双节点（自己的电脑操作）

官方 Releases 按系统选择安装包，不从名称相近的网站或不明镜像下载安装器：

https://github.com/chen08209/FlClash/releases

新建纯文本文件 Oracle-FlClash.yaml。Mac 文本编辑器先切到纯文本；Windows 记事本保存类型选“所有文件”，避免存成 .yaml.txt。整份复制：

```yaml
mixed-port: 7890
allow-lan: false
mode: rule
log-level: warning
ipv6: false
dns:
  enable: true
  enhanced-mode: fake-ip
  nameserver:
  - https://dns.alidns.com/dns-query
  default-nameserver:
  - 223.5.5.5
  - 119.29.29.29
proxies:
- name: Oracle 主用
  type: vless
  server: 203.0.113.10
  port: 443
  uuid: YOUR_MAIN_UUID
  network: tcp
  udp: true
  tls: true
  flow: xtls-rprx-vision
  servername: dl.google.com
  client-fingerprint: chrome
  skip-cert-verify: false
  reality-opts:
    public-key: YOUR_MAIN_PUBLIC_KEY
    short-id: YOUR_MAIN_SHORT_ID
    support-x25519mlkem768: true
- name: Oracle 备用
  type: vless
  server: 203.0.113.20
  port: 443
  uuid: YOUR_BACKUP_UUID
  network: tcp
  udp: true
  tls: true
  flow: xtls-rprx-vision
  servername: dl.google.com
  client-fingerprint: chrome
  skip-cert-verify: false
  reality-opts:
    public-key: YOUR_BACKUP_PUBLIC_KEY
    short-id: YOUR_BACKUP_SHORT_ID
    support-x25519mlkem768: true
proxy-groups:
- name: Oracle 双节点
  type: select
  proxies:
  - 自动主备
  - Oracle 主用
  - Oracle 备用
- name: 自动主备
  type: fallback
  proxies:
  - Oracle 主用
  - Oracle 备用
  url: https://www.gstatic.com/generate_204
  interval: 180
  lazy: true
rules:
- IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
- IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
- DOMAIN-SUFFIX,cn,DIRECT
- MATCH,Oracle 双节点
```

替换八个值：主用和备用各自的 server（真实公网 IPv4）、uuid、public-key、short-id。YOUR_* 必须全部替换。servername 与对应服务端一致；改过端口的节点，还要修改 port。

FlClash 进入 配置 → 添加 / ＋ → 文件，选择 YAML，保存并选中。按钮文字可能随版本变化，核心顺序是“添加配置 → 导入文件 → 选中配置”。

代理页先将 Oracle 双节点切为 Oracle 主用，单独测通；再选 Oracle 备用测通。两台都正常后再选自动主备。fallback 优先第一个可用节点，不是永远选延迟最低的节点；180 秒检查也不能让正在下载的连接无缝搬家。

示例为减少第一次导入的资源依赖，没有使用 GeoIP 数据下载。它只让私网和 .cn 域名直连，其他流量经节点，不是“所有国内网站都自动直连”。连接跑通后，再逐步增加分流规则。

## 八、可选：做成自己的 HTTPS 订阅

本地文件已经能用，不买域名也可以停在这里。订阅只是让客户端从同一地址重新下载配置，不会自动知道服务器改了什么，也不会加速。

下面是给没有网站 / Caddy 的新 Ubuntu 服务器准备的独立托管示例。不要把个人代理配置混入现有产品仓库或覆盖已有网站。已有服务时先单独确定托管位置，不照抄此节。

为避免与 REALITY 的 TCP 443 冲突，订阅监听 HTTPS 8443；TCP 80 用于证书申请和续期。这部分是独立配置示例，域名解析与证书签发需要你在自己的环境验证，不是所有网站环境的通用迁移命令。

### 8.1 域名和端口

在自己的 DNS 控制台添加 A：名称 sub，值为主用服务器公网 IPv4，使用仅 DNS。sub.example.com 必须换成你拥有的真实域名。暂不设置 AAAA，也不启用 Cloudflare 橙云代理。

实际关联的云端安全列表 / NSG 再加 Stateful TCP 80 和 8443，来源 0.0.0.0/0。若用第四节模板，主机执行：

```bash
sudo systemctl enable --now oracle-port@80.service oracle-port@8443.service
```

使用 UFW 则分别允许 80/tcp、8443/tcp。确认 80 和 8443 没有已有服务，不要停掉仍在用的网站来腾端口。

### 8.2 安装独立 Caddy（服务器执行）

只在没有现有 Caddy 的新机器执行：

```bash
bash <<'INSTALL_CADDY'
set -euo pipefail
if command -v caddy >/dev/null 2>&1; then
  echo '检测到已有 Caddy，停止。请先检查现有网站配置。' >&2
  exit 1
fi
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
sudo install -d -o root -g caddy -m 750 /srv/oracle-subscription
INSTALL_CADDY
```

官方说明：https://caddyserver.com/docs/install#debian-ubuntu-raspbian

### 8.3 上传客户端 YAML

在自己的电脑切到保存 YAML 的目录，确认所有 YOUR_* 已替换后执行：

```bash
scp -i ~/Downloads/ssh-key.key Oracle-FlClash.yaml ubuntu@203.0.113.10:~/Oracle-FlClash.yaml
```

回到服务器执行：

```bash
sudo install -o root -g caddy -m 640 ~/Oracle-FlClash.yaml /srv/oracle-subscription/clash.yaml
rm ~/Oracle-FlClash.yaml
```

只上传客户端 YAML，不上传 SSH 私钥或服务端 config.json。YAML 包含可用节点的凭据，不能提交到公开仓库。

### 8.4 生成独立 Caddyfile

先把命令里的 sub.example.com 换成自己的真实域名，再整块复制。它备份刚安装的默认配置，并生成 256 位随机路径。不要重复生成，否则旧订阅地址会改变：

```bash
sudo python3 - sub.example.com <<'PY'
import grp
import os
from pathlib import Path
import secrets
import shutil
import sys

domain = sys.argv[1]
if not domain or '.' not in domain or domain == 'sub.example.com' or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789.-' for c in domain):
    raise SystemExit('请先填入你自己的真实域名。')
config = Path('/etc/caddy/Caddyfile')
backup = Path('/etc/caddy/Caddyfile.before-oracle-sub')
if backup.exists():
    raise SystemExit('已有备份，停止以免更换正在使用的订阅路径。')
shutil.copy2(config, backup)
backup.chmod(0o600)
token = secrets.token_hex(32)
text = """{
    https_port 8443
    log {
        format filter {
            wrap json
            fields {
                request>uri delete
                request>headers delete
                resp_headers delete
            }
        }
    }
}
https://__DOMAIN__:8443 {
    tls {
        issuer acme {
            disable_tlsalpn_challenge
        }
    }
    @subscription {
        path /sub/__TOKEN__/clash.yaml
        method GET HEAD
    }
    handle @subscription {
        root * /srv/oracle-subscription
        rewrite * /clash.yaml
        header {
            Content-Type "application/yaml; charset=utf-8"
            Cache-Control "private, no-store"
            X-Robots-Tag "noindex, nofollow, noarchive"
            X-Content-Type-Options nosniff
            profile-update-interval "24"
        }
        file_server
    }
    handle {
        respond 404
    }
}
""".replace('__DOMAIN__', domain).replace('__TOKEN__', token)
config.write_text(text)
os.chown(config, 0, grp.getgrnam('caddy').gr_gid)
config.chmod(0o640)
print('只在自己的设备保存，不要公开：')
print(f'https://{domain}:8443/sub/{token}/clash.yaml')
PY
```

先验证，看到配置有效后，再单独执行后面的重载命令：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

验证成功才执行：

```bash
sudo systemctl reload caddy
sudo systemctl enable caddy
sudo journalctl -u caddy -n 30 --no-pager
```

验证失败就停止。需要恢复时，将备份 /etc/caddy/Caddyfile.before-oracle-sub 复制回 /etc/caddy/Caddyfile，再验证后重载。已有网站不适用这段。

输出地址里的 :8443 和随机路径必须保留。Caddy 用 TCP 80 做 HTTP 证书验证，DNS 必须指向这台服务器，80 必须可从公网访问。示例显式关闭 TLS-ALPN challenge，避免验证流量与 REALITY 的 443 冲突。不要用 curl -k、跳过证书校验或裸 HTTP 传真实凭据。

### 8.5 验证并导入

在自己的电脑打开完整地址，应下载 YAML；访问首页或错误路径应返回 404。替换下面的占位地址测试：

```bash
curl -I 'https://sub.example.com:8443/sub/YOUR_RANDOM_TOKEN/clash.yaml'
curl -I 'https://sub.example.com:8443/sub/wrong-token/clash.yaml'
```

正确地址应为 HTTPS 200，Content-Type 是 application/yaml，Cache-Control 含 private / no-store；错误地址是 404。证书错误先查 DNS、80 端口和 Caddy 日志，不绕过验证。

核对下载内容，再到 FlClash 配置 → 添加 → 链接 / URL，粘贴完整地址，保存选中。重新单独测试主用、备用，确认没有用到旧配置。

完整链接相当于钥匙，不要公开截图、二维码、贴到博客或第三方订阅转换网站。随机路径减少被猜中的机会，泄露后要换路径；如果别人已经下载了 YAML，还要轮换节点凭据。

更新节点时，先改并验证本地 YAML，再上传覆盖 /srv/oracle-subscription/clash.yaml，最后在客户端更新。不重新生成路径。24 小时响应头是更新提示，是否自动更新取决于客户端设置；本文没有创建服务器定时任务。

## 九、日常维护与暂停

私钥和配置放在自己的加密备份里。暂停代理：

```bash
sudo systemctl disable --now xray
```

订阅也不用了，再停 Caddy 并移除对应云端端口。要移除模板管理的 443 入站规则，在服务器执行：

```bash
sudo systemctl disable --now oracle-port@443.service
```

不要误删 SSH 22 或整个共用安全列表。

升级前备份服务端配置和客户端 YAML，一次只升级一台，真实 HTTPS 测试成功后再升级另一台。免费实例可能被闲置回收，政策与流量额度也会变化；定期看账单、实例状态，不能把 Always Free 理解成无限流量、永久保活或绝对零费用。

这次的经验是：先单台连通，再自动主备，最后才加订阅。排错按“服务 → 两层防火墙 → 凭据和兼容字段 → 实际 HTTPS”逐层验证，比反复重装更容易找到原因。

