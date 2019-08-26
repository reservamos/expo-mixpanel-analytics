import { Platform, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { Buffer } from 'buffer';
import pkg from './package.json';
import getIP from './src/getIP';
const MIXPANEL_API_URL = 'http://api.mixpanel.com';
const MIXPANEL_API_URL_TRACK = `${MIXPANEL_API_URL}/track/?data=`;
const MIXPANEL_API_URL_ENGAGE = `${MIXPANEL_API_URL}/engage/?data=`;

export default class ExpoMixpanelAnalytics {
  constructor(token) {
    this._setProperties = this._setProperties.bind(this);
    this._onPromiseError = this._onPromiseError.bind(this);
    this.ready = false;
    this.queue = [];
    this.token = token;
    this.clientId = Constants.installationId;
    this.userId = this.clientId;
    this.properties = {
      token,
      mp_lib: 'React Native Reservamos',
      $lib_version: pkg.version
    };
    Promise.all([getIP(), Constants.getWebViewUserAgentAsync()])
      .then(this._setProperties)
      .catch(this._onPromiseError);
  }

  _onPromiseError(err) {
    console.log('Error trying to find ip or WebViewUserAgent', err);
    this._setProperties([null, null]);
  }

  _parseUserAgent(userAgent) {
    if (!userAgent || userAgent.split(';').length !== 4) return {};
    return {
      osVersion: userAgent.split(';')[2].trim(),
      model: userAgent
        .split(';')[3]
        .trim()
        .slice(0, -1)
    };
  }

  _setProperties([ip, userAgent]) {
    this.properties.ip = ip;
    this.properties.$browser = userAgent;
    const { width, height } = Dimensions.get('window');
    this.properties.$screen_width = `${width}`;
    this.properties.$screen_height = `${height}`;
    this.properties.distinct_id = Constants.installationId;
    this.properties.id = Constants.installationId;
    this.properties.$app_version_string = Constants.manifest.version;
    if (Platform.OS === 'ios') {
      this.properties.$os = 'iOS';
      this.properties.platform = Constants.platform.ios.platform;
      this.properties.$os_version = Constants.platform.ios.systemVersion;
      this.properties.$model = Constants.platform.ios.model;
      this.people_set({
        $ios_app_version: Constants.manifest.version
      });
    } else {
      this.properties.$os = 'Android';
      this.properties.platform = 'android';
      this.properties['Android API Version'] = Platform.Version;
      const { osVersion, model } = this._parseUserAgent(userAgent);
      this.properties.$os_version = osVersion;
      this.properties.$model = model;
      this.people_set({
        $android_app_version: Constants.manifest.version
      });
    }
    this.ready = true;
    this._flush();
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
      properties: { ...this.properties, ...event.props }
    };

    data = new Buffer(JSON.stringify(data)).toString('base64');

    return fetch(MIXPANEL_API_URL_TRACK + data);
  }

  _pushProfile(data) {
    data = new Buffer(JSON.stringify(data)).toString('base64');
    return fetch(MIXPANEL_API_URL_ENGAGE + data);
  }
}
