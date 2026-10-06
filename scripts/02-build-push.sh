#!/usr/bin/env bash
set -euo pipefail
: "${DOCKERHUB_USER:?export DOCKERHUB_USER=<your dockerhub username>}"
docker login -u "$DOCKERHUB_USER"
for s in frontend backend payment; do
  docker build -t "$DOCKERHUB_USER/shopfast-$s:v1" "./$s"
  docker push "$DOCKERHUB_USER/shopfast-$s:v1"
done
docker images | grep shopfast
