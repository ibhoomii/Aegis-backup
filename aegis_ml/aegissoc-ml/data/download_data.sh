#!/usr/bin/env bash
# Downloads the NSL-KDD dataset (train + test) used to train the
# AegisSOC anomaly-detection model. Source: Canadian Institute for
# Cybersecurity, mirrored on GitHub by the research community.
set -e
cd "$(dirname "$0")"

curl -sL -o KDDTrain+.txt "https://raw.githubusercontent.com/jmnwong/NSL-KDD-Dataset/master/KDDTrain%2B.txt"
curl -sL -o KDDTest+.txt  "https://raw.githubusercontent.com/jmnwong/NSL-KDD-Dataset/master/KDDTest%2B.txt"

echo "Downloaded:"
wc -l KDDTrain+.txt KDDTest+.txt
