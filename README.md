# ShopFast: Docker & Kubernetes Troubleshooting (Assignment #2)

**Student:** KANKERA JOSEPHINE
**Assignment:** Assignment #2, Advanced Docker & Kubernetes Troubleshooting (Containerized Microservices with High Availability and Smart Traffic Routing), Skillfyme DevOps Program
**Platform:** AWS EC2 (Ubuntu, t3.large, 40 GB gp3), Docker, k3s (single-node Kubernetes)

## 1. Problem statement
ShopFast is an e-commerce platform made of: React.js frontend, Node.js + Express backend, MongoDB, Redis cache and a Python Flask payment service. After traffic spikes it suffered slow responses, database connection failures, intermittent 503 errors and inefficient resource usage.
Tasks: containerize with Docker, deploy to Kubernetes with networking/scaling/monitoring, troubleshoot bottlenecks, and optimize for high availability.

## 2. Solution approach
| Area | What was done |
|---|---|
| Docker | Multi-stage builds (small alpine/slim images, 21-50 MB compressed), non-root users, `.dockerignore`, `HEALTHCHECK`, env vars injected at runtime |
| Compose | Two bridge networks (`web`, internal `data`), health checks on every service, `depends_on: service_healthy`, cpu/memory limits |
| Kubernetes | Deployments with replicas, ClusterIP (backend/redis/payment), NodePort 30080 (frontend), ConfigMap + Secret, MongoDB StatefulSet with PVC, readiness/liveness probes |
| Scaling / HA | HPA (backend 3-10 pods at CPU > 70%), requests/limits, pod anti-affinity, PodDisruptionBudgets, RollingUpdate with `maxUnavailable: 0`, `preStop` drain |
| Bonus | Relative `/api` URLs + `X-Forwarded-Proto` (mixed content fix), Mongo pool/timeout/retry options, log sidecar container |

Troubleshooting details are in **[REPORT.md](REPORT.md)**: service discovery, Redis OOMKilled, DiskPressure on the node, duplicate seed data, Mongo probe tuning.

## 3. Repository structure
```
frontend/ backend/ payment/   source + Dockerfiles
docker-compose.yml            local testing
k8s/                          Kubernetes manifests
troubleshooting/              intentionally broken Redis demo
scripts/                      server setup, build/push, deploy
REPORT.md                     troubleshooting report
```

## 4. Dependencies and setup
- AWS account, EC2 Ubuntu instance (t3.large, 30+ GB disk). Security group: 22 (My IP), 30080 (frontend).
- Docker Hub account and a Read & Write access token.
```bash
./scripts/01-server-setup.sh     # installs Docker + k3s, then log out/in
```

## 5. Execution steps
```bash
# 1. Local test
docker compose up -d --build && docker compose ps && curl localhost:3000/api/products
docker compose down

# 2. Build and push images (kaj1/shopfast-{frontend,backend,payment})
export DOCKERHUB_USER=<user>
./scripts/02-build-push.sh

# 3. Deploy to Kubernetes
export DOCKERHUB_PASS=<access token>
./scripts/03-deploy.sh
kubectl get pods,svc,pvc,hpa
# App: http://<EC2 public IP>:30080
```

### Troubleshooting commands used
```bash
kubectl get endpoints; kubectl describe service backend
kubectl run dns --rm -it --image=busybox:1.36 --restart=Never -- nslookup backend.default.svc.cluster.local
kubectl apply -f troubleshooting/redis-crash-demo.yaml; kubectl logs <pod> --previous; kubectl describe pod <pod>
kubectl logs deploy/backend -c log-sidecar
```

## 6. Notes
- Docker Hub's free plan allows one private repository; the images are in Docker Hub under `kaj1`.
- Secrets in the manifests are placeholders for this exercise. Use a real secret manager in production.
- A single node cannot give true node-level HA; anti-affinity takes effect once a second node is added.

## 7. Screenshots
See the `screenshots/` folder.
