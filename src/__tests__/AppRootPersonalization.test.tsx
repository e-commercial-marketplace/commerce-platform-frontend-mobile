import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { AppI18nProvider, useAppLanguage } from '../i18n';
import { AppThemeProvider, useAppTheme } from '../theme';

function ConsumerComponent() {
  const { isDark, themePreference } = useAppTheme();
  const { language, t } = useAppLanguage();

  return (
    <Text testID="consumer-text">
      {`mode:${themePreference}|isDark:${isDark}|lang:${language}|label:${t('common.save', 'Lưu')}`}
    </Text>
  );
}

describe('Root Personalization Providers Integration', () => {
  it('mounts AppThemeProvider and AppI18nProvider together and provides context values to children', () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <AppI18nProvider>
          <ConsumerComponent />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    const el = getByTestId('consumer-text');
    expect(el).toBeTruthy();
    expect(el.props.children).toContain('mode:light');
    expect(el.props.children).toContain('lang:vi');
  });
});
