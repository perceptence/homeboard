"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/Icons";
import { Card, IconTile, List, Row } from "@/components/ui";
import { listItem, listStagger } from "@/lib/motion";
import { searchAll, useHousehold } from "@/lib/store";

/** One query across every domain in the home — tasks, shopping, bills, upkeep, people. */
export function SearchResults() {
  const s = useHousehold();
  const hits = searchAll(s, s.query);

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <motion.div variants={listItem}>
        <h1 className="text-h1">Results for &ldquo;{s.query}&rdquo;</h1>
        <p className="mt-1 text-body font-medium text-sub">
          {hits.length} {hits.length === 1 ? "thing" : "things"} across your home
        </p>
      </motion.div>

      <motion.div variants={listItem} className="mt-section">
        {hits.length ? (
          <Card pad="none">
            <List>
              {hits.map((h) => (
                <Row
                  key={h.key}
                  lead={<IconTile name={h.icon} />}
                  title={h.title}
                  meta={h.meta}
                  onClick={() => {
                    s.setQuery("");
                    s.goIpad(h.taskId ? "tasks" : h.route);
                    if (h.taskId) s.openSheet({ type: "task", id: h.taskId });
                  }}
                  actions={<Icon name="fwd" size={16} className="text-sub" />}
                />
              ))}
            </List>
          </Card>
        ) : (
          <Card pad="lg" className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-surface text-sub">
              <Icon name="search" size={22} />
            </div>
            <h2 className="mt-4 text-h2">Nothing matches</h2>
            <p className="mt-1.5 text-body font-medium text-sub">
              Try a person, a chore, a bill — search reaches everything.
            </p>
          </Card>
        )}
      </motion.div>
    </motion.div>
  );
}
