import { Platform, Dimensions } from 'react-native';
import { Constants } from 'expo';
import { Buffer } from 'buffer';

const { width, height } = Dimensions.get('window');

const MIXPANEL_API_URL = 'http://api.mixpanel.com';
const isIosPlatform = Platform.OS === 'ios';

export default class ExpoMixpanelAnalytics {
  constructor(token) {
    this.setIP = this.setIP.bind(this);
    this.ready = false;
    this.queue = [];

    this.token = token;
    this.userId = null;
    this.clientId = Constants.deviceId;
    this.identify(this.clientId);
    fetch('https://api.ipify.org/?format=json')
      .then(response => response.json())
      .then(({ ip }) => {
        this.ip = ip;
      })
      .catch(err => console.log('error finding ip'));

    Constants.getWebViewUserAgentAsync().then(userAgent => {
      this.userAgent = userAgent;
      this.appVersion = Constants.manifest.version;
      this.screenWidth = `${width}`;
      this.screenHeight = `${height}`;

      if (isIosPlatform) {
        this.platform = Constants.platform.ios.platform;
        this.model = Constants.platform.ios.model;
        this.osVersion = Constants.platform.ios.systemVersion;
        this.os = 'iOS';
      } else {
        this.platform = 'android';
        this.os = 'Android';
      }

      this.ready = true;
      this._flush();
    });
  }

  setIP(ip) {
    this.ip = ip;
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
    this._people('set', props);
  }

  people_set_once(props) {
    this._people('set_once', props);
  }

  people_unset(props) {
    this._people('unset', props);
  }

  people_increment(props) {
    this._people('add', props);
  }

  people_append(props) {
    this._people('append', props);
  }

  people_union(props) {
    this._people('union', props);
  }

  people_delete_user() {
    this._people('delete', '');
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
      properties: event.props
    };

    if (this.userId) {
      data.properties.distinct_id = this.userId;
    }

    data.properties.id = this.clientId;
    data.properties.token = this.token;
    data.properties.$browser = this.userAgent;
    data.properties.$app_version_string = this.appVersion;
    data.properties.ip = this.ip;
    data.properties.$screen_width = this.screenWidth;
    data.properties.$screen_height = this.screenHeight;
    data.properties.mp_lib = 'React Native Reservamos';
    data.properties.$lib_version = '0.0.8';
    data.properties.$os = this.os;

    if (this.platform) {
      data.properties.platform = this.platform;
    }

    if (this.model) {
      data.properties.$model = this.model;
    }

    if (this.osVersion) {
      data.properties.$os_version = this.osVersion;
    }

    data = new Buffer(JSON.stringify(data)).toString('base64');

    return fetch(`${MIXPANEL_API_URL}/track/?data=${data}`);
  }

  _pushProfile(data) {
    data = new Buffer(JSON.stringify(data)).toString('base64');
    return fetch(`${MIXPANEL_API_URL}/engage/?data=${data}`);
  }
}
