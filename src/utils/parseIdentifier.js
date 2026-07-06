export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const parseIdentifier = (identifier) => {
  const trimmed = identifier.trim();
  if (isEmail(trimmed)) {
    return { email: trimmed.toLowerCase() };
  }
  return { phone: trimmed };
};
