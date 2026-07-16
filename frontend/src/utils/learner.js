export const CHILD_LEARNER_MAX_AGE = 12;

export const ageFromBirthDate = (birthDate, today = new Date()) => {
  const match = String(birthDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.valueOf()) || birth > today) return null;

  let age = today.getFullYear() - year;
  const birthdayHasPassed = today.getMonth() > month - 1
    || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age >= 0 ? age : null;
};

export const isChildLearner = (user) => {
  if (user?.role !== 'STUDENT') return false;
  const age = ageFromBirthDate(user.birthDate);
  return age !== null && age <= CHILD_LEARNER_MAX_AGE;
};
