#!/bin/bash

LOCUST_FILE='locustfile.py'
HOST='http://192.168.52.104:9090'
MASTER_HOST='127.0.0.1'
MASTER_PORT='5557'
INSTANCES=$(grep '^processor' /proc/cpuinfo | wc -l)


mkdir -p 'logs'

locust -f "${LOCUST_FILE}" --host="${HOST}" --master \
	--master-bind-port="${MASTER_PORT}" \
	--master-bind-host="${MASTER_HOST}" \
	--logfile="logs/locust_master.log" &
PID=$!

for i in $(seq $INSTANCES); do
	locust -f "${LOCUST_FILE}" --host="${HOST}" --slave \
		--master-port="${MASTER_PORT}" \
		--master-host="${MASTER_HOST}" \
		--logfile="logs/locust_slave${i}.log" &
done

echo $PID
