// Resume Vue Component
document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("resume-app")) {
    const { createApp } = Vue;

    createApp({
      data() {
        return {
          profile: {
            name: "James Hsueh",
            title: "Backend Developer & DevOps Engineer",
            image: "https://gcdnb.pbrd.co/images/LSSIC7plBKbi.png?o=1",
            summary:
              "Experienced backend developer with expertise in .NET Core, microservices architecture, and DevOps practices. Passionate about clean code, system optimization, and knowledge sharing.",
          },
          contact: {
            email: "asdfg55887@gmail.com",
            github: "CodeMachine0121",
            linkedin: "james-hsueh",
            location: "Taiwan",
          },
          skills: {
            languages: ["C#", "JavaScript/TypeScript", "Go", "Python"],
            frameworks: [".NET Core", "Vue.js", "ASP.NET"],
            devops: ["Kubernetes", "Docker", "CI/CD", "GitLab", "Azure DevOps"],
            cloud: ["Azure", "GKE", "GCP"],
            databases: ["SQL Server", "MySQL", "Oracle", "Redis"],
            other: [
              "Microservices",
              "Clean Architecture",
              "Hexagonal Architecture",
              "TDD",
              "Blockchain",
            ],
          },
          currentJob: {
            company: "DUOTIFY 多奇數位",
            title: "Backend Developer",
            period: "2025~ Now",
            skills: [
              "Backend: .Net Core",
              "Microservices Architecture",
              "Cloud Services",
            ],
            achievements: [
              "Refactoring 20-year-old System of Bank with Micro-Service",
              "Implementing Strategy Module for Interal System to support Loan Process Logic (English)",
              "Setup CI/CD Pipeline for Projects",
              "Setup Test Environment for Projects",
            ],
          },
          workExperience: [
            {
              company: "GARMIN 台灣國際航電股份有限公司",
              title: "SRE Backend Developer",
              period: "2024~ 2025",
              skills: [
                "Backend: .Net Core",
                "Observability: OpenTelemetry, Granafa, Loki, Tempo",
                "System Reliability Engineering",
                "Performance Optimization",
              ],
              achievements: [
                "Refactor projects make it more maintainable",
                "Provide SDK for projects Auto Tracing",
                "Provide SDK for Servers Health Check",
                "Implemented comprehensive monitoring solutions",
                "Reduced system downtime by 30% through proactive monitoring",
              ],
            },
            {
              company: "Titansoft, 新加坡商鈦坦科技",
              title: "Product Developer",
              period: "2022~ 2024",
              skills: [
                "Backend: .NET Core",
                "Frontend: Vue3",
                "Use K8s for deployments of projects",
                "Use GitLab for CI/CD",
                "ELK Stack for logging and monitoring",
              ],
              achievements: [
                "Import hexagonal architecture knowledge for members",
                "Acting as the outlink in the team",
                "Host refactor workshop for intern team",
                "Pass CKAD (Certified Kubernetes Application Developer)",
                "Host DevOps workshop, teaching about Docker and K8s",
                "Representing Titansoft at the GDG dinner",
                "As a speaker at GDG for twice",
                "Construct ELK for K8s projects",
                "Refactoring legacy code and fix the 2-year-old bugs",
              ],
            },
          ],
          education: [
            {
              degree: "Master's Degree",
              field: "Computer Science and Information Engineering",
              institution:
                "National Yunlin University of Science and Technology, YunTech",
              period: "2020 ~ 2022",
              description:
                "Study on Blockchain and Network Security Research Area",
              achievements: [
                "Thesis: Advanced Blockchain Security Mechanisms",
                "Research Assistant for Network Security Lab",
                "Published paper on blockchain transaction security",
                "Participated in network security competitions",
              ],
            },
            {
              degree: "Bachelor's Degree",
              field: "Information and Telecommunication Engineering",
              institution: "Ming Chaun University, MCU",
              period: "2016 ~ 2020",
              description: "Study on Network Security Research Area",
              achievements: [
                "Participated in network security competitions",
                "Implement blockchain coldwallet module",
              ],
            },
          ],
          certifications: [
            {
              name: "Certified Kubernetes Application Developer (CKAD)",
              issuer: "The Cloud Native Computing Foundation",
              date: "2024",
            },
            {
              name: "Microsoft Certified: Azure Developer Associate",
              issuer: "Microsoft",
              date: "2022",
            },
          ],
          personalAchievements: [
            {
              text: "Current: Sharing Tech Knowledge on Blog",
            },
            {
              text: "PasswordManager using <b>Vault</b>",
              link: "https://github.com/CodeMachine0121/PasswordManager",
            },
            {
              text: "iThome 鐵人賽 自我挑戰",
              subItems: [
                {
                  text: "Side-Project:: 為自己打造個可編輯的區塊鏈",
                  link: "https://ithelp.ithome.com.tw/users/20115082/ironman/7165",
                },
              ],
            },
            {
              text: "Open Source SDK for nuget: EccSDK",
              link: "https://www.nuget.org/packages/EccSDK#usedby-body-tab",
            },
            {
              text: "Host Refactor WorkShop for Intern Team in TitanSoft",
            },
            {
              text: "Department Sharing: <b>Clean Architecture</b>",
            },
            {
              text: "Pass CKAD License",
            },
            {
              text: "GDG Kaohsiung Speaker",
              link: "https://gdg.community.dev/gdg-kaohsiung/",
              subItems: [
                {
                  text: "使用 Golang 監聽 Discord 頻道延遲",
                  link: "https://gdg.community.dev/events/details/google-gdg-kaohsiung-presents-toocon-9/",
                },
                {
                  text: "讓 Vim 成為 IDE",
                  link: "https://gdg.community.dev/events/details/google-gdg-kaohsiung-presents-toocon-11/",
                },
              ],
            },
            { text: "Host DevOps WorkShop in TitanSoft" },
            {
              text: "iThome 鐵人賽 自我挑戰組",
              subItems: [
                {
                  text: "在30天內使用 golang 寫出 30種不同的設計模型",
                  link: "https://ithelp.ithome.com.tw/users/20115082/ironman/5988?page=1",
                },
              ],
            },
            { text: "Join 91's TDD Workshop in TitanSoft" },
            { text: "Blockchain Trusted Transaction Module" },
            { text: "Microwave Detection Analyser Module" },
            { text: "Full Stack Develop - Website of CSIE in YunTech" },
            { text: "Department Network Administrator in YunTech" },
            { text: "Custom Blockchain System with <b>ZooKeeper</b>" },
            { text: "Blockchain Cold Wallet Transaction Module" },
          ],
          projects: [
            {
              name: "EccSDK",
              description:
                "Open source .NET library for Elliptic Curve Cryptography",
              technologies: [".NET Core", "Cryptography", "NuGet"],
              link: "https://www.nuget.org/packages/EccSDK",
            },
            {
              name: "Custom Blockchain System",
              description:
                "Distributed blockchain system using ZooKeeper for consensus",
              technologies: [
                "Blockchain",
                "ZooKeeper",
                "Go",
                "Distributed Systems",
              ],
            },
            {
              name: "Microservices Logging Framework",
              description:
                "Standardized logging framework for microservices using ECS",
              technologies: [".NET Core", "ELK Stack", "Microservices"],
            },
          ],
        };
      },
      methods: {
        renderHTML(text) {
          return text;
        },
        formatDate(date) {
          return date ? new Date(date).toLocaleDateString() : "";
        },
      },
    }).mount("#resume-app");
  }
});
