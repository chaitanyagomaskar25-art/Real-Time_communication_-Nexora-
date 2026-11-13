export const isValidEmail = (email) => {
  return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
};

export const isValidRoomId = (roomId) => {
  return typeof roomId === 'string' && roomId.trim().length >= 4;
};

