import { Platform, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import * as Device from "expo-device";
import { Buffer } from "buffer";
import { v1 as uuidv1 } from "uuid";
import pkg from "./package.json";
import getIP from "./src/getIP";
import getInstallationIdAsync from "./src/getInstallationId";

const UUID_STORAGE = "@MP_RESERVAMOS_LIB_STORAGE:UUID";
const MIXPANEL_API_URL = "https://api.mixpanel.com";
const MIXPANEL_API_URL_TRACK = `${MIXPANEL_API_URL}/track/?data=`;
const MIXPANEL_API_URL_ENGAGE = `${MIXPANEL_API_URL}/engage/?data=`;

export default class ExpoMixpanelAnalytics {
  constructor(token) {
    this.ready = false;
    this.queue = [];
    this.token = token;
    this.userId = null;
    this._setProperties();
  }

  async _getUUID() {
    let uniqueId = null;
    try {
      uniqueId = await AsyncStorage.getItem(UUID_STORAGE);
    } catch (e) {
      console.log(e);
    }
    if (!uniqueId) {
      uniqueId = await getInstallationIdAsync();
    }

    return uniqueId;
  }

  _saveUUID(uuid) {
    AsyncStorage.setItem(UUID_STORAGE, uuid);
  }

  _parseUserAgent(userAgent) {
    if (!userAgent || userAgent.split(";").length !== 4) return {};
    return {
      osVersion: userAgent.split(";")[2].trim(),
      model: userAgent.split(";")[3].trim().slice(0, -1),
    };
  }

  async _setProperties() {
    this.properties = {
      token: this.token,
      mp_lib: "React Native Reservamos",
      $lib_version: pkg.version,
    };

    try {
      const ipResponse = await getIP();
      this.properties.ip = ipResponse.ip;

      const { width, height } = Dimensions.get("window");
      this.properties.$screen_width = `${width}`;
      this.properties.$screen_height = `${height}`;
      this.properties.$device_id = await getInstallationIdAsync();
      this.properties.$app_version_string = Updates?.manifest?.version;
      this.properties.distinct_id = await this._getUUID();
      this.properties["$user_id"] = await this._getUUID();
      this.properties.$browser = await Constants.getWebViewUserAgentAsync();
    } catch (e) {
      console.log(e);
    }

    if (Platform.OS === "ios") {
      this.properties.$os = "iOS";
      this.properties.platform = Constants.platform.ios.platform;
      this.properties.$os_version = Constants.platform.ios.systemVersion;
      this.properties.$model = Device.modelName;
      this.properties.$ios_app_version = Updates?.manifest?.version;
    } else {
      this.properties.$os = "Android";
      this.properties.platform = "android";
      this.properties["Android API Version"] = Platform.Version;
      const { osVersion, model } = this._parseUserAgent(
        this.properties.$browser
      );
      this.properties.$os_version = osVersion;
      this.properties.$model = model;
      this.properties.$android_app_version = Updates?.manifest?.version;
    }

    this.ready = true;
    this._flush();
  }

  track(name, props = {}) {
    this.queue.push({
      name,
      props,
    });
    this._flush();
  }

  identify(userId, traits) {
    const id = userId || this.properties.distinct_id;
    this.track("$identify", {
      distinct_id: id,
      $anon_distinct_id: this.properties.distinct_id,
    });
    this.userId = id;
    this.properties["$user_id"] = id;
    this.properties.distinct_id = id;
    if (traits) {
      this.people_set(traits);
    }
    this._saveUUID(this.userId);
  }

  alias(alias, traits) {
    this.track("$create_alias", {
      alias: alias,
      distinct_id: this.properties.distinct_id,
    });

    this.identify(alias, traits);
  }

  reset() {
    const uuid = uuidv1();
    this.properties.distinct_id = uuid;
    this.properties.$device_id = uuid;
    this.properties["$user_id"] = uuid;
    this.userId = null;
    this._saveUUID(uuid);
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
    return this.userId || this.properties.distinct_id;
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
        $distinct_id: this.userId,
      };
      data[`$${operation}`] = props;

      this._pushProfile(data);
    }
  }

  _pushEvent(event) {
    let data = {
      event: event.name,
      properties: { ...this.properties, ...event.props },
    };

    data = new Buffer(JSON.stringify(data)).toString("base64");

    return fetch(MIXPANEL_API_URL_TRACK + data);
  }

  _pushProfile(data) {
    data = new Buffer(JSON.stringify(data)).toString("base64");
    return fetch(MIXPANEL_API_URL_ENGAGE + data);
  }
}
