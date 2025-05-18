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

EMAIL: cardell.magnus[at]gmail.com
LINKEDIN: linkedin.com/in/magnuscardell
GITHUB: github.com/MagnusCardell

-------------------------------------------
EXPERIENCE (Selected)
-------------------------------------------
PwC (via Netlight) – Software Architect (2025–Present)
• Led architectural modernization effort across regulated financial systems
• Developed a C# and JavaScript DSL with recursive parsing to enable configurable workflows
• Mentored junior engineers and contributed to internal hiring efforts

Netlight Consulting – Senior Consultant (2020–2024)
• Built cloud-based systems in Azure/AWS for enterprise clients

Handelsbanken Capital Markets – Software Engineer (2018–2020)
• Delivered .NET-based financial tools for reporting and forecasting

Lux Science Inc. – Fullstack Developer (2017–2018)
• Built an educational payments platform with Stripe, PHP, and DynamoDB

-------------------------------------------
SKILLS
-------------------------------------------
Languages: C#, TypeScript, Python, Bash
Cloud: Azure, AWS, Docker, Kubernetes, Terraform
Dev: CI/CD, OAuth2, TDD, System Design, Observability

-------------------------------------------
EDUCATION
-------------------------------------------
St. Olaf College – BA Computer Science & Music (2014–2018)
• Christiansen Scholarship recipient`,
    projects: {
      "website.md":
        "# Personal Website\n\nAn interactive terminal-based resume website built with React and Express.",
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
