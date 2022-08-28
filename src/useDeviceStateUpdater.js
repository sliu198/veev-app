import {useState, useCallback, useEffect} from "react";

import {getDeviceStateMap} from './api';
import ServerUpdateListener from "./ServerUpdateListener";

export default function useDeviceStateUpdater(layouts, setDeviceStateMap) {
  const [serverUpdateListener, setServerUpdateListener] = useState(null);
  const [reconnectDelay, setReconnectDelay] = useState(1000);
  const [reconnectToken, setReconnectToken] = useState(0);

  const fetchDeviceStates = useCallback(async () => {
    if (!layouts) return;

    const deviceIds = [];
    for (const {rooms} of layouts) {
      for (const {devices} of rooms) {
        for (const {id} of devices) {
          deviceIds.push(id);
        }
      }
    }

    return await getDeviceStateMap(deviceIds);
  }, [layouts]);

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

  const reconnect = useCallback(() => {
    setReconnectToken(reconnectToken => reconnectToken + 1);
  }, [setReconnectToken]);

  useEffect(() => {
    if (serverUpdateListener != null) return () => serverUpdateListener.close();

    let mounted = true;
    const listener = new ServerUpdateListener(() => {
      setServerUpdateListener(null);
    });
    listener.connect().then(() => {
      if (!mounted) return;

      setServerUpdateListener(listener);
      setReconnectDelay(1000);
    }, () => {
      if (!mounted) return;

      setTimeout(() => {
        if (!mounted) return;

        if (reconnectDelay < 32000) setReconnectDelay(reconnectDelay * 2);
        reconnect();
      }, reconnectDelay);
    });

    return () => mounted = false;
  }, [reconnectDelay, setReconnectDelay, reconnectToken, reconnect, serverUpdateListener, setServerUpdateListener])

  useEffect(() => {
    if (serverUpdateListener == null) return;

    let mounted = true;
    fetchDeviceStates().then(deviceStates => {
      if (!mounted) return;
      setDeviceStateMap(deviceStates);
    })

    return () => {
      mounted = false;
    }
  }, [layouts, setDeviceStateMap, serverUpdateListener]);

  useEffect(() => {
    if (!layouts || !serverUpdateListener) return;
    for (const {id: houseId} of layouts) {
      serverUpdateListener.subscribe(houseId, updateDeviceState);
    }

    return () => {
      for (const {id: houseId} of layouts) {
        serverUpdateListener.unsubscribe(houseId);
      }
    }
  }, [layouts, serverUpdateListener]);
}