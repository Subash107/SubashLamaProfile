# Dockerfile for Static Website
FROM nginx:alpine
COPY . /usr/share/nginx/html
