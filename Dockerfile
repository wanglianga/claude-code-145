# ---- 构建阶段 ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# 使用项目内缓存，规避部分环境 npm 缓存目录权限问题
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
