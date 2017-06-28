/* eslint-disable */

import test from 'ava';
import sinon from 'sinon';
import TestData from './setup/TestData';

import EventPublisher from '../src/lib/EventPublisher';
import { getRequestEventName } from '../src/lib/EventPublisher';

const TEST_EVENT_NAME = 'testEvent';

function checkIfCalled(called, handler) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (called) {
        handler.called ? resolve() : reject('Was not called');
      } else {
        handler.called ? reject('Was called') : resolve();
      }
    }, 100);
  });
}

test('should subscribe to event', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: eventData.userID },
  });

  eventPublisher.publish(eventData, { isPublic: true });
  return checkIfCalled(true, handler);
});

test('should listen for public event from another owner device', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: TestData.getID() },
  });

  eventPublisher.publish(eventData, { isPublic: true });
  return checkIfCalled(true, handler);
});

test('should filter private event', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: TestData.getID },
  });

  eventPublisher.publish(eventData, { isPublic: false });
  return checkIfCalled(false, handler);
});

test('should filter internal event', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { listenToInternalEvents: false },
  });

  eventPublisher.publish(eventData, { isInternal: true });
  return checkIfCalled(false, handler);
});

test('should filter event by connectionID', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const connectionID = '123';
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { connectionID },
  });

  eventPublisher.publish(eventData, { isPublic: false });

  return checkIfCalled(false, handler);
});

test('should filter event by deviceID', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();
  const deviceEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    isPublic: false,
    deviceID: TestData.getID(),
  };

  // event from api or webhook-response
  const notDeviceEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
  };

  eventPublisher.subscribe(deviceEvent.name, handler, {
    filterOptions: {
      deviceID: TestData.getID(),
      userID: deviceEvent.userID,
    },
  });

  eventPublisher.publish(deviceEvent, { isPublic: false });
  eventPublisher.publish(notDeviceEvent, { isPublic: false });

  return checkIfCalled(false, handler);
});

test('should filter broadcasted events', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();
  const deviceEvent = {
    broadcasted: true,
    deviceID: TestData.getID(),
    name: TEST_EVENT_NAME,
    userID: ownerID,
  };

  eventPublisher.subscribe(deviceEvent.name, handler, {
    filterOptions: {
      listenToBroadcastedEvents: false,
    },
  });

  eventPublisher.publish(deviceEvent, { isPublic: false });

  return checkIfCalled(false, handler);
});

test('should listen for mydevices events only', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();

  const myDevicePublicEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    deviceID: TestData.getID(),
  };

  const myDevicesPrivateEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    deviceID: TestData.getID(),
  };

  const anotherOwnerPublicEvent = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
    deviceID: TestData.getID(),
  };

  eventPublisher.subscribe(TEST_EVENT_NAME, handler, {
    filterOptions: {
      mydevices: true,
      userID: ownerID,
    },
  });

  eventPublisher.publish(myDevicePublicEvent, { isPublic: true });

  eventPublisher.publish(myDevicesPrivateEvent, { isPublic: false });

  eventPublisher.publish(anotherOwnerPublicEvent, { isPublic: true });
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (handler.callCount !== 2)
        return reject('Callcount incorrect ' + handler.callCount);
      resolve();
    }, 100);
  });
});

/*

NOT implemented at all ?

test('should unsubscribe all subscriptions by subsriberID', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const subscriberID = TestData.getID();

  const event = {
    name: TEST_EVENT_NAME,
  };

  eventPublisher.subscribe(event, handler, { subscriberID });

  eventPublisher.subscribe(event, handler, { subscriberID });

  eventPublisher.publish(event, { isPublic: true });

  eventPublisher.unsubscribeBySubscriberID(subscriberID);

  eventPublisher.publish(event, { isPublic: true });

  return new Promise((resolve, reject) => {
    setTimeout(() => {
        if (handler.callCount !== 2) reject('Callcount is incorrect ' + handler.callCount);
        resolve();
    },100)
  })
});

*/

test('should publish and listen for response', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const subscriberID = TestData.getID();
  const testContextData = '123';

  const responseHandler = (event: Event) => {
    const { data, responseEventName } = event.context;

    eventPublisher.publish({
      name: responseEventName,
      context: data,
    });
  };

  eventPublisher.subscribe(
    getRequestEventName(TEST_EVENT_NAME),
    responseHandler,
    { subscriberID },
  );

  const response = await eventPublisher.publishAndListenForResponse({
    name: TEST_EVENT_NAME,
    context: { data: testContextData },
  });

  t.is(response, testContextData);
});
