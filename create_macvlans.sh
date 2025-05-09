#!/bin/bash

# --- Configuration ---
PARENT_IFACE="enp6s0"         # CHANGE THIS if your main interface is not eth0
BASE_NAME="onvif-proxy"
MAC_PREFIX_STATIC="a2:a2:a2:a2:a2"
IP_NETWORK="192.168.6"
START_IP_LAST_OCTET=3
NUM_INTERFACES=150
NETMASK_CIDR="24"           # e.g., /24 for 255.255.255.0

# --- Script Logic ---
echo "This script will create ${NUM_INTERFACES} macvlan interfaces."
echo "Parent interface: ${PARENT_IFACE}"
echo "IP range: ${IP_NETWORK}.${START_IP_LAST_OCTET} - ${IP_NETWORK}.$((START_IP_LAST_OCTET + NUM_INTERFACES - 1))"
echo "MAC range: ${MAC_PREFIX_STATIC}:01 - ${MAC_PREFIX_STATIC}:$(printf "%02x" ${NUM_INTERFACES})"
echo ""
echo "WARNING: Ensure '${PARENT_IFACE}' is the correct parent interface and the IP range is free."
read -p "Press Enter to continue, or Ctrl+C to abort."

if ! ip link show "$PARENT_IFACE" &>/dev/null; then
    echo "Error: Parent interface ${PARENT_IFACE} does not exist. Please check configuration."
    exit 1
fi

echo "Bringing parent interface ${PARENT_IFACE} up (if not already)..."
sudo ip link set "${PARENT_IFACE}" up
if [ $? -ne 0 ]; then
    echo "Error bringing up parent interface ${PARENT_IFACE}. Aborting."
    exit 1
fi


for i in $(seq 1 "${NUM_INTERFACES}"); do
    IFACE_NAME="${BASE_NAME}-${i}"
    # MAC address: ${MAC_PREFIX_STATIC}:xx where xx is hex of i (e.g., 01, 0a, ff)
    LAST_MAC_OCTET=$(printf "%02x" "${i}")
    MAC_ADDRESS="${MAC_PREFIX_STATIC}:${LAST_MAC_OCTET}"

    # IP address: ${IP_NETWORK}.(START_IP_LAST_OCTET + i - 1)
    CURRENT_IP_LAST_OCTET=$((START_IP_LAST_OCTET + i - 1))
    IP_ADDRESS="${IP_NETWORK}.${CURRENT_IP_LAST_OCTET}/${NETMASK_CIDR}"

    echo "----------------------------------------------------"
    echo "Processing interface #${i}: ${IFACE_NAME}"

    # Check if interface already exists
    if ip link show "${IFACE_NAME}" &>/dev/null; then
        echo "Interface ${IFACE_NAME} already exists. Verifying configuration..."
    else
        echo "Creating link: sudo ip link add ${IFACE_NAME} link ${PARENT_IFACE} address ${MAC_ADDRESS} type macvlan mode bridge"
        sudo ip link add "${IFACE_NAME}" link "${PARENT_IFACE}" address "${MAC_ADDRESS}" type macvlan mode bridge
        if [ $? -ne 0 ]; then
            echo "Error creating link ${IFACE_NAME}. Aborting further creations."
            exit 1
        fi
    fi

    # Check if IP is already assigned to this interface
    # A simple check; more complex scenarios might need more robust parsing
    if ip addr show dev "${IFACE_NAME}" | grep -q "inet ${IP_NETWORK}.${CURRENT_IP_LAST_OCTET}/"; then
        echo "IP ${IP_ADDRESS} already assigned to ${IFACE_NAME}. Skipping IP assignment."
    else
        echo "Assigning IP: sudo ip addr add ${IP_ADDRESS} dev ${IFACE_NAME}"
        sudo ip addr add "${IP_ADDRESS}" dev "${IFACE_NAME}"
        if [ $? -ne 0 ]; then
            echo "Error assigning IP ${IP_ADDRESS} to ${IFACE_NAME}. Interface may be created without IP."
            # Consider exiting or handling differently if IP assignment is critical
        fi
    fi

    echo "Bringing up: sudo ip link set ${IFACE_NAME} up"
    sudo ip link set "${IFACE_NAME}" up
    if [ $? -ne 0 ]; then
        echo "Error bringing up interface ${IFACE_NAME}."
    fi

    echo # Newline for readability
done

echo "----------------------------------------------------"
echo "Script finished. ${NUM_INTERFACES} interfaces should be configured."
echo "Verify with: ip addr | grep '${BASE_NAME}-'"
echo "Or: ip link show type macvlan"
echo "----------------------------------------------------"

exit 0
