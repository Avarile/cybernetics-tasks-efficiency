import { useState } from 'react';
import { useOkrTree, OkrTreeNode as OkrTreeNodeType } from '../lib/queries';
import { KrProgressBar } from '../components/KrProgressBar';

function OkrTreeNode({ node, depth = 0 }: { node: OkrTreeNodeType; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className={`${depth > 0 ? 'ml-6 mt-3 border-l-2 border-gray-200 pl-4' : ''}`}>
      {/* Objective */}
      <div className="flex items-center gap-2">
        {hasChildren && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-600 text-sm w-4"
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        <h3 className={`font-semibold text-gray-800 ${depth === 0 ? 'text-lg' : 'text-base'}`}>
          {node.objective.title}
        </h3>
      </div>

      {/* Key results */}
      {node.keyResults.length > 0 && (
        <div className="mt-2 ml-6 space-y-2">
          {node.keyResults.map((kr) => (
            <div key={kr.keyResult.id} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-700">{kr.keyResult.title}</span>
                <span className="text-gray-500 text-xs">
                  {Math.round(kr.progressPct * 100)}% &middot;{' '}
                  <span
                    className={
                      kr.paceStatus === 'behind'
                        ? 'text-red-600'
                        : kr.paceStatus === 'ahead'
                          ? 'text-green-600'
                          : 'text-amber-600'
                    }
                  >
                    {kr.paceStatus}
                  </span>
                </span>
              </div>
              <KrProgressBar progressPct={kr.progressPct} paceStatus={kr.paceStatus} />
            </div>
          ))}
        </div>
      )}

      {/* Children */}
      {expanded && node.children.length > 0 && (
        <div className="mt-3">
          {node.children.map((child) => (
            <OkrTreeNode key={child.objective.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OkrTree() {
  const [slug, setSlug] = useState('');
  const [inputValue, setInputValue] = useState('');

  const { data, isLoading, error } = useOkrTree(slug);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSlug(inputValue.trim());
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">OKR Tree</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter objective slug…"
          className="flex-1 max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
        >
          Load
        </button>
      </form>

      {isLoading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && (
        <p className="text-red-600 text-sm">
          {(error as Error).message}
        </p>
      )}
      {data && <OkrTreeNode node={data} />}
      {!slug && !data && (
        <p className="text-gray-400 text-sm">Enter an objective slug above to load its OKR tree.</p>
      )}
    </div>
  );
}
