FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
# npm ci — package-lock.json에 잠긴 버전 그대로 설치해 빌드를 재현 가능하게 만든다
# (npm install은 lock을 무시하고 갱신할 수 있어 CI/로컬 결과가 달라진다)
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
