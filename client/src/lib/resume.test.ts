import { describe, expect, test } from 'bun:test';
import { education, experience, profile, resumeText, skillGroups } from './resume';

describe('the résumé', () => {
  const text = resumeText();

  test('only the current employer is marked Present, and it comes first', () => {
    const current = experience.filter((job) => job.roles.some((role) => role.years.endsWith('Present')));
    expect(current.map((job) => job.company)).toEqual([experience[0].company]);
    expect(profile.headline).toContain(experience[0].company);
    expect(text.match(/Present/g)).toHaveLength(1);
  });

  test('every role has a start and an end, newest first', () => {
    for (const job of experience) {
      const starts = job.roles.map((role) => {
        expect(role.years).toMatch(/^\d{4}-(\d{4}|Present)$/);
        return Number(role.years.slice(0, 4));
      });
      expect(starts).toEqual([...starts].sort((a, b) => b - a));
    }
  });

  test('resume.txt carries every employer, title, year, school and skill line', () => {
    for (const job of experience) {
      expect(text).toContain(job.company);
      for (const role of job.roles) expect(text).toContain(`${role.title} (${role.years})`);
      for (const line of job.highlights) expect(text).toContain(`• ${line}`);
    }
    for (const school of education) expect(text).toContain(`${school.school} - ${school.degree} (${school.years})`);
    for (const [group, items] of skillGroups) expect(text).toContain(`${group}: ${items.join(', ')}`);
    expect(text).toContain(profile.email);
  });

  test('education lists St. Olaf College and nothing else', () => {
    expect(education.map((s) => s.school)).toEqual(['St. Olaf College']);
  });
});
