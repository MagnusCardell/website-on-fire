// The résumé, written once. The card beside the terminal and resume.txt inside it
// are both drawn from this file, so they cannot drift apart.

export interface Role {
  title: string;
  years: string;
}

export interface Job {
  company: string;
  via?: string;
  roles: Role[];
  highlights: string[];
}

export interface School {
  school: string;
  degree: string;
  years: string;
  note?: string;
}

export interface Project {
  name: string;
  year: string;
  summary: string;
  url: string;
}

export const profile = {
  name: 'Magnus Cardell',
  headline: 'Software Developer @ Netlight Consulting',
  location: 'Stockholm, Sweden',
  summary: 'Software architect with expertise in system reliability, cloud architecture, and software engineering.',
  email: 'cardell.magnus[at]gmail.com',
  linkedin: 'linkedin.com/in/magnuscardell',
  github: 'github.com/MagnusCardell',
};

// Newest first; the first role of each job is the latest one held there
export const experience: Job[] = [
  {
    company: 'Netlight Consulting',
    roles: [
      { title: 'Senior Consultant', years: '2023-Present' },
      { title: 'Consultant', years: '2020-2023' },
    ],
    highlights: ['Built cloud-based systems in Azure/AWS for enterprise clients'],
  },
  {
    company: 'PwC',
    via: 'Netlight',
    roles: [
      { title: 'Software Architect', years: '2024-2026' },
      { title: 'Senior Software Engineer', years: '2021-2024' },
    ],
    highlights: [
      'Led architectural modernization effort across regulated financial systems',
      'Developed a C# and JavaScript DSL with recursive parsing to enable configurable workflows',
      'Mentored junior engineers and contributed to internal hiring efforts',
    ],
  },
  {
    company: 'Handelsbanken Capital Markets',
    roles: [{ title: 'Software Engineer', years: '2018-2020' }],
    highlights: ['Delivered .NET-based financial tools for reporting and forecasting'],
  },
  {
    company: 'Lux Science Inc.',
    roles: [{ title: 'Software Developer', years: '2017-2018' }],
    highlights: ['Built an educational payments platform with Stripe, PHP, and DynamoDB'],
  },
];

export const education: School[] = [
  {
    school: 'St. Olaf College',
    degree: 'Bachelor of Arts, Computer Science, Music',
    years: '2014-2018',
    note: 'Awarded Christiansen Scholarship - highest merit based music scholarship',
  },
];

// The chips on the card
export const skills = [
  'C#', 'Go', 'Python', 'JavaScript/TypeScript', 'Azure', 'AWS',
  'Kubernetes', 'Docker', 'Terraform', 'SQL Server', 'Cosmos DB',
];

// The grouped lines in resume.txt
export const skillGroups: [string, string[]][] = [
  ['Languages', ['C#', 'Go', 'TypeScript', 'Python', 'Bash']],
  ['Cloud', ['Azure', 'AWS', 'Docker', 'Kubernetes', 'Terraform']],
  ['Dev', ['CI/CD', 'OAuth2', 'TDD', 'System Design', 'Observability']],
];

export const projects: Project[] = [
  {
    name: 'Emoji-Whisperer',
    year: '2023',
    summary: 'An NPM package processing text using RAKE and TF-IDF to map keyphrases with emojis',
    url: 'https://github.com/MagnusCardell/emoji-whisperer',
  },
  {
    name: 'UAV Navigation',
    year: '2020',
    summary: 'UAV path planning module integrating sensor inputs with static maps',
    url: 'https://www.diva-portal.org/smash/record.jsf?pid=diva2%3A1534501&dswid=-5796',
  },
];

const RULE = '-------------------------------------------';
const DOUBLE_RULE = '===========================================';

function section(title: string): string[] {
  return [RULE, title, RULE];
}

// resume.txt as the terminal shows it
export function resumeText(): string {
  const jobs = experience.flatMap((job) => [
    `${job.company}${job.via ? ` (via ${job.via})` : ''} - ${job.roles.map((r) => `${r.title} (${r.years})`).join(', ')}`,
    ...job.highlights.map((line) => `• ${line}`),
    '',
  ]);
  const schools = education.flatMap((s) => [
    `${s.school} - ${s.degree} (${s.years})`,
    ...(s.note ? [`• ${s.note}`] : []),
    '',
  ]);

  return [
    DOUBLE_RULE,
    `              ${profile.name.toUpperCase()}`,
    DOUBLE_RULE,
    '',
    `EMAIL: ${profile.email}`,
    `LINKEDIN: ${profile.linkedin}`,
    `GITHUB: ${profile.github}`,
    '',
    ...section('EXPERIENCE (Selected)'),
    ...jobs,
    ...section('SKILLS'),
    ...skillGroups.map(([group, items]) => `${group}: ${items.join(', ')}`),
    '',
    ...section('EDUCATION'),
    ...schools,
  ].join('\n').trimEnd();
}
