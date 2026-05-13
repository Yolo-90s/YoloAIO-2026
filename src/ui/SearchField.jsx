import { IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

// Shared search input look — pill-shaped, faint glass fill, clear-on-X.
// Used in the FeatureScaffold header on every screen that has a search box.
export function SearchField({ value, onChange, placeholder = 'Search', size = 'small' }) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size={size}
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 20 }} />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => onChange('')} aria-label="Clear">
              <CloseIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: '20px',
          backgroundColor: 'rgba(255,255,255,0.06)',
        },
      }}
    />
  );
}
