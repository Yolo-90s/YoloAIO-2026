import { Stack, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';

// Placeholder screen for features that haven't been ported yet. The
// FeatureScaffold provides the back button + title strip; the body is a
// single "coming soon" card so the chrome already feels real.
export function FeatureStub({ title, androidOnly = false }) {
  return (
    <FeatureScaffold title={title}>
      <GlassCard contentPadding={4}>
        <Stack spacing={2} alignItems="center" sx={{ py: 4, textAlign: 'center' }}>
          {androidOnly ? (
            <PhoneAndroidIcon sx={{ fontSize: 56, opacity: 0.7 }} />
          ) : (
            <ConstructionIcon sx={{ fontSize: 56, opacity: 0.7 }} />
          )}
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {androidOnly ? `${title} is Android-only` : `${title} — coming soon`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            {androidOnly
              ? "This feature relies on platform APIs (Wi-Fi scanning, system intents) that the browser doesn't expose. It'll stay on the Android app."
              : "We're porting this feature from the Android app. The route exists so the home tile already navigates — the screen will land in a follow-up."}
          </Typography>
        </Stack>
      </GlassCard>
    </FeatureScaffold>
  );
}
