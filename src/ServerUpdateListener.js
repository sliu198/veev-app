import {randomBytes} from "crypto";

import {forEach} from 'lodash';

import {HOSTNAME} from './api';
import {getAccessToken} from './auth';

const URL = 'wss://5cyxxyn4bjho7b7zyqcn3vo3cm.appsync-realtime-api.us-east-1.amazonaws.com/graphql';
const SUBSCRIPTION = `subscription OnServerEvent($houseId: String!) {
  OnServerEvent(house_id: $houseId) {
    name
    payload
  }
}`

const CONNECTION_STAGE = {
  OPENING: '',
  INITIALIZING: '',
  READY: '',
}
forEach(CONNECTION_STAGE, (value , key) => CONNECTION_STAGE[key] = key);

export default class ServerUpdateListener {
  constructor(onClose) {
    this.onClose = onClose;
    this.subscriptions = {};
    this.socket = null;
  }

  async connect() {
    if (this.socket) return;

    const accessToken = await getAccessToken();
    const header = Buffer.from(JSON.stringify({
      Authorization: accessToken,
      Host: HOSTNAME,
    })).toString('base64')
    const payload = Buffer.from('{}').toString('base64')
    const query = `header=${encodeURIComponent(header)}&payload=${encodeURIComponent(payload)}`;

    // resolve this promise after receiving connection_ack
    return new Promise((resolve, reject) => {
      let connectionStage = CONNECTION_STAGE.OPENING

      // reject the promise if it hasn't been resolved yet, otherwise log
      const handleError = (error) => {
        if (connectionStage === CONNECTION_STAGE.READY) {
          console.error(error);
        } else {
          reject(error);
        }
      }

      const errorListener = (caughtError) => {
        const error = new Error('unexpected websocket error');
        error.data = {error: caughtError};
        handleError(error);
      }

      const closeListener = () => {
        if (connectionStage === CONNECTION_STAGE.READY) {
          this.onClose();
        } else {
          reject(new Error('unexpected websocket close'));
        }
      }

      const connectionOpenListener = () => {
        if (connectionStage !== CONNECTION_STAGE.OPENING) {
          handleError(new Error('unexpected websocket open event'));
          if (connectionStage !== CONNECTION_STAGE.READY) this.close();
          return;
        }

        connectionStage = CONNECTION_STAGE.INITIALIZING;
        this.socket.send(JSON.stringify({type: 'connection_init'}))
      }

      const messageListener = (event) => {
        let eventData;

        try {
          eventData = JSON.parse(event.data);
        } catch (error) {
          const rethrownError = new Error('error parsing message');
          rethrownError.data = {error};
          handleError(error);
        }

        // handle different message types;
        // if message is not expected for the current stage, break to fall to the error handler
        // otherwise return;
        switch(eventData.type) {
          case 'connection_ack':
            if (connectionStage !== CONNECTION_STAGE.INITIALIZING) break;
            connectionStage = CONNECTION_STAGE.READY;
            resolve(this);
            return;
          case 'ka':
            if (connectionStage !== CONNECTION_STAGE.READY) break;
            return; // keep alive, ok to ignore after init phase
          case 'start_ack':
          case 'data':
            if (connectionStage !== CONNECTION_STAGE.READY) break;
            this._handleSubscriptionData(eventData);
            return;
        }

        const error = new Error('unexpected websocket message');
        error.data = {eventData};
        handleError(error);
        if (connectionStage !== CONNECTION_STAGE.READY) this.close();
      }

      this.socket  = new WebSocket(`${URL}?${query}`, 'graphql-ws');
      this.socket.addEventListener('open', connectionOpenListener);
      this.socket.addEventListener('message', messageListener);
      this.socket.addEventListener('error', errorListener);
      this.socket.addEventListener('close', closeListener);
    });
  }

  async subscribe(houseId, callback) {
    const id = uuid();
    const dataPojo = {
      query: SUBSCRIPTION,
      variables: {houseId}
    };
    const extensions = {
      authorization: {
        Authorization: await getAccessToken(),
        host: HOSTNAME,
      },
    }
    const payload = {
      data: JSON.stringify(dataPojo),
      extensions,
    }
    this.socket.send(JSON.stringify({id, payload, type: 'start'}));
    this.subscriptions[id] = {
      connectionStage: CONNECTION_STAGE.INITIALIZING,
      callback,
    }
  }

  close() {
    if (!this.socket) return;
    this.socket.close();
  }

  _handleSubscriptionData(eventData) {
    const {id, type, payload} = eventData;
    const subscription = this.subscriptions[id];
    if (!subscription) {
      const error = new Error('no subscription for id')
      error.data = {eventData};
      console.error(error);
      return;
    }

    switch (type) {
      case 'start_ack':
        if (subscription.connectionStage !== CONNECTION_STAGE.INITIALIZING) break;
        subscription.connectionStage = CONNECTION_STAGE.READY;
        return;
      case 'data':
        if (subscription.connectionStage !== CONNECTION_STAGE.READY) break;
        subscription.callback(payload);
        return;
    }

    const error = new Error('unexpected subscription data');
    error.data = {eventData};
    console.error(error);
  }
}

function uuid() {
  return [4, 2, 2, 2, 6]
    .map(bytes => randomBytes(bytes).toString('hex'))
    .join('-');
}