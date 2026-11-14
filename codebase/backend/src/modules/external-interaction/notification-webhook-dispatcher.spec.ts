import {
  notificationWebhookDispatcher,
  resetNotificationWebhookDispatcherForTesting,
} from './notification-webhook-dispatcher';

describe('notificationWebhookDispatcher', () => {
  afterEach(async () => {
    await resetNotificationWebhookDispatcherForTesting();
  });

  it('프로세스에 하나만 만들어 나눠 쓴다', () => {
    expect(notificationWebhookDispatcher()).toBe(
      notificationWebhookDispatcher(),
    );
  });

  it('reset 뒤에는 새로 만든다', async () => {
    const first = notificationWebhookDispatcher();
    await resetNotificationWebhookDispatcherForTesting();
    expect(notificationWebhookDispatcher()).not.toBe(first);
  });
});
