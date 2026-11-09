import type { Project, Section, Task } from "@todoist-clone/domain";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const SearchPalette = ({
  tasks,
  projects = Object.freeze([]),
  sections = Object.freeze([]),
  onTaskSelect,
}: Readonly<{
  tasks: ReadonlyArray<Task>;
  projects?: ReadonlyArray<Project>;
  sections?: ReadonlyArray<Section>;
  onTaskSelect: (task: Task) => void;
}>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const taskResults =
    normalizedQuery.length === 0
      ? Object.freeze([])
      : tasks.filter((task) =>
          [task.title, task.description, ...task.labels].some((value) =>
            value.toLocaleLowerCase().includes(normalizedQuery),
          ),
        );
  const labels = Array.from(new Set(tasks.flatMap((task) => task.labels))).filter(
    (label) => normalizedQuery.length > 0 && label.toLocaleLowerCase().includes(normalizedQuery),
  );
  const projectResults = projects.filter(
    (project) => normalizedQuery.length > 0 && project.title.toLocaleLowerCase().includes(normalizedQuery),
  );
  const sectionResults = sections.filter(
    (section) => normalizedQuery.length > 0 && section.title.toLocaleLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.code === "KeyK" || event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  return (
    <>
      <button type="button" className="nav-button search-nav-button" onClick={() => setOpen(true)}>
        <Search size={16} aria-hidden="true" />
        Search <kbd>Ctrl K</kbd>
      </button>
      {open
        ? createPortal(
            <div
              className="search-palette-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section className="search-palette" role="dialog" aria-modal="true" aria-label="Search">
                <div className="search-palette-input">
                  <Search size={20} aria-hidden="true" />
                  <input
                    ref={inputRef}
                    aria-label="Search or type a command"
                    placeholder="Search tasks, labels, or go to…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <kbd>Ctrl</kbd>
                  <kbd>K</kbd>
                </div>
                {normalizedQuery ? (
                  <div className="search-palette-results">
                    {taskResults.length ? (
                      <>
                        <h2>Tasks</h2>
                        {taskResults.slice(0, 30).map((task) => (
                          <button
                            className="search-result"
                            type="button"
                            key={task.id}
                            onClick={() => {
                              onTaskSelect(task);
                              setOpen(false);
                            }}
                          >
                            <span className="search-result-icon">○</span>
                            <span className="search-result-main">
                              <strong>{task.title}</strong>
                              {task.description ? <small>{task.description}</small> : null}
                            </span>
                            {task.labels.length ? (
                              <small>{task.labels.map((label) => `#${label}`).join(" ")}</small>
                            ) : null}
                          </button>
                        ))}
                      </>
                    ) : null}
                    {labels.length ? (
                      <>
                        <h2>Labels</h2>
                        {labels.map((label) => (
                          <a
                            className="search-result"
                            key={label}
                            href={`/labels?label=${encodeURIComponent(label)}`}
                            onClick={() => setOpen(false)}
                          >
                            <span className="search-result-icon">◇</span>
                            <strong>{label}</strong>
                          </a>
                        ))}
                      </>
                    ) : null}
                    {projectResults.length ? (
                      <>
                        <h2>Projects</h2>
                        {projectResults.map((project) => (
                          <a
                            className="search-result"
                            key={project.id}
                            href={`/?project=${encodeURIComponent(project.id)}`}
                            onClick={() => setOpen(false)}
                          >
                            <span className="search-result-icon">#</span>
                            <strong>{project.title}</strong>
                          </a>
                        ))}
                      </>
                    ) : null}
                    {sectionResults.length ? (
                      <>
                        <h2>Sections</h2>
                        {sectionResults.map((section) => (
                          <a
                            className="search-result"
                            key={section.id}
                            href={
                              section.projectId ? `/?project=${encodeURIComponent(section.projectId)}` : "/"
                            }
                            onClick={() => setOpen(false)}
                          >
                            <span className="search-result-icon">☷</span>
                            <strong>{section.title}</strong>
                          </a>
                        ))}
                      </>
                    ) : null}
                    {!taskResults.length &&
                    !labels.length &&
                    !projectResults.length &&
                    !sectionResults.length ? (
                      <p className="search-empty">No matching tasks, labels, projects, or sections.</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="search-palette-navigation">
                    <h2>Navigation</h2>
                    {[
                      { label: "Go to Inbox", href: "/" },
                      { label: "Go to Dates", href: "/dates" },
                      { label: "Go to Labels", href: "/labels" },
                    ].map((item) => (
                      <a
                        className="search-result"
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                      >
                        <span className="search-result-icon">⌂</span>
                        <strong>{item.label}</strong>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
