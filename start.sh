#!/bin/bash

cd_cmd="cd"
run_cmd="./"
tunnel_flag=false

# Check for --tunnel flag
for arg in "$@"; do
    if [ "$arg" == "--tunnel" ]; then
        tunnel_flag=true
        break
    fi
done

# Detect operating system (Windows/Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cd_cmd="cd"
    run_cmd="./"
    # Linux

    # If tunnel specified modify src-site/okuu-control-center/.env file's variable LOCAL to false else true
    if grep -q "LOCAL=" src-site/okuu-control-center/.env; then
        if [ "$tunnel_flag" = true ]; then
            sed -i 's/LOCAL=.*/LOCAL=false/g' src-site/okuu-control-center/.env
        else
            sed -i 's/LOCAL=.*/LOCAL=true/g' src-site/okuu-control-center/.env
        fi
    else
        if [ "$tunnel_flag" = true ]; then
            echo -e "\nLOCAL=false" >> src-site/okuu-control-center/.env
        else
            echo -e "\nLOCAL=true" >> src-site/okuu-control-center/.env
        fi
    fi

    # Start frontend in a new terminal
    gnome-terminal -- bash -c "cd src-site/okuu-control-center && npm run dev; exec bash"
    sleep 3

    # Start AI Server in a new terminal
    if [ "$tunnel_flag" = true ]; then
        gnome-terminal -- bash -c "npm run start-tunnel; exec bash"
    else
        gnome-terminal -- bash -c "npm run start; exec bash"
    fi
    sleep 3

elif [[ "$OSTYPE" == "msys" ]]; then
    cd_cmd="cd"
    run_cmd="./"
    # Windows


    # If tunnel specified modify src-site/okuu-control-center/.env file's variable LOCAL to false else true (WIP)
    # if [ "$tunnel_flag" = true ]; then
    #     sed -i 's/LOCAL=true/LOCAL=false/g' src-site/okuu-control-center/.env
    # else
    #     sed -i 's/LOCAL=false/LOCAL=true/g' src-site/okuu-control-center/.env
    # fi

    # Start frontend in a new terminal
    start cmd /k "cd src-site/okuu-control-center && npm run dev"
    sleep 3
    
    # Start AI Server in a new terminal
    if [ "$tunnel_flag" = true ]; then
        start cmd /k "npm run start-tunnel"
    else
        start cmd /k "npm run start"
    fi
    sleep 3
else
    echo "Unsupported OS"
    exit 1
fi