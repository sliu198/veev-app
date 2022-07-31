import {useCallback, useEffect, useState} from "react";
import {MUTATION, request, getLayouts, getDeviceStateMap} from './api';

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
  }, [layouts, setDeviceStateMap, deviceStateMap]);

  const refreshLayouts = useCallback(async () => {
    const layouts = await getLayouts()
    setLayouts(layouts);
  }, [setLayouts])

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
          refreshDeviceStates={refreshDeviceStates}
        />)
    }
  </div>;
}

function HouseStatus({layout: {name, modes, rooms}, deviceStateMap, refreshDeviceStates}) {
  return <div>
    <h1>{name}</h1>
    <h2>Modes</h2>
    <ul>
      {modes.map((mode) => {
        return <li key={mode.id}>
          <ModeButton mode={mode} refreshDeviceStates={refreshDeviceStates}/>
        </li>
      })}
    </ul>
    {
      rooms.map(({id, name, devices}) => {
        return <div key={id}>
          <h2>{name}</h2>
          <ul>
            {
              devices.map(({id, name}) => {
                return <li key={id}>
                  <DeviceControls device={{id, name, state: deviceStateMap[id]}} refreshDeviceStates={refreshDeviceStates}/>
                </li>
              })
            }
          </ul>
        </div>
      })
    }
  </div>
}

function ModeButton({mode: {id, name}, refreshDeviceStates}) {
  const onClick = useCallback(async () => {
    await request(MUTATION.ACTIVATE_MODE, {modeId: id});
    await refreshDeviceStates();
  }, [id, refreshDeviceStates])
  return <button onClick={onClick}>{name}</button>
}

function DeviceControls({device: {id, name, state: {powerState, brightness, onBrightness}}, refreshDeviceStates}) {
  const isOn = powerState === 'true'

  const togglePower = useCallback(async ({target: {checked: powerState}}) => {
    await request(MUTATION.SET_POWER, {deviceId: id, powerState: String(powerState)})
    await refreshDeviceStates([id])
  }, [id, isOn, refreshDeviceStates])

  const changeBrightness = useCallback(async ({target: {value: brightness}}) => {
    await(MUTATION.SET_BRIGHTNESS, {deviceId: id, brightness})
    await refreshDeviceStates([id])
  }, [id, refreshDeviceStates])

  return <div>
    <input type="checkbox" checked={isOn} onChange={togglePower}/>
    <span>{name}</span>
    {/*TODO: control brightness*/}
    <input disabled value={isOn ? brightness : onBrightness}/>
  </div>
}