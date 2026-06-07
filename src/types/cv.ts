export interface SocialLink {
  iconName: string;
  link: string;
}

export interface BasicInfo {
  name: string;
  job: string;
  summary: { en: string };
  cv_file_name: string;
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
