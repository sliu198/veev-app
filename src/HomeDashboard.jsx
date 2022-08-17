import {useCallback, useEffect, useState} from "react";
import {MUTATION, request, getLayouts, getDeviceStateMap} from './api';
import ControlGroup from "./ControlGroup";
import ModeControl from "./ModeControl";
import DeviceControl from "./DeviceControl";
import ServerUpdateListener from "./ServerUpdateListener";

export default function HomeDashboard() {
  const [layouts, setLayouts] = useState(null)
  const [deviceStateMap, setDeviceStateMap] = useState(null);
  const [serverUpdateListener, setServerUpdateListener] = useState(null);

  const refreshDeviceStates = useCallback(async () => {
    const deviceIds = [];
    for (const {rooms} of layouts) {
      for (const {devices} of rooms) {
        for (const {id} of devices) {
          deviceIds.push(id);
        }
      }
    }

    setDeviceStateMap(await getDeviceStateMap(deviceIds));
  }, [layouts, setDeviceStateMap]);

  const refreshLayouts = useCallback(async () => {
    const layouts = await getLayouts()
    setLayouts(layouts);
  }, [setLayouts])

  const activateMode = useCallback(async (modeId) => {
    await request(MUTATION.ACTIVATE_MODE, {modeId});
  }, [refreshDeviceStates]);

  const setPowerState = useCallback(async (deviceId, newPowerState) => {
    const powerState = JSON.stringify(newPowerState);
    await request(MUTATION.SET_POWER, {deviceId, powerState})
  }, [refreshDeviceStates, deviceStateMap])

  const changeBrightness = useCallback(async (deviceId, brightness) => {
    await request(MUTATION.SET_BRIGHTNESS, {deviceId, brightness: String(brightness)})
  }, [refreshDeviceStates]);

  const updateDeviceState = useCallback((updatePayload) => {
    const {data: {OnServerEvent: {name, payload}}} = updatePayload
    if (name !== 'DEVICE_UPDATED') return;

    let payloadPojo;
    try {
      payloadPojo = JSON.parse(payload);
    } catch (error) {
      const rethrownError = new Error('error parsing device update payload');
      rethrownError.data = {error, payload};
      console.error(rethrownError);
      return;
    }

    const {id: deviceId, states} = payloadPojo;
    setDeviceStateMap(deviceStateMap => {
      if (!deviceStateMap[deviceId]) return deviceStateMap;

      const deviceState = {};
      for (const {name, value} of states) {
        deviceState[name] = value;
      }

      return {
        ...deviceStateMap,
        [deviceId]: deviceState,
      }
    });
  }, [setDeviceStateMap])

  useEffect(() => {
    refreshLayouts();
  },[])

  useEffect(() => {
    const serverUpdateListener = new ServerUpdateListener(() => {});
    serverUpdateListener.connect().then((listener) => {
      setServerUpdateListener(listener);
    });
    return () => serverUpdateListener.close();
  }, [])

  useEffect(() => {
    if (!layouts) return;
    refreshDeviceStates();
  }, [layouts])

  useEffect(() => {
    if (!layouts || !serverUpdateListener) return;
    for (const {id: houseId} of layouts) {
      serverUpdateListener.subscribe(houseId, updateDeviceState);
    }
  }, [layouts, serverUpdateListener]);

  return <div>
    {
      !layouts || !deviceStateMap
        ? 'Loading...'
        : layouts.map(layout => <HouseStatus
          key={layout.id}
          layout={layout}
          deviceStateMap={deviceStateMap}
          activateMode={activateMode}
          setPowerState={setPowerState}
          changeBrightness={changeBrightness}
        />)
    }
  </div>;
}

function HouseStatus(
  {
    layout: {name, modes, rooms},
    deviceStateMap,
    activateMode,
    setPowerState,
    changeBrightness,
  }) {

  return <div>
    <h1>{name}</h1>
    <ControlGroup>
      <h2>Modes</h2>
      {
        modes.map((mode) => <ModeControl
          key={mode.id}
          mode={mode}
          activateMode={activateMode}
        />)
      }
    </ControlGroup>
    {
      rooms.map(({id, name, devices}) => <ControlGroup key={id}>
        <h2>{name}</h2>
        {
          devices.map(({id, name}) => <DeviceControl
            key={id}
            device={{id, name, state: deviceStateMap[id]}}
            setPowerState={setPowerState}
            changeBrightness={changeBrightness}
          />)
        }
      </ControlGroup>)
    }
  </div>
}
