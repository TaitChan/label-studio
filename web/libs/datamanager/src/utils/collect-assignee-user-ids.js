/** Collect user IDs referenced by assignee fields on raw task API payloads. */
export function collectAssigneeUserIdsFromTasks(tasks) {
  if (!Array.isArray(tasks)) return [];

  const ids = new Set();

  const add = (value) => {
    if (value === null || value === undefined || value === "") return;
    ids.add(value);
  };

  for (const task of tasks) {
    for (const field of ["annotators", "reviewers", "updated_by", "comment_authors"]) {
      const items = task[field];
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (typeof item === "number" || typeof item === "string") {
          add(item);
        } else if (item && typeof item === "object") {
          add(item.user_id ?? item.id);
        }
      }
    }
  }

  return [...ids];
}
