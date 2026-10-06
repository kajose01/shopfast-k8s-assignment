#!/usr/bin/env bash
set -euo pipefail
: "${DOCKERHUB_USER:?}"; : "${DOCKERHUB_PASS:?export DOCKERHUB_PASS=<dockerhub access token>}"
kubectl create secret docker-registry regcred --docker-username="$DOCKERHUB_USER" \
  --docker-password="$DOCKERHUB_PASS" --dry-run=client -o yaml | kubectl apply -f -
sed -i "s#DOCKERHUB_USER#$DOCKERHUB_USER#g" k8s/*.yaml
kubectl apply -f k8s/00-config.yaml -f k8s/10-mongo.yaml -f k8s/20-redis.yaml
kubectl rollout status statefulset/mongo --timeout=180s
kubectl apply -f k8s/30-backend.yaml -f k8s/40-payment.yaml -f k8s/50-frontend.yaml -f k8s/60-hpa-pdb.yaml
for d in backend payment frontend redis; do kubectl rollout status deploy/$d --timeout=180s; done
kubectl get all,pvc,hpa
echo "Open: http://$(curl -s ifconfig.me):30080"
