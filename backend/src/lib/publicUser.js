export function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export const publicUserSelect = { id: true, name: true, email: true, role: true, position: true, unitId: true };
