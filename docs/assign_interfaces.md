# Virtual ONVIF Interface Assignment Script

## Introduction

The `assign_interfaces.js` script is designed to automate the assignment of available MAC addresses from a database to placeholder entries within ONVIF configuration files. It also manages the status of these interfaces within the database, marking them as assigned.

## Database

The script utilizes a SQLite database named `virtual_interfaces.db`. This database contains a single table:

*   **`virtual_interfaces`**: Stores information about the virtual network interfaces.
    *   `mac_address`: (TEXT) The unique MAC address of the virtual interface.
    *   `ip_address`: (TEXT) The IP address assigned to the virtual interface.
    *   `status`: (TEXT) The current status of the virtual interface. Possible values include:
        *   `available`: The interface is ready to be assigned.
        *   `assigned`: The interface has been assigned to an ONVIF configuration.
        *   `error`: An error occurred with this interface.

## Usage

The `assign_interfaces.js` script can be executed from the command line using Node.js.

```bash
node assign_interfaces.js [options]
```

**Options:**

*   `--config <file>` or `-c <file>`: Specifies the input ONVIF configuration file to process. If not provided, the script defaults to processing `./NVR-Configs/192.168.6.201.yaml`.
*   `--output <file>`: Specifies the output file where the modified configuration will be saved. If not provided, the script will modify the input file in place.

**Examples:**

1.  Process the default configuration file in place:
    ```bash
    node assign_interfaces.js
    ```
2.  Process a specific configuration file and modify it in place:
    ```bash
    node assign_interfaces.js --config ./NVR-Configs/my_nvr_config.yaml
    ```
3.  Process a specific configuration file and save the output to a new file:
    ```bash
    node assign_interfaces.js -c ./NVR-Configs/template.yaml --output ./NVR-Configs/assigned_config.yaml
    ```

## Logic

The script performs the following core steps:

1.  Reads the ONVIF configuration file (either the default or specified via `--config`).
2.  Connects to the `virtual_interfaces.db` database.
3.  Queries the database for available interfaces (`status = 'available'`).
4.  Iterates through the configuration, finding placeholders where MAC addresses need to be assigned.
5.  Assigns available MAC addresses and their corresponding IP addresses from the database to the placeholders in the configuration.
6.  Updates the status of the assigned interfaces in the `virtual_interfaces` database table to `assigned`.
7.  Writes the modified configuration to the output file (either the input file or specified via `--output`).
8.  Includes error handling to check if enough available interfaces exist in the database for the number of placeholders in the configuration. If not, the script will report an error.