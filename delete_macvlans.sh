#!/bin/bash

# --- Configuration ---
BASE_NAME="onvif-proxy"
NUM_INTERFACES=150

# --- Script Logic ---
echo "This script will attempt to delete interfaces ${BASE_NAME}-1 to ${BASE_NAME}-${NUM_INTERFACES}."
read -p "Press Enter to continue, or Ctrl+C to abort."

for i in $(seq 1 "${NUM_INTERFACES}"); do
    IFACE_NAME="${BASE_NAME}-${i}"

    if ip link show "${IFACE_NAME}" &>/dev/null; then
        echo "----------------------------------------------------"
        echo "Deleting interface: ${IFACE_NAME}"
        echo "Bringing down: sudo ip link set ${IFACE_NAME} down"
        sudo ip link set "${IFACE_NAME}" down
        # Sometimes it takes a moment for the OS to fully process the 'down' state
        # before 'delete' can succeed without error, though usually not needed for macvlan.
        # sleep 0.1 

        echo "Deleting link: sudo ip link delete ${IFACE_NAME}"
        sudo ip link delete "${IFACE_NAME}"
        if [ $? -ne 0 ]; then
            echo "Error deleting link ${IFACE_NAME}. It might have already been deleted or there was an issue."
        fi
    else
        echo "Interface ${IFACE_NAME} does not exist. Skipping."
    fi
done

echo "----------------------------------------------------"
echo "Cleanup finished."
echo "Verify with: ip addr | grep '${BASE_NAME}-'"
echo "Or: ip link show type macvlan"
echo "----------------------------------------------------"

exit 0
