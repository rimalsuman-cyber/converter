export function calculateAgeParts(birthDate, compareDate) {
  let years = compareDate.getFullYear() - birthDate.getFullYear();
  let months = compareDate.getMonth() - birthDate.getMonth();
  let days = compareDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(compareDate.getFullYear(), compareDate.getMonth(), 0).getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years,
    months,
    days,
    totalDays: Math.floor((compareDate - birthDate) / 86400000),
  };
}
