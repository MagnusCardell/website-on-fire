import { useState, useCallback } from "react";

type FileSystemContent = string | FileSystem;

interface FileSystem {
  [key: string]: FileSystemContent;
}

const INITIAL_FILESYSTEM: FileSystem = {
  "~": {
    "resume.txt": `===========================================
             MAGNUS CARDELL
===========================================

EMAIL: cardell.magnus@gmail.com
GITHUB: github.com/MagnusCardell
LINKEDIN: linkedin.com/in/magnuscardell

-------------------------------------------
EXPERIENCE
-------------------------------------------
NETLIGHT CONSULTING | Client: PwC | 10/2020 - Current
Software Architect (2025-Present), Senior Consultant (2020–2024)
• Promoted during a system reliability crisis. Led an architectural turnaround under heavy audit scrutiny
• Developed a centralized OAuth2 BFF platform across 3 user agents, modernizing access grant flow
• Reduced monthly production incidents from 20 to 6 (-70%) over six months on a platform serving
  300 analysts / 1,000 users during peak audit season, while maintaining constant release cadence
• Developed a comprehensive system health-check framework to monitor real-time dependency status
  (DBs, queues, external APIs), improving deployment safety and MTTR
• Automated SBOM generation and license tracking across CI/CD pipelines supporting compliance and
  supply chain transparency with zero developer friction
• Designed Playwright-based E2E black-box tests for critical flows, catching regressions before deploys
• Developed a C# and JavaScript DSL with recursive parsing to enable nondevs to configure order workflows
• Mentored 2 junior engineers, conducted 20+ senior candidate interviews to grow engineering competence

HANDELSBANKEN CAPITAL MARKETS | 06/2018 - 10/2020
Software Engineer
• Built and maintained a financial reports platform in .NET/C#, featuring online collaboration and automated
  financial report distribution
• Implemented new data integrations to enhance financial projections in a TypeScript UI, streamlining processes
  within an API driven architecture
• Rebuilt a legacy web application to fit an Azure cloud environment, upgrading authentication to SSO

LUX SCIENCE INC. | 10/2017 - 06/2018
Software Developer
• Developed a web learning platform from scratch using JavaScript and PHP to connect Stripe payments and
  DynamoDB user data. Owned delivery in early-stage startup environment

-------------------------------------------
SKILLS
-------------------------------------------
• Programming: C#, Python, JavaScript/TypeScript (Angular, Node.js, React)
• Cloud: Azure, AWS, Kubernetes, Docker, Terraform, Serverless (Azure Functions, AWS Lambda)
• Data: SQL Server, Cosmos DB, Entity Framework, NoSQL

-------------------------------------------
PROJECTS
-------------------------------------------
EMOJI-WHISPERER (2023)
• Developed an NPM package that processes text using RAKE and TF-IDF to map keyphrases 
  with appropriate emojis using a custom scoring model

UAV NAVIGATION (2020)
• Built a UAV path planning module in ROS, integrating sensor inputs with static maps to track targets
• Evaluated A* and 3DVFH* in simulated embedded environments
• Published on DiVA: urn:nbn:se:kth:diva-291229

-------------------------------------------
EDUCATION
-------------------------------------------
BACHELOR OF ARTS | St. Olaf College | Northfield, MN | 2014 - 2018
• Double major in Computer Science and Music
• Awarded the highest merit-based music scholarship after a competitive audition process`,
    projects: {
      "website.md":
        "# Personal Website\n\nAn interactive terminal-based resume website built with React and TypeScript.\n\nThis Ubuntu desktop simulation showcases my skills using modern frontend technologies, with a realistic terminal emulation that supports command prediction and multiple panes.",
      "emoji-whisperer.md":
        "# Emoji-Whisperer (2023)\n\nAn NPM package that processes text using RAKE and TF-IDF algorithms to map keyphrases with appropriate emojis using a custom scoring model.\n\nGitHub: https://github.com/MagnusCardell/emoji-whisperer",
      "uav-navigation.md":
        "# UAV Navigation (2020)\n\nA UAV path planning module built in ROS, integrating sensor inputs with static maps to track targets. The project evaluated A* and 3DVFH* algorithms in simulated embedded environments.\n\nPublication: DiVA urn:nbn:se:kth:diva-291229",
    },
    docs: {
      "README.md":
        "# Documentation\n\nThis directory contains documentation for my projects.",
    },
  },
};

export const useFileSystem = () => {
  const [fileSystem, setFileSystem] = useState<FileSystem>(INITIAL_FILESYSTEM);
  const [currentDirectory, setCurrentDirectory] = useState("~");

  // Utility to resolve a path from the current directory
  const resolvePath = useCallback(
    (path: string): [FileSystem | null, string[] | null] => {
      if (path.startsWith("/")) {
        // Absolute path
        let current: FileSystem = fileSystem;
        const parts = path.split("/").filter((p) => p);

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (typeof current[part] !== "object") {
            return [null, null];
          }
          current = current[part] as FileSystem;
        }

        return [current, parts];
      } else {
        // Relative path
        let current: FileSystem = fileSystem;
        const currentParts =
          currentDirectory === "~"
            ? ["~"]
            : currentDirectory.split("/").filter((p) => p.length);

        for (const part of currentParts) {
          if (typeof current[part] !== "object") {
            return [null, null];
          }
          current = current[part] as FileSystem;
        }

        const parts = path.split("/").filter((p) => p);
        return [current, parts];
      }
    },
    [fileSystem, currentDirectory],
  );

  // Get content at a path
  const getContent = useCallback(
    (path: string): FileSystemContent | null => {
      if (path === "." || path === "./") {
        // Current directory
        return getContent(currentDirectory);
      }

      if (path === ".." || path === "../") {
        // Parent directory
        const parts = currentDirectory.split("/").filter((p) => p);
        if (parts.length <= 1) {
          return fileSystem["~"];
        }
        parts.pop();
        const parentPath = parts.join("/");
        return getContent(parentPath);
      }

      const [dir, parts] = resolvePath(path);
      if (!dir || !parts) return null;

      const targetName = parts[parts.length - 1];
      if (!targetName) return dir;

      return dir[targetName] || null;
    },
    [fileSystem, currentDirectory, resolvePath],
  );

  // Change directory
  const changeDirectory = useCallback(
    (path: string): boolean => {
      if (!path) {
        setCurrentDirectory("~");
        return true;
      }

      if (path === "." || path === "./") {
        return true; // Stay in current directory
      }

      if (path === ".." || path === "../") {
        // Go up one directory
        if (currentDirectory === "~") {
          return true; // Already at root
        }

        const parts = currentDirectory.split("/").filter((p) => p);
        parts.pop();
        setCurrentDirectory(parts.length ? "/" + parts.join("/") : "~");
        return true;
      }

      const content = getContent(path);
      if (content && typeof content === "object") {
        if (path.startsWith("/")) {
          setCurrentDirectory(path);
        } else {
          const newPath =
            currentDirectory === "~"
              ? `~/${path}`
              : `${currentDirectory}/${path}`;
          setCurrentDirectory(newPath);
        }
        return true;
      }

      return false;
    },
    [currentDirectory, getContent],
  );

  // List directory contents
  const listDirectory = useCallback(
    (path?: string): string[] => {
      const targetPath = path || currentDirectory;
      if (targetPath === "~") {
        return Object.keys(fileSystem["~"]);
      }
      const content = getContent(targetPath);

      if (content && typeof content === "object") {
        return Object.keys(content);
      }

      return [];
    },
    [currentDirectory, getContent],
  );

  // Create or update file content
  const updateFile = useCallback(
    (path: string, content: string): boolean => {
      const [dir, parts] = resolvePath(path);
      if (!dir || !parts) return false;

      const fileName = parts[parts.length - 1];
      if (!fileName) return false;

      setFileSystem((prev) => {
        const newFs = { ...prev };
        let current = newFs;

        // Navigate to the parent directory
        const currentParts =
          currentDirectory === "~"
            ? ["~"]
            : currentDirectory.split("/").filter((p) => p.length);

        for (const part of currentParts) {
          if (typeof current[part] !== "object") {
            return prev; // Can't find the path
          }
          current = current[part] as FileSystem;
        }

        // Update the file
        current[fileName] = content;
        return newFs;
      });

      return true;
    },
    [currentDirectory, resolvePath],
  );

  return {
    fileSystem,
    currentDirectory,
    getContent,
    changeDirectory,
    listDirectory,
    updateFile,
  };
};
