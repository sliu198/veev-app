import {useCallback, useEffect, useState} from "react";
import {MUTATION, request, getLayouts, getDeviceStateMap} from './api';
import ControlGroup from "./ControlGroup";
import ModeButton from "./ModeButton";
import DeviceControl from "./DeviceControl";

export default function HomeDashboard() {
  const [layouts, setLayouts] = useState(null)
  const [deviceStateMap, setDeviceStateMap] = useState(null);

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
    await refreshDeviceStates();
  }, [refreshDeviceStates]);

  const togglePower = useCallback(async (deviceId) => {
    const powerState = JSON.stringify(deviceStateMap[deviceId].powerState === 'false');
    await request(MUTATION.SET_POWER, {deviceId, powerState})
    await refreshDeviceStates();
  }, [refreshDeviceStates, deviceStateMap])

  const changeBrightness = useCallback(async (deviceId, brightness) => {
    const powerState = JSON.stringify(deviceStateMap[deviceId].state.powerState === 'false');
    await request(MUTATION.SET_POWER, {deviceId, powerState})
    await refreshDeviceStates();
  }, [refreshDeviceStates]);

  useEffect(() => {
    refreshLayouts();
  },[])

  useEffect(() => {
    if (!layouts) return;
    refreshDeviceStates();
  }, [layouts])

  return <div>
    {
      !layouts || !deviceStateMap
        ? 'Loading...'
        : layouts.map(layout => <HouseStatus
          key={layout.id}
          layout={layout}
          deviceStateMap={deviceStateMap}
          activateMode={activateMode}
          togglePower={togglePower}
          changeBrightness={changeBrightness}
          refreshDeviceStates={refreshDeviceStates}
        />)
    }
  </div>;
}

function HouseStatus(
  {
    layout: {name, modes, rooms},
    deviceStateMap,
    activateMode,
    togglePower,
    changeBrightness,
    refreshDeviceStates
  }) {

  return <div>
    <h1>{name}</h1>
    <ControlGroup>
      <h2>Modes</h2>
      {
        modes.map((mode) => <ModeButton
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
            togglePower={togglePower}
            changeBrightness={changeBrightness}
          />)
        }
      </ControlGroup>)
    }
  </div>
}
