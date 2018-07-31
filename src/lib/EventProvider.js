// @flow

import EventPublisher from '../lib/EventPublisher';
import type { ProtocolEvent } from '../types';

class EventProvider {
  _eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this._eventPublisher = eventPublisher;
  }

  onNewEvent = (
    callback: (event: ProtocolEvent) => void,
    eventNamePrefix: string = '*',
  ) => {
    this._eventPublisher.subscribe(
      eventNamePrefix,
      this._onNewEvent(callback),
      {
        filterOptions: {
          listenToBroadcastedEvents: false,
          listenToInternalEvents: false,
        },
      },
    );
  };

  _onNewEvent = (
    callback: (event: ProtocolEvent) => void,
  ): ((event: ProtocolEvent) => void) => (event: ProtocolEvent) => {
    const eventToBroadcast: ProtocolEvent = ({
      ...event,
    }: any);

    callback(eventToBroadcast);
  };
}

export default EventProvider;
