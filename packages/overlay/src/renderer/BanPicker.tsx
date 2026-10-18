import { useState } from 'react';
import type { BanDef, Category } from '@banwars/shared';

export const FOLDERS: { id: Category; label: string }[] = [
  { id: 'operator', label: 'Operator Groups' },
  { id: 'sights', label: 'Sights' },
  { id: 'movement', label: 'Movement & Aim' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'utility', label: 'Gadgets' },
  { id: 'comms', label: 'Comms' },
];

const css = `
.bp{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.bp-tabs{display:flex;flex-wrap:wrap;gap:6px}
.bp-tab{all:unset;box-sizing:border-box;cursor:pointer;padding:5px 11px;border-radius:9px;font-size:13px;font-weight:800;
  background:rgba(0,0,0,.3);border:2px solid rgba(255,255,255,.25);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.bp-tab small{margin-left:6px;opacity:.75;font-size:11px}
.bp-tab.on{background:linear-gradient(var(--o1,#e8b45e),var(--o2,#d6953a));border-color:var(--ob,#f7dc92 #c49a3e)}
.bp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.bp-item{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:10px;font-size:13px;font-weight:700;
  background:rgba(0,0,0,.3);border:2px solid rgba(255,255,255,.25);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.bp-copy{display:flex;flex-direction:column;gap:5px;min-width:0}
.bp-copy small{font-size:10px;font-weight:500;line-height:1.35;opacity:.82}
.bp-operators{display:flex;flex-wrap:wrap;gap:5px 0;padding-right:8px}
.bp-operators img{position:relative;width:30px;height:30px;flex:none;margin-right:-8px;object-fit:contain;border:2px solid rgba(255,255,255,.8);border-radius:50%;background:#454545}
.bp-item .n{margin-left:auto;font-size:11px;font-weight:800;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.25)}
.bp-item:not(.lock):not(:disabled){cursor:pointer}
.bp-item:not(.lock):not(:disabled):hover{border-color:var(--g1,#72d672)}
.bp-item.mine{background:linear-gradient(var(--g1,#72d672),var(--g2,#45b245));border-color:var(--gb,#9cf09c #1e9a1e)}
.bp-item.lock{opacity:.5}
.bp-item .pro{margin-left:auto;font-size:9px;letter-spacing:.06em}
.bp-grid{max-height:230px;overflow-y:auto;padding-right:2px}
.bp-search{all:unset;box-sizing:border-box;width:100%;padding:6px 10px;border-radius:9px;font-size:13px;font-weight:600;
  background:rgba(255,255,255,.9);color:#222;border:2px solid #636363;user-select:text}
`;

interface Props {
  catalog: BanDef[]; availableBanIds: string[]; tally: Record<string, number>;
  myVote: string | null; onPick: (id: string) => void; disabled?: boolean;
}

/** Folder tabs on top; the selected folder's bans below. Click one ban to vote for it. */
export default function BanPicker({ catalog, availableBanIds, tally, myVote, onPick, disabled }: Props) {
  const [folder, setFolder] = useState<Category>('operator');
  const [q, setQ] = useState('');
  const available = new Set(availableBanIds);
  const inFolder = catalog.filter((b) => b.category === folder);
  const items = inFolder.filter((b) => b.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="bp"><style>{css}</style>
      <div className="bp-tabs">
        {FOLDERS.map((f) => (
          <button key={f.id} className={`bp-tab ${folder === f.id ? 'on' : ''}`} onClick={() => { setFolder(f.id); setQ(''); }}>
            {f.label}<small>{catalog.filter((b) => b.category === f.id).length}</small>
          </button>
        ))}
      </div>
      {inFolder.length > 12 && (
        <input className="bp-search" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="bp-grid">
        {items.map((b) => {
          const locked = !available.has(b.id);
          return (
            <button key={b.id} className={`bp-item ${myVote === b.id ? 'mine' : ''} ${locked ? 'lock' : ''}`}
              disabled={disabled || locked} onClick={() => onPick(b.id)} title={locked ? 'Premium only this game' : b.label}>
              <span className="bp-copy">
                <span>{b.label}</span>
                {b.operatorImages && (
                  <span className="bp-operators">
                    {b.operatorImages.map((image) => (
                      <img key={image} src={`./operators/${image}`} alt={image.replace('.png', '')} title={image.replace('.png', '')} />
                    ))}
                  </span>
                )}
              </span>
              {locked ? <span className="pro">PREMIUM</span> : tally[b.id] ? <span className="n">{tally[b.id]}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
