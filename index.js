import { Platform, Dimensions } from "react-native";
import { Constants } from "expo";
import { Buffer } from "buffer";

const MIXPANEL_API_URL = "http://api.mixpanel.com";
const IPIFY_API_URL = "https://api.ipify.org/?format=json";
const isIosPlatform = Platform.OS === "ios";

export default class ExpoMixpanelAnalytics {
  constructor(token) {
    this.ready = false;
    this.queue = [];
    this.token = token;
    this.clientId = Constants.deviceId;
    this.userId = this.clientId;
    this.properties = {
      token,
      mp_lib: "React Native Reservamos",
      $lib_version: "1.0.1"
    };
    const onAsyncFinished = () => {
      const { width, height } = Dimensions.get("window");
      this.properties.$screen_width = `${width}`;
      this.properties.$screen_height = `${height}`;
      this.properties.distinct_id = Constants.deviceId;
      this.properties.id = Constants.deviceId;
      this.properties.$app_version_string = Constants.manifest.version;
      if (isIosPlatform) {
        this.properties.$os = "iOS";
        this.properties.platform = Constants.platform.ios.platform;
        this.properties.$model = Constants.platform.ios.model;
        this.properties.$os_version = Constants.platform.ios.systemVersion;
      } else {
        this.properties.platform = "android";
        this.properties.$os = "Android";
      }
      this.ready = true;
      this._flush();
    };
    const promiseGetIP = fetch(IPIFY_API_URL)
      .then(response => response.json())
      .then(({ ip }) => {
        this.properties.ip = ip;
      });
    const getUserAgent = Constants.getWebViewUserAgentAsync().then(
      userAgent => {
        this.properties.$browser = userAgent;
      }
    );
    Promise.all([promiseGetIP, getUserAgent])
      .then(onAsyncFinished)
      .catch(err => console.log("error setting data"));
  }

  track(name, props = {}) {
    this.queue.push({
      name,
      props
    });
    this._flush();
  }

  identify(userId) {
    this.userId = userId;
  }

  reset() {
    this.identify(this.clientId);
  }

  people_set(props) {
    this._people("set", props);
  }

  people_set_once(props) {
    this._people("set_once", props);
  }

  people_unset(props) {
    this._people("unset", props);
  }

  people_increment(props) {
    this._people("add", props);
  }

  people_append(props) {
    this._people("append", props);
  }

  people_union(props) {
    this._people("union", props);
  }

  people_delete_user() {
    this._people("delete", "");
  }

  getDistinctId() {
    return this.userId;
  }

  // ===========================================================================================

  _flush() {
    if (this.ready) {
      while (this.queue.length) {
        const event = this.queue.pop();
        this._pushEvent(event).then(() => (event.sent = true));
      }
    }
  }

  _people(operation, props) {
    if (this.userId) {
      const data = {
        $token: this.token,
        $distinct_id: this.userId
      };
      data[`$${operation}`] = props;

      this._pushProfile(data);
    }
  }

  _pushEvent(event) {
    let data = {
      event: event.name,
      properties: { ...this.properties, ...event.props }
    };

    data = new Buffer(JSON.stringify(data)).toString("base64");

    return fetch(`${MIXPANEL_API_URL}/track/?data=${data}`);
  }

  _pushProfile(data) {
    data = new Buffer(JSON.stringify(data)).toString("base64");
    return fetch(`${MIXPANEL_API_URL}/engage/?data=${data}`);
  }
}
