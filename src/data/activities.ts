import type { ActivityRecord } from '../lib/activity';

// First publications are supplied by Content Collections, once per article on pubDate.
// Add only confirmed activities here. A substantive article update may use writing/count: 1.
// Do not add metadata, formatting or whitespace-only edits, or infer activity from every Git commit.
// Repeated substantive updates need explicit records; never duplicate the automatic publication event.
export const activities: ActivityRecord[] = [];
