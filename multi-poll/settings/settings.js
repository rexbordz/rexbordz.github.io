window.WidgetSettingsHooks = {
  transformWidgetParams(params, values, config) {
    (config.sections || []).forEach((section) => {
      (section.fields || []).forEach((field) => {
        if (field.type === 'checkbox') return;

        const paramName = field.param || field.id;
        if (!params.has(paramName)) return;

        const currentValue = values[field.id];
        if (currentValue === undefined || currentValue === null || currentValue === '') return;

        if (String(currentValue) === String(field.defaultValue ?? '')) {
          params.delete(paramName);
        }
      });
    });

    const fontSize = params.get('font-size');
    if (fontSize && /^\d+(\.\d+)?$/.test(fontSize)) {
      params.set('font-size', fontSize + 'px');
    }

    return params;
  },
};