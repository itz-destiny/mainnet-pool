# PowerShell script to start the Stratum server with environment variables

# Set environment variables for this session
# For regtest, the RPC port is 18443 (configured in docker-compose)
# If bitcoind is running locally without Docker, use port 8332
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpass@127.0.0.1:18443"
$env:COINBASE_PAYOUT_ADDRESS = "bc1q96n65zzfhtgehuyu0307jtz44lk6usu77rkewm"

Write-Host "Environment variables set:" -ForegroundColor Green
Write-Host "BITCOIND_RPC_URL=$env:BITCOIND_RPC_URL" -ForegroundColor Cyan
Write-Host "COINBASE_PAYOUT_ADDRESS=$env:COINBASE_PAYOUT_ADDRESS" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host ""

# Start the server
node server_stratum_v1_production.js

