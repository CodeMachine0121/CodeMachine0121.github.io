export interface SocialLink {
  iconName: string;
  link: string;
  /** Text shown in the CV header; defaults to the icon name. */
  label?: string;
}

export type Language = 'en' | 'zh';

export interface LocalizedText {
  en: string;
  zh?: string;
}

export interface BasicInfo {
  name: string;
  job: string;
  /** The stack shown after the job title in the CV header, e.g. ".NET Core / Go / TypeScript". */
  tech?: string;
  location?: string;
  email?: string;
  looking_for?: LocalizedText;
  summary: LocalizedText;
}

export interface SkillGroup {
  category: LocalizedText;
  items: string[];
}

/** One bullet, optionally linked, optionally with its own nested bullets. */
export interface Achievement extends LocalizedText {
  link?: string;
  items?: Achievement[];
}

export interface ExperienceItem {
  title: string;
  title_link?: string;
  sub_title: string;
  sub_title_link?: string;
  years?: string;
  details?: LocalizedText;
  /** Shown as a "Stack:" line between the details and the bullets. */
  stack?: string;
  achievements?: Achievement[];
}

export interface EducationItem {
  title: string;
  sub_title: string;
  years: string;
  details?: LocalizedText;
}

export interface ProjectItem {
  title: LocalizedText;
  achievements?: Achievement[];
  type: LocalizedText;
  link: string;
  imageUrl?: string;
}

export interface CvData {
  basic: BasicInfo;
  skills?: SkillGroup[];
  experiences: ExperienceItem[];
  projects: ProjectItem[];
  talks?: ExperienceItem[];
  writing?: ExperienceItem[];
  certifications?: ExperienceItem[];
  education: EducationItem[];
  socialLinks: SocialLink[];
}
