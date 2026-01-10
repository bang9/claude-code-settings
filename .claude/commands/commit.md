# Commit Command

**Purpose**: Generate clean, one-line commit messages following Conventional Commits specification

**How it works**:
1. Analyzes current git changes of $ARGUMENTS(staged, unstaged, untracked)
2. Determines commit type based on file patterns
3. Generates a concise commit message in format: `type: description`

**Commit types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code restructuring
- `test`: Test additions or modifications
- `chore`: Build process or tool changes
- `ci`: CI/CD configuration changes

This automates commit message creation while maintaining consistency across the project.
