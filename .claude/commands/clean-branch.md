# Clean Branch Command

**Purpose**: Remove local branches that no longer exist on the remote repository

**How it works**:
1. Fetches latest remote branch information
2. Identifies local branches without remote counterparts
3. Deletes these orphaned local branches
4. Note: Git output language may vary based on system locale (e.g., "gone" vs "없음")

This keeps your local repository clean by removing outdated branch references.
