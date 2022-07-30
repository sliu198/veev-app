const {getAccessToken} = require('./auth');

const BASE_URL = 'https://5cyxxyn4bjho7b7zyqcn3vo3cm.appsync-api.us-east-1.amazonaws.com/graphql'

const QUERY = {
  LIST_HOUSES: `{
  ListHouses {
    house_id
    name
  }
}`,
  GET_STRUCTURE: `query GetStructure($houseId: ID!) {
  GetStructure(house_id: $houseId) {
    name
    rooms {
      name
      devices {
        name
        device_id
        capabilities {
          name
          type
          readOnly
        }
      }
    }
  }
}`,
  GET_DEVICES_STATES: `query GetDevicesStates($deviceIds: [ID!]) {
  GetDevicesStates(device_ids: $deviceIds) {
    id
    states {
      name
      value
    }
  }
}`,
  GET_MODES: `query GetModes($houseId: ID!) {
  GetModes(house_id: $houseId) {
    id
    name
  }
}`
}

const MUTATION = {
  SET_BRIGHTNESS: `mutation SetBrightness($deviceId: ID!, $brightness: String!) {
  UpdateDeviceState(device_id: $deviceId, capabilities: [{name: "brightness", value: $brightness}]) {
    isSuccessful
  }
}`,
  SET_POWER: `mutation TurnOn($deviceId: ID!, $powerState: String!) {
  UpdateDeviceState(device_id: $deviceId, capabilities: [{name: "powerState", value: $powerState}]) {
    isSuccessful
  }
}`,
  ACTIVATE_MODE: `mutation ActivateMode($modeId: ID!) {
  ActivateMode(mode_id: $modeId) {
    isSuccessful
  }
}`
}

module.exports = {
  request,
  QUERY,
  MUTATION,
}

async function request(query, variables) {
  const accessToken = await getAccessToken();

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': accessToken,
    },
    body: JSON.stringify({
      query,
      variables,
    })
  })

  const {data, errors} = (await response.json()) || {};

  if (response.ok) {
    return data;
  }

  const error = new Error(response.statusText);
  error.data = {errors};
  throw error;
}