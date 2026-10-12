import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { ContentContainer } from '@/components/ContentContainer';

// Placeholder legal page. The real Terms and Privacy Policy replace this text before launch.
export function LegalScreen({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Demo placeholder text. This is not a real legal document.</Text>
          </View>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.body}>{p}</Text>
          ))}
        </ContentContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 22, color: colors.text, flex: 1 },
  notice: { backgroundColor: colors.warning, borderRadius: radius.md, padding: 12 },
  noticeText: { fontSize: 12, color: '#6B4600' },
  body: { fontSize: 13, lineHeight: 20, color: colors.text },
});
