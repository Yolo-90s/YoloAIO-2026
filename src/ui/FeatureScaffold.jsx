import { Box, IconButton, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

// The inline page header. Two ideas at once:
//   1. The outer bar is full-page width so the glass-blur background
//      visually spans the viewport, matching the TopBar.
//   2. `position: sticky` with `top: 64` (= TopBar height) freezes the bar
//      under the global TopBar when the user scrolls.
// Content fills the page width by default. Pass an explicit `maxWidth`
// only on screens where a narrow column reads better (forms, long-form
// text). Side padding still keeps content from touching the edges.
export function FeatureScaffold({
  title,
  onBack,
  search,
  filter,
  actions,
  children,
  maxWidth,
}) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          top: 64,
          zIndex: 5,
          width: '100%',
          backgroundColor: 'rgba(14, 11, 20, 0.78)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Box
          sx={{
            maxWidth,
            width: '100%',
            mx: 'auto',
            px: { xs: 2, sm: 3 },
            py: 1.25,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'center' }}
            spacing={1.25}
          >
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flexShrink: 0 }}>
              <IconButton
                onClick={handleBack}
                sx={{ color: 'text.primary', ml: -1 }}
                aria-label="Back"
              >
                <ArrowBackIcon />
              </IconButton>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </Typography>
            </Stack>

            {search && (
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  width: { xs: '100%', md: 'auto' },
                  maxWidth: { md: 520 },
                }}
              >
                {search}
              </Box>
            )}

            {(filter || actions) && (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignSelf: { xs: 'flex-end', md: 'center' },
                  flexShrink: 0,
                }}
              >
                {filter}
                {actions}
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          maxWidth,
          width: '100%',
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
        }}
      >
        {children}
      </Box>
    </>
  );
}
