import {randomBytes} from "crypto";

import {forEach} from 'lodash';

import {HOSTNAME} from './api';

const URL = `ws://${HOSTNAME}/subscriptions`;
const SUBSCRIPTION = `subscription onStatesUpdated {
  onStatesUpdated {
    entityId
    entityType
    states {
      capability
      state
    }
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
    this.houseToSubscriptions = {};
    this.socket = null;
    this.hasConnectBeenCalled = false;
    this.isOpen = false
  }

  async connect() {
    if (this.hasConnectBeenCalled) throw new Error('connect has already been called');
    this.hasConnectBeenCalled = true;

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
        this.isOpen = false;
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
        console.log('websocket open; sending connection_init');
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
            console.log('connection_ack received');
            connectionStage = CONNECTION_STAGE.READY;
            this.isOpen = true;
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
          case 'complete':
            if (connectionStage !== CONNECTION_STAGE.READY) break;
            console.log(`complete received for ${eventData.id}`);
            return;
        }

        const error = new Error('unexpected websocket message');
        error.data = {eventData};
        handleError(error);
        if (connectionStage !== CONNECTION_STAGE.READY) this.close();
      }

      this.socket  = new WebSocket(`${URL}`, 'graphql-ws');
      this.socket.addEventListener('open', connectionOpenListener);
      this.socket.addEventListener('message', messageListener);
      this.socket.addEventListener('error', errorListener);
      this.socket.addEventListener('close', closeListener);
    });
  }

  async subscribe(houseId, callback) {
    if (!this.isOpen) throw new Error('connection is not open');

    const id = uuid();
    const payload = {
      query: SUBSCRIPTION,
      variables: null
    };
    this.socket.send(JSON.stringify({id, payload, type: 'start'}));

    let houseSubscriptions = this.houseToSubscriptions[houseId];
    if (!houseSubscriptions) {
      houseSubscriptions = this.houseToSubscriptions[houseId] = new Set();
    }
    houseSubscriptions.add(id);

    this.subscriptions[id] = {
      houseId,
      connectionStage: CONNECTION_STAGE.INITIALIZING,
      callback,
    }
  }

  async unsubscribe(houseId) {
    const subscriptions = this.houseToSubscriptions[houseId];
    if (!subscriptions) return;

    delete this.houseToSubscriptions[houseId];
    for (const id of subscriptions) {
      delete this.subscriptions[id];

      if (this.isOpen) this.socket.send(JSON.stringify({id, type: 'stop'}));
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
        console.log(`start_ack received for ${id}`);
        break;
      case 'data':
        subscription.callback(payload);
        break;
    }
  }
}

function uuid() {
  return [4, 2, 2, 2, 6]
    .map(bytes => randomBytes(bytes).toString('hex'))
    .join('-');
}