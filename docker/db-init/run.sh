#!/bin/bash
# Wrapper script to handle CRLF line endings in init-db.sh
tr -d '\r' < /init-db.sh | bash
