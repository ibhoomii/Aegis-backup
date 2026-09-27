#!/usr/bin/env bash
# Downloads CICIDS2017 (MachineLearningCSV flavour) used to train the second
# AegisSOC anomaly-detection model. Source: Canadian Institute for
# Cybersecurity — real flow-based captures of benign traffic plus Brute Force,
# DoS/DDoS, Botnet, Port Scan, Web Attacks, Infiltration and Heartbleed.
set -e
cd "$(dirname "$0")"
mkdir -p cicids2017
cd cicids2017

BASE="http://205.174.165.80/CICDataset/CIC-IDS-2017/Dataset/MachineLearningCSV/MachineLearningCVE"

# Wednesday = DoS/Hulk/GoldenEye/Slowloris/slowhttptest + benign (the core file,
# ~290k flows). Friday DDoS + PortScan files add more attack coverage.
FILES=(
  "Wednesday-workingHours.pcap_ISCX.csv"
  "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv"
  "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv"
)

for f in "${FILES[@]}"; do
  if [ -s "$f" ]; then
    echo "already present: $f"
  else
    echo "downloading $f …"
    curl -L --retry 3 -o "$f" "$BASE/$f"
  fi
done

echo "Downloaded:"
wc -l *.csv
