#!/bin/sh

set -eux

ceramic daemon --network inmemory > /dev/null 2> /dev/null &

wait-on tcp:7007 && node src/bootstrap.js http://127.0.0.1:7007

hardhat test

npm run check-pretty

kill -INT %1
