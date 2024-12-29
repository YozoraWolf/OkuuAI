/**
 * This script is used to sync the ngrok url with the proxy server.
 * We do this by getting the ngrok url and updating the proxy server with the new url.
 * Please set the PROXY_* env variables in the .env file before running this script.
**/

import dotenv from 'dotenv';

dotenv.config();

import axios from 'axios';
import { Logger } from '@src/logger';
import { exit } from 'process';

const proxy_url = process.env.WEB_URL || '';
const proxy_email = process.env.PROXY_EMAIL || '';
const proxy_password = process.env.PROXY_PWD || '';
const proxy_fwd_url = process.env.PROXY_FWD || '';

let token = "";

const getNgrokURl = async () => {
    const res = await axios.get('http://localhost:4040/api/tunnels');
    const tunnel = res.data.tunnels.find((tunnel: any) => tunnel.config.addr.includes(`http://localhost:${process.env.PORT}`));
    if(!tunnel) {
        Logger.ERROR('Tunnel not found');
        return false;
    }
    const url = tunnel.public_url.replace(/^https?:\/\//, '');
    return url;
}

async function isNgrokLoaded() {
    console.log('Waiting for Ngrok to connect...');
    while (true) {
      try {
        const response = await axios.get('http://localhost:4040/api/tunnels');
        const tunnels = response.data.tunnels;
        if (tunnels.length > 0) {
          console.log(`Ngrok connected: ${tunnels[0].public_url}`);
          return true;
        }
      } catch (err) {
        console.log('Ngrok not ready yet, retrying...');
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 1 second before retrying
    }
  }

const getToken = async () => {
    console.log(proxy_email, proxy_password);
    const res = await axios.post(`${proxy_url}:81/api/tokens`, {
        identity: proxy_email,
        secret: proxy_password
    });

    return res.data.token;
}

const getRedirHosts = async () => {
    const res = await axios.get(`${proxy_url}:81/api/nginx/redirection-hosts`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    return res.data;
}

const updateOkuuAIRedirHost = async (id: number) => {
    await isNgrokLoaded();
    const ngrok_url = await getNgrokURl();
    if(!ngrok_url) {
        Logger.ERROR('Error getting ngrok url');
        return false;
    }
    const res = await axios.put(`${proxy_url}:81/api/nginx/redirection-hosts/${id}`, {
        forward_domain_name: `${ngrok_url}`
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if(res.status !== 200) {
        Logger.ERROR('Error updating host');
        return false;
    }

    return res.data;
}

const init = async () => {
    Logger.INFO('Syncing ngrok with proxy...');
    token = await getToken();
    const hosts = await getRedirHosts();
    const okuuai_host = hosts.find((host: any) => host.domain_names[0].includes(proxy_fwd_url));
    if(!okuuai_host) {
        Logger.ERROR('Host not found');
        exit(0);
    }
    const result = await updateOkuuAIRedirHost(okuuai_host.id);
    if(!result) {
        Logger.ERROR('Error updating host');
        exit(0);
    }
    Logger.INFO('Successfully synced ngrok with proxy');
}

init();