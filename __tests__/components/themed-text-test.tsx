import { render } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';

describe('<ThemedText />', () => {
  test('renders its children', async () => {
    const { getByText } = await render(<ThemedText>Hello</ThemedText>);

    getByText('Hello');
  });
});
