export interface SocialLink {
  iconName: string;
  link: string;
}

export interface BasicInfo {
  name: string;
  job: string;
  location?: string;
  email?: string;
  summary: { en: string };
  cv_file_name: string;
}

export interface HighlightItem {
  title: { en: string };
  description: { en: string };
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
  details?: { en: string };
  achievements?: { en: string }[];
}

export interface EducationItem {
  title: string;
  sub_title: string;
  years: string;
  details?: { en: string };
}

export interface ProjectItem {
  title: { en: string };
  type: { en: string };
  link: string;
  imageUrl?: string;
}
