# Bitcoin Core RPC Port Configuration

## Standard Bitcoin Core Ports

- **Mainnet RPC**: Port `8332` (default)
- **Testnet RPC**: Port `18332` (default)
- **Regtest RPC**: Port `8332` (default) OR `18443` (if configured)

## Docker Configuration

The `docker-compose-regtest.yml` file is configured to:
- Use port `18443` for RPC in regtest mode (via `-rpcport=18443`)
- Map host port `18443` to container port `18443`

## Port Mapping Explanation

The docker-compose port mapping `"18443:18443"` means:
- **Host port** (left): `18443` - what you connect to from your machine
- **Container port** (right): `18443` - what bitcoind listens on inside the container

## Connection URLs

### For Regtest (Docker):
```
BITCOIND_RPC_URL=http://rpcuser:rpcpass@127.0.0.1:18443
```

### For Regtest (Local bitcoind, no Docker):
```
BITCOIND_RPC_URL=http://rpcuser:rpcpass@127.0.0.1:8332
```
(You'd need to configure bitcoind with `-rpcport=8332` or use default)

### For Mainnet:
```
BITCOIND_RPC_URL=http://rpcuser:rpcpassword@127.0.0.1:8332
```

## Troubleshooting Port Issues

1. **Check if bitcoind is running**:
   ```powershell
   docker ps
   ```

2. **Check what port bitcoind is listening on**:
   ```powershell
   docker exec bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass getnetworkinfo
   ```

3. **Test RPC connection**:
   ```powershell
   curl http://rpcuser:rpcpass@127.0.0.1:18443
   ```

4. **Check if port is in use**:
   ```powershell
   netstat -an | findstr 18443
   ```

## Common Issues

### Issue: "ECONNREFUSED 127.0.0.1:18443"
**Cause**: bitcoind not running or wrong port
**Solution**: 
- Start Docker Desktop
- Run `docker compose -f docker-compose-regtest.yml up -d`
- Verify with `docker ps`

### Issue: "ECONNREFUSED 127.0.0.1:8332"
**Cause**: Trying to connect to mainnet port but using regtest
**Solution**: Use port `18443` for regtest

### Issue: Port already in use
**Cause**: Another service using the port
**Solution**: 
- Change the port in docker-compose: `"18444:18443"` (uses 18444 on host)
- Or stop the service using the port


