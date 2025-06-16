打开 GitHub 下载页面：
👉 https://github.com/coreybutler/nvm-windows/releases

下载最新版本的安装程序：

例如点击 nvm-setup.exe 安装包（不要下载 source code）

双击安装，安装过程注意以下几点：

安装路径 保持默认：C:\Program Files\nvm

Node 安装目录：C:\Program Files\nodejs

安装时会自动把 nvm 添加进系统的环境变量

安装完毕后，务必重启你的 PowerShell 或终端


安装最新 Node.js

nvm install 24.2.0

nvm use 24.2.0


安装 nvm（Node Version Manager） ubuntu
# 步骤 1：运行官方安装脚本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

这会自动把 nvm 安装到 ~/.nvm 目录中，并尝试修改你的 shell 启动配置文件（比如 .bashrc 或 .zshrc）。

# 步骤 2：激活 nvm（重启终端或手动加载）
# 如果你使用 bash：
source ~/.bashrc

# 如果你使用 zsh：
source ~/.zshrc


# 步骤 3：查看所有可用版本
nvm ls-remote

# 步骤 4：安装最新版本的 Node.js
nvm use 24.2.0


