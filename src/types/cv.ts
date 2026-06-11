export interface SocialLink {
  iconName: string;
  link: string;
}

export type Language = 'en' | 'zh';

export interface BasicInfo {
  name: string;
  job: string;
  location?: string;
  email?: string;
  summary: { en: string; zh?: string };
  cv_file_name: string;
}

export interface HighlightItem {
  title: { en: string; zh?: string };
  description: { en: string; zh?: string };
}

export interface CvData {
  basic: BasicInfo;
  highlights?: HighlightItem[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  socialLinks: SocialLink[];
}

export interface ExperienceItem {
  title: string;
  sub_title: string;
  years: string;
  details?: { en: string; zh?: string };
  achievements?: { en: string; zh?: string }[];
}

export interface EducationItem {
  title: string;
  sub_title: string;
  years: string;
  details?: { en: string; zh?: string };
}

export interface ProjectItem {
  title: { en: string; zh?: string };
  type: { en: string; zh?: string };
  link: string;
  imageUrl?: string;
}
