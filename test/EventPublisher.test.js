/* eslint-disable */

import test from 'ava';
import sinon from 'sinon';
import TestData from './setup/TestData';

import EventPublisher from '../src/lib/EventPublisher';
import { getRequestEventName } from '../src/lib/EventPublisher';

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve: () => void): void => setTimeout(resolve, milliseconds));

// todo fix this if find better approach
// we use delay to ensure events being published by eventPublisher
// the method has its coveats, obvious one: hardcoded delay is bad.
// and not obvious: we run tests in parallel so, if delay will be
// too small but there is huge amount of tests, some of them could fail
// because of that.
const DELAY_TIME = 100;

const TEST_EVENT_NAME = 'testEvent';

test('should subscribe to event', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: eventData.userID },
  });

  eventPublisher.publish(eventData);

  await delay(DELAY_TIME);
  t.truthy(handler.called);
});

test('should listen for public event from another owner device', async t => {
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

  await delay(DELAY_TIME);
  t.truthy(handler.called);
});

test('should filter private event', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: TestData.getID() },
  });

  eventPublisher.publish(eventData, { isPublic: false });

  await delay(DELAY_TIME);
  t.falsy(handler.called);
});

test('should filter internal event', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { listenToInternalEvents: false },
  });

  eventPublisher.publish(eventData, { isInternal: true });

  await delay(DELAY_TIME);
  t.falsy(handler.called);
});

test('should filter event by connectionID', async t => {
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

  await delay(DELAY_TIME);
  t.falsy(handler.called);
});

test('should filter event by deviceID', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();
  const deviceEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
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

  await delay(DELAY_TIME);
  t.falsy(handler.called);
});

test('should filter broadcasted events', async t => {
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

  await delay(DELAY_TIME);
  t.falsy(handler.called);
});

test('should listen for mydevices events only', async t => {
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
  await delay(DELAY_TIME);
  t.is(handler.callCount, 1);

  eventPublisher.publish(myDevicesPrivateEvent, { isPublic: false });
  await delay(DELAY_TIME);
  t.is(handler.callCount, 2);

  eventPublisher.publish(anotherOwnerPublicEvent, { isPublic: true });
  await delay(DELAY_TIME);
  t.is(handler.callCount, 2);
});

test.only('should unsubscribe all subscriptions by subsriberID', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const subscriberID = TestData.getID();

  const event = {
    name: TEST_EVENT_NAME,
  };

  eventPublisher.subscribe(event.name, handler, { subscriberID });

  eventPublisher.subscribe(event.name, handler, { subscriberID });

  eventPublisher.publish(event, { isPublic: true });

  await delay(DELAY_TIME);
  t.is(handler.callCount, 2);

  eventPublisher.unsubscribeBySubscriberID(subscriberID);
  eventPublisher.publish(event, { isPublic: true });

  await delay(DELAY_TIME);
  t.is(handler.callCount, 2);
});

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
