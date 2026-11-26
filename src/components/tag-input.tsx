import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  'aria-labelledby'?: string;
};

const SEPARATOR = /[\s,]+/;

function normalize(raw: string) {
  return raw.trim().replace(/^#+/, '').toLowerCase();
}

export function TagInput({
  tags,
  onChange,
  placeholder = 'Add a tag',
  'aria-labelledby': labelledBy,
}: TagInputProps) {
  const theme = useTheme();
  // Only the half-typed tag lives here; committed tags belong to the parent.
  const [draft, setDraft] = useState('');

  function addTags(rawTags: string[]) {
    const next = [...tags];
    for (const raw of rawTags) {
      const tag = normalize(raw);
      if (tag && !next.includes(tag)) next.push(tag);
    }
    if (next.length !== tags.length) onChange(next);
  }

  function handleChangeText(text: string) {
    if (!SEPARATOR.test(text)) {
      setDraft(text);
      return;
    }
    // Everything before the last separator is committed; the remainder (empty
    // when the text ends in a separator) stays as the draft. Handles pastes.
    const parts = text.split(SEPARATOR);
    const remainder = parts.pop() ?? '';
    addTags(parts);
    setDraft(remainder);
  }

  function commitDraft() {
    addTags([draft]);
    setDraft('');
  }

  return (
    <View style={[styles.container, { borderColor: theme.backgroundSelected }]}>
      {tags.map((tag) => (
        <Pressable
          key={tag}
          onPress={() => onChange(tags.filter((t) => t !== tag))}
          accessibilityRole="button"
          accessibilityLabel={`Remove tag ${tag}`}
          hitSlop={4}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="small">#{tag}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ×
          </ThemedText>
        </Pressable>
      ))}
      <TextInput
        aria-labelledby={labelledBy}
        value={draft}
        onChangeText={handleChangeText}
        onSubmitEditing={commitDraft}
        onBlur={commitDraft}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace' && draft === '' && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        submitBehavior="submit"
        returnKeyType="done"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={tags.length === 0 ? placeholder : undefined}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  input: {
    flexGrow: 1,
    minWidth: 80,
    paddingVertical: 0,
    fontSize: 14,
  },
});
