ItSet-Location "D:\CICD Static Website"

docker stop static-site -ErrorAction SilentlyContinue
docker rm static-site -ErrorAction SilentlyContinue

docker build -t static-site .
docker run -d -p 8080:80 --name static-site static-site

Write-Host "🚀 Website deployed at http://localhost:8080"