#!/usr/bin/env bash
# Run ON the EC2 instance (Ubuntu 24.04): Docker + single-node k3s + kubectl config.
set -euo pipefail
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git unzip dnsutils jq
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# k3s bundles CoreDNS, metrics-server (needed by HPA) and local-path storage (for PVCs)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644" sh -
mkdir -p ~/.kube && cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
echo 'export KUBECONFIG=$HOME/.kube/config' >> ~/.bashrc
echo 'alias k=kubectl' >> ~/.bashrc
echo "Done. Log out and back in (docker group), then run: kubectl get nodes"
