import {useCallback, useEffect, useState} from "react";
import {MUTATION, request, getLayouts} from './api';
import ControlGroup from "./ControlGroup";
import ModeControl from "./ModeControl";
import DeviceControl from "./DeviceControl";
import useDeviceStateUpdater from "./useDeviceStateUpdater";

export default function HomeDashboard() {
  const [layouts, setLayouts] = useState(null)
  const [deviceStateMap, setDeviceStateMap] = useState(null);

  const activateMode = useCallback(async (modeId) => {
    await request(MUTATION.ACTIVATE_MODE, {modeId});
  }, []);

  const setPowerState = useCallback(async (deviceId, newPowerState) => {
    const powerState = JSON.stringify(newPowerState);
    await request(MUTATION.SET_POWER, {deviceId, powerState})
  }, [])

  const changeBrightness = useCallback(async (deviceId, brightness) => {
    await request(MUTATION.SET_BRIGHTNESS, {deviceId, brightness: String(brightness)})
  }, []);

  useEffect(() => {
    let mounted = true;
    getLayouts().then(layouts => {
      if (mounted) return setLayouts(layouts);
    })

    return () => {
      mounted = false;
    }
  },[setLayouts])

  useDeviceStateUpdater(layouts, setDeviceStateMap);

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
