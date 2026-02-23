# Enclave Web UI - Docker Configuration
## Nginx Reverse Proxy Configuration

This Docker container uses nginx as a reverse proxy. The frontend makes all API calls to `/api/*`, and nginx forwards them to the backend server. This eliminates CORS issues and provides a cleaner architecture.

## Environment Variables

The following environment variables can be set when running the Docker container:

### `API_BASE_URL`

- **Description**: Backend API hostname or IP address

### `API_PORT`

- **Description**: Backend API port number

