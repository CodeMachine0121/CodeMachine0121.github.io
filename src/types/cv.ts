export interface SocialLink {
  iconName: string;
  link: string;
}

export type Language = 'en' | 'zh';

export interface LocalizedText {
  en: string;
  zh?: string;
}

export interface BasicInfo {
  name: string;
  job: string;
  location?: string;
  email?: string;
  looking_for?: LocalizedText;
  summary: LocalizedText;
}

export interface SkillGroup {
  category: LocalizedText;
  items: string[];
}

export interface ExperienceItem {
  title: string;
  sub_title: string;
  years: string;
  details?: LocalizedText;
  achievements?: LocalizedText[];
}

export interface EducationItem {
  title: string;
  sub_title: string;
  years: string;
  details?: LocalizedText;
}

export interface ProjectItem {
  title: LocalizedText;
  description?: LocalizedText;
  type: LocalizedText;
  link: string;
  imageUrl?: string;
}

export interface CvData {
  basic: BasicInfo;
  skills?: SkillGroup[];
  experiences: ExperienceItem[];
  side_projects?: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  socialLinks: SocialLink[];
}
