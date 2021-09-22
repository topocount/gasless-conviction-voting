#!/bin/sh

set -eux

cleanup() {
  kill -INT "$ceramic_pid"
  echo exiting
}

trap cleanup EXIT

npx ceramic daemon --network inmemory > /dev/null 2> /dev/null &
ceramic_pid=$!

wait-on tcp:7007

npx hardhat test

npm run check-pretty
