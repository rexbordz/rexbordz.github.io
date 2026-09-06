window.WidgetSettingsHooks = {
  createTestAlert(buttonConfig, values) {
    return {
      username: 'TestUser123',
      message: values.note || 'This is a test alert!',
      platform: 'twitch'
    };
  }
};
