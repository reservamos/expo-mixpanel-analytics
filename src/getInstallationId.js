import * as Application from "expo-application";
import { Platform } from "react-native";
import { v5 as uuidv5 } from "uuid";

let installationId;
const UUID_NAMESPACE = "29cc8a0d-747c-5f85-9ff9-f2f16636d963"; // uuidv5(0, "expo")

export default async function getInstallationIdAsync() {
  if (installationId) {
    return installationId;
  }

  let identifier;

  if (Platform.OS === "ios") {
    identifier = await Application.getIosIdForVendorAsync();
  } else if (Platform.OS === "android") {
    identifier = Application.androidId;
  }

  const bundleIdentifier = Application.applicationId;

  // It's unlikely `identifier` will be null (it returns null if the
  // device has been restarted but not yet unlocked), but let's handle this
  // case.
  if (identifier) {
    installationId = uuidv5(
      `${bundleIdentifier}-${identifier}`,
      UUID_NAMESPACE
    );
  } else {
    const installationTime = await Application.getInstallationTimeAsync();
    installationId = uuidv5(
      `${bundleIdentifier}-${installationTime.getTime()}`,
      UUID_NAMESPACE
    );
  }

  return installationId;
}
