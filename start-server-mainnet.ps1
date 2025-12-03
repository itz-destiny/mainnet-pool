# PowerShell script to start the Stratum server for MAINNET

# Set environment variables for this session
# ⚠️ CHANGE THESE TO YOUR ACTUAL VALUES
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpassword@127.0.0.1:8332"
$env:COINBASE_PAYOUT_ADDRESS = "bc1q96n65zzfhtgehuyu0307jtz44lk6usu77rkewm"

Write-Host "Environment variables set:" -ForegroundColor Green
Write-Host "BITCOIND_RPC_URL=$env:BITCOIND_RPC_URL" -ForegroundColor Cyan
Write-Host "COINBASE_PAYOUT_ADDRESS=$env:COINBASE_PAYOUT_ADDRESS" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  MAINNET MODE - Make sure bitcoind is running and synced!" -ForegroundColor Red
Write-Host ""
Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host ""

# Start the server
node server_stratum_v1_production.js


