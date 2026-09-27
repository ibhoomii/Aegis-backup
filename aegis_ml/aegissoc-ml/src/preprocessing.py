"""
preprocessing.py
----------------
Loads the NSL-KDD network intrusion dataset (Canadian Institute for
Cybersecurity) and builds the feature-preprocessing pipeline used by the
AegisSOC ML Anomaly Detection service.

NSL-KDD is a refined, de-duplicated version of the classic KDD Cup 99
dataset and is a standard benchmark for network intrusion / anomaly
detection research. Each row is one summarized network connection record
with 41 features plus an attack-type label.
"""
from __future__ import annotations

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

# ---------------------------------------------------------------------------
# Column definitions (official NSL-KDD schema — 41 features + label + difficulty)
# ---------------------------------------------------------------------------
COLUMN_NAMES = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root", "num_file_creations",
    "num_shells", "num_access_files", "num_outbound_cmds", "is_host_login",
    "is_guest_login", "count", "srv_count", "serror_rate", "srv_serror_rate",
    "rerror_rate", "srv_rerror_rate", "same_srv_rate", "diff_srv_rate",
    "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate", "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate", "dst_host_serror_rate", "dst_host_srv_serror_rate",
    "dst_host_rerror_rate", "dst_host_srv_rerror_rate", "label", "difficulty",
]

CATEGORICAL_FEATURES = ["protocol_type", "service", "flag"]
NUMERIC_FEATURES = [
    c for c in COLUMN_NAMES if c not in CATEGORICAL_FEATURES + ["label", "difficulty"]
]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

# ---------------------------------------------------------------------------
# Standard NSL-KDD fine-grained attack -> coarse attack-family mapping.
# Used only for human-readable reporting / MITRE-style grouping — the
# anomaly detector itself is trained without ever seeing these labels.
# ---------------------------------------------------------------------------
ATTACK_CATEGORY_MAP = {
    "normal": "normal",
    # Denial of Service
    "back": "dos", "land": "dos", "neptune": "dos", "pod": "dos", "smurf": "dos",
    "teardrop": "dos", "apache2": "dos", "udpstorm": "dos", "processtable": "dos",
    "worm": "dos", "mailbomb": "dos",
    # Surveillance / Probing
    "satan": "probe", "ipsweep": "probe", "nmap": "probe", "portsweep": "probe",
    "mscan": "probe", "saint": "probe",
    # Remote-to-Local
    "guess_passwd": "r2l", "ftp_write": "r2l", "imap": "r2l", "phf": "r2l",
    "multihop": "r2l", "warezmaster": "r2l", "warezclient": "r2l", "spy": "r2l",
    "xlock": "r2l", "xsnoop": "r2l", "snmpguess": "r2l", "snmpgetattack": "r2l",
    "httptunnel": "r2l", "sendmail": "r2l", "named": "r2l",
    # User-to-Root
    "buffer_overflow": "u2r", "loadmodule": "u2r", "rootkit": "u2r", "perl": "u2r",
    "sqlattack": "u2r", "xterm": "u2r", "ps": "u2r",
}

# Rough mapping of attack families to representative MITRE ATT&CK techniques,
# mirroring the mapping style described in the AegisSOC design doc.
ATTACK_TO_MITRE = {
    "dos": ["T1498", "T1499"],       # Network / Endpoint Denial of Service
    "probe": ["T1595", "T1046"],     # Active Scanning / Network Service Discovery
    "r2l": ["T1110", "T1078"],       # Brute Force / Valid Accounts
    "u2r": ["T1068", "T1548"],       # Privilege Escalation
    "normal": [],
}


def load_dataset(train_path: str, test_path: str):
    """Load the raw NSL-KDD train/test files and derive labels."""
    train_df = pd.read_csv(train_path, names=COLUMN_NAMES)
    test_df = pd.read_csv(test_path, names=COLUMN_NAMES)

    for df in (train_df, test_df):
        df.drop(columns=["difficulty"], inplace=True)
        df["attack_category"] = df["label"].map(
            lambda x: ATTACK_CATEGORY_MAP.get(x, "unknown")
        )
        df["is_anomaly"] = (df["label"] != "normal").astype(int)

    return train_df, test_df


def build_preprocessor() -> ColumnTransformer:
    """
    One-hot encode categorical network fields, standardize numeric fields.
    handle_unknown='ignore' is important: the NSL-KDD test set contains
    'service' values never seen in training (e.g. 'icmp'-only services),
    and in production new categorical values will show up over time too.
    """
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ]
    )


def get_feature_names(preprocessor: ColumnTransformer) -> list[str]:
    cat_names = list(
        preprocessor.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_FEATURES)
    )
    return cat_names + NUMERIC_FEATURES
