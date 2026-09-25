import { Button, Stack, Typography } from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { GlassCard } from '../../ui/GlassCard.jsx';

// "{inviterName} added you to {groupName}" — the literal accept/decline
// request the group-chat feature was asked for. Mirrors PendingInvitesBanner.kt.
export function PendingInvitesBanner({ invites, onAccept, onDecline }) {
  return (
    <Stack spacing={1} sx={{ mb: 1.5 }}>
      {invites.map((invite) => (
        <GlassCard key={invite.inviteId} contentPadding={1.75}>
          <Stack direction="row" spacing={1.5}>
            <GroupAddIcon sx={{ color: 'primary.main', fontSize: 28, mt: 0.25 }} />
            <Stack sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {invite.invitedByName} added you to {invite.groupName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Would you like to join?
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="outlined" onClick={() => onDecline(invite)}>
                  Decline
                </Button>
                <Button size="small" variant="contained" onClick={() => onAccept(invite)}>
                  Accept
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </GlassCard>
      ))}
    </Stack>
  );
}
