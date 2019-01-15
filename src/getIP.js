const IPIFY_API_URL = "https://api.ipify.org/?format=json";

export default function getIP() {
  return fetch(IPIFY_API_URL).then(response => response.json().ip);
}
