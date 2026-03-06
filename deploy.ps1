Set-Location $PSScriptRoot

docker stop static-site 2>$null
docker rm static-site 2>$null

docker build -t static-site .
docker run -d -p 8080:80 --name static-site static-site

Write-Host "Website deployed at http://localhost:8080"
