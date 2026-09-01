'use client';

import type { CalculationResult, StepId } from '@cnl/core';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatEuro, formatEuroCompact, formatPercent } from '@/lib/format';

/**
 * Dove finiscono i soldi: diagramma di Sankey scritto a mano in SVG.
 *
 * A differenza del «percorso della retribuzione» — che e' una sequenza di operazioni —
 * qui la RAL e' una quantita' che si divide: ogni nastro e' largo quanto i soldi che ci
 * passano dentro, e cio' che esce a destra somma esattamente a cio' che entra a sinistra.
 * Nessuna scala «aggiustata»: se una voce sembra sottile, e' perche' lo e'.
 *
 * Le etichette stanno in HTML sopra l'SVG, non dentro: cosi' restano leggibili a
 * qualsiasi larghezza invece di rimpicciolirsi insieme al viewBox.
 */

const VIEW_W = 1000;
const VIEW_H = 440;
const NODE_W = 12;
const GAP = 14;
/* L'ultima colonna non tocca il bordo: la fascia a destra e' riservata alle
   etichette, cosi' non si accavallano ai nastri ne fra loro. */
const COLUMN_X = [0, 400, 752] as const;
const LABEL_GUTTER = 16;
/** Larghezza del solo disegno: sotto `md` le etichette non ci sono e la fascia
 *  che le ospiterebbe verrebbe sprecata, quindi il viewBox si ferma qui. */
const CHART_W = COLUMN_X[2] + NODE_W;

type Tone = 'drain' | 'keep' | 'source';

type FlowNode = {
  id: string;
  label: string;
  amount: number;
  tone: Tone;
  /** Quanto pesa la voce sulla RAL: e' la lettura che interessa, non il valore assoluto. */
  shareOfGross: number;
  column: 0 | 1 | 2;
  x: number;
  y: number;
  h: number;
  /** Centro dell'etichetta: scostato dal centro del nodo quando la banda e' troppo
   *  sottile perche' due etichette adiacenti ci stiano senza sovrapporsi. */
  labelY: number;
};

type FlowLink = {
  id: string;
  from: string;
  to: string;
  tone: Tone;
  sourceY: number;
  targetY: number;
  height: number;
};

export function MoneyFlow({ result }: { result: CalculationResult }) {
  const [active, setActive] = useState<string | null>(null);
  const flow = useMemo(() => buildFlow(result), [result]);

  if (!flow) return null;

  const { nodes, links, gross, colorOf } = flow;
  const dimmed = (ids: string[]) => active !== null && !ids.includes(active);
  const destinations = nodes.filter((n) => n.column === 2);

  const chart = (
    <>
      {links.map((link) => (
        <path
          key={link.id}
          d={ribbonPath(link, nodes)}
          fill={colorOf(link.to)}
          className="cursor-pointer transition-opacity duration-300"
          opacity={dimmed([link.from, link.to]) ? 0.07 : 0.32}
          onMouseEnter={() => setActive(link.to)}
          onMouseLeave={() => setActive(null)}
        />
      ))}

      {/* Connettori: solo dove l'etichetta e' stata scostata dalla sua banda,
          altrimenti non si capirebbe a quale voce si riferisce. */}
      {nodes
        .filter((n) => n.column === 2 && Math.abs(n.labelY - (n.y + n.h / 2)) > 2)
        .map((node) => (
          <path
            key={`leader-${node.id}`}
            d={leaderPath(node)}
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1}
            opacity={dimmed([node.id]) ? 0.15 : 0.45}
            className="hidden transition-opacity duration-300 md:block"
          />
        ))}

      {nodes.map((node) => (
        <g key={node.id}>
          <rect
            x={node.x}
            y={node.y}
            width={NODE_W}
            height={Math.max(2, node.h)}
            rx={3}
            fill={colorOf(node.id)}
            className="transition-opacity duration-300"
            opacity={dimmed([node.id]) ? 0.22 : 1}
          />
          {/* Area di presa generosa: una banda dell'1% e alta pochi pixel, e
              senza questo rettangolo invisibile sarebbe impossibile puntarla. */}
          <rect
            x={node.x - 8}
            y={node.y - 4}
            width={NODE_W + 16}
            height={Math.max(2, node.h) + 8}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setActive(node.id)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${node.label}: ${formatEuro(node.amount)} (${formatPercent(node.shareOfGross, 1)} della RAL)`}</title>
          </rect>
        </g>
      ))}
    </>
  );

  return (
    <div>
      <p className="max-w-xl text-xs text-[var(--text-muted)]">
        Ogni nastro è largo quanto il denaro che ci passa dentro. Ciò che esce a destra somma
        esattamente alla RAL di partenza: niente si perde per strada, tutto ha una destinazione.
      </p>

      <div className="relative mt-6">
        {/* Stesso disegno, due inquadrature: con e senza la fascia delle etichette. */}
        <svg
          viewBox={`0 0 ${CHART_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="block h-[15rem] w-full md:hidden"
          role="img"
          aria-label={describe(destinations, gross)}
        >
          {chart}
        </svg>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="hidden h-auto w-full md:block"
          role="img"
          aria-label={describe(destinations, gross)}
        >
          {chart}
        </svg>
        {/* Etichette in HTML: posizionate in percentuale, seguono lo scalare del viewBox. */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {nodes.map((node) => (
            <span
              key={node.id}
              className={cn(
                'absolute whitespace-nowrap text-[11px] leading-tight transition-opacity duration-300',
                dimmed([node.id]) ? 'opacity-20' : 'opacity-100',
              )}
              style={{
                top: `${(node.labelY / VIEW_H) * 100}%`,
                left: `${((node.x + NODE_W + LABEL_GUTTER) / VIEW_W) * 100}%`,
                transform: 'translateY(-50%)',
              }}
            >
              <span className="block text-[var(--text)]">{node.label}</span>
              <span className="tnum block text-[var(--text-muted)]">
                {formatEuroCompact(node.amount)} · {formatPercent(node.shareOfGross, 0)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <ul
        data-testid="money-flow-legend"
        className="mt-7 grid gap-1 border-t border-[var(--border)] pt-4 sm:grid-cols-2"
      >
        {destinations.map((node) => (
          <li key={node.id} className={cn(node.tone === 'keep' && 'sm:col-span-2')}>
            <button
              type="button"
              onMouseEnter={() => setActive(node.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(node.id)}
              onBlur={() => setActive(null)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-opacity',
                'hover:bg-[var(--surface-muted)]',
                dimmed([node.id]) && 'opacity-40',
              )}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: colorOf(node.id) }}
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  node.tone === 'keep' && 'font-medium',
                )}
              >
                {node.label}
              </span>
              <span
                className={cn(
                  'tnum shrink-0 text-sm',
                  node.tone === 'keep' && 'text-[var(--positive)]',
                )}
              >
                {formatEuro(node.amount)}
              </span>
              <span className="tnum w-14 shrink-0 text-right text-xs text-[var(--text-muted)]">
                {formatPercent(node.shareOfGross, 1)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ geometria

/** Altezza minima che un'etichetta su due righe occupa, in unita' di viewBox. */
const LABEL_SPACING = 36;

/**
 * Addizionale regionale e comunale valgono l'1% della RAL: le loro bande sono
 * alte pochi pixel e le etichette si sovrapporrebbero. Qui si allontanano quel
 * tanto che basta, mantenendo l'ordine verticale — nessuna etichetta scavalca
 * la voce che la precede.
 */
function spreadLabels(column: FlowNode[]) {
  const sorted = [...column].sort((a, b) => a.y - b.y);

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    current.labelY = Math.max(current.labelY, previous.labelY + LABEL_SPACING);
  }

  // Se la spinta verso il basso ha sforato, si recupera risalendo dall'ultima.
  const last = sorted[sorted.length - 1];
  if (last && last.labelY > VIEW_H - LABEL_SPACING / 2) {
    last.labelY = VIEW_H - LABEL_SPACING / 2;
    for (let i = sorted.length - 2; i >= 0; i -= 1) {
      const next = sorted[i + 1]!;
      const current = sorted[i]!;
      current.labelY = Math.min(current.labelY, next.labelY - LABEL_SPACING);
    }
  }
}

function ribbonPath(link: FlowLink, nodes: FlowNode[]): string {
  const source = nodes.find((n) => n.id === link.from);
  const target = nodes.find((n) => n.id === link.to);
  if (!source || !target) return '';

  const x0 = source.x + NODE_W;
  const x1 = target.x;
  const xm = (x0 + x1) / 2;
  const { sourceY: a, targetY: b, height } = link;

  return [
    `M ${x0} ${a}`,
    `C ${xm} ${a}, ${xm} ${b}, ${x1} ${b}`,
    `L ${x1} ${b + height}`,
    `C ${xm} ${b + height}, ${xm} ${a + height}, ${x0} ${a + height}`,
    'Z',
  ].join(' ');
}

/** Gomito nel corridoio fra la barra del nodo e il testo dell'etichetta. */
function leaderPath(node: FlowNode): string {
  const center = node.y + node.h / 2;
  const x = node.x + NODE_W;
  return `M ${x} ${center} L ${x + 5} ${center} L ${x + 11} ${node.labelY} L ${x + LABEL_GUTTER} ${node.labelY}`;
}

function describe(destinations: FlowNode[], gross: number): string {
  const parts = destinations.map(
    (n) => `${n.label} ${formatEuroCompact(n.amount)}, ${formatPercent(n.shareOfGross, 0)}`,
  );
  return `Diagramma di flusso: come si dividono ${formatEuroCompact(gross)} di RAL. ${parts.join('; ')}.`;
}

// ------------------------------------------------------------------ modello

type Destination = { id: string; label: string; amount: number; tone: Tone };

function buildFlow(result: CalculationResult) {
  const amountOf = (id: StepId) => result.steps.find((s) => s.id === id)?.amount ?? 0;

  const gross = result.totals.gross;
  const contributions = -amountOf('social_security');
  const irpef = -amountOf('irpef_net');
  const regional = -amountOf('regional_surcharge');
  const municipal = -amountOf('municipal_surcharge');
  const extras = amountOf('supplementary_treatment') + amountOf('tax_free_benefits');

  // La base imponibile e' RAL meno contributi; da li' escono imposte e netto.
  const taxable = gross - contributions;
  // Il residuo si ricava per differenza, non dal totale: cosi' i nastri riempiono
  // esattamente il nodo, senza l'ammanco di un centesimo dovuto agli arrotondamenti.
  const netFromTaxable = taxable - irpef - regional - municipal;

  if (gross <= 0 || netFromTaxable < 0) return null;

  const destinations: Destination[] = (
    [
      { id: 'contributi', label: 'Contributi INPS', amount: contributions, tone: 'drain' },
      { id: 'irpef', label: 'IRPEF netta', amount: irpef, tone: 'drain' },
      { id: 'regionale', label: 'Addizionale regionale', amount: regional, tone: 'drain' },
      { id: 'comunale', label: 'Addizionale comunale', amount: municipal, tone: 'drain' },
      {
        id: 'netto',
        label: 'Netto in tasca',
        amount: netFromTaxable + extras,
        tone: 'keep',
      },
    ] satisfies Destination[]
  ).filter((d) => d.amount > 0.005);

  const total = gross + extras;
  const columnGaps = Math.max(0, destinations.length - 1);
  const scale = (VIEW_H - columnGaps * GAP) / total;

  const nodes: FlowNode[] = [];
  const push = (n: Omit<FlowNode, 'shareOfGross' | 'labelY'>) =>
    nodes.push({ ...n, shareOfGross: n.amount / gross, labelY: n.y + n.h / 2 });

  // Colonna 2 (destinazioni), centrata: e' la piu' alta e detta il ritmo verticale.
  const destinationsHeight =
    destinations.reduce((sum, d) => sum + d.amount * scale, 0) + columnGaps * GAP;
  let y = (VIEW_H - destinationsHeight) / 2;
  for (const d of destinations) {
    const h = d.amount * scale;
    push({ ...d, column: 2, x: COLUMN_X[2], y, h });
    y += h + GAP;
  }

  // Colonna 0: la RAL, e — solo se ci sono — le voci che entrano da fuori.
  const sourcesHeight = gross * scale + (extras > 0 ? GAP + extras * scale : 0);
  const sourcesTop = (VIEW_H - sourcesHeight) / 2;
  push({
    id: 'ral',
    label: 'Retribuzione annua lorda',
    amount: gross,
    tone: 'source',
    column: 0,
    x: COLUMN_X[0],
    y: sourcesTop,
    h: gross * scale,
  });
  if (extras > 0) {
    push({
      id: 'integrazioni',
      label: 'Trattamento integrativo e welfare',
      amount: extras,
      tone: 'keep',
      column: 0,
      x: COLUMN_X[0],
      y: sourcesTop + gross * scale + GAP,
      h: extras * scale,
    });
  }

  // Colonna 1: l'imponibile parte dove finisce la quota contributi, cosi' il nastro
  // dei contributi passa sopra il nodo invece di attraversarlo.
  push({
    id: 'imponibile',
    label: 'Imponibile fiscale',
    amount: taxable,
    tone: 'source',
    column: 1,
    x: COLUMN_X[1],
    y: sourcesTop + contributions * scale,
    h: taxable * scale,
  });

  spreadLabels(nodes.filter((n) => n.column === 2));

  const node = (id: string) => nodes.find((n) => n.id === id)!;
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();

  const connect = (id: string, from: string, to: string, amount: number, tone: Tone): FlowLink => {
    const a = outgoing.get(from) ?? 0;
    const b = incoming.get(to) ?? 0;
    outgoing.set(from, a + amount * scale);
    incoming.set(to, b + amount * scale);
    return {
      id,
      from,
      to,
      tone,
      sourceY: node(from).y + a,
      targetY: node(to).y + b,
      height: amount * scale,
    };
  };

  // L'ordine dei collegamenti segue l'ordine verticale dei nodi: nessun incrocio.
  const links: FlowLink[] = [];
  const has = (id: string) => nodes.some((n) => n.id === id);

  if (has('contributi'))
    links.push(connect('l-contributi', 'ral', 'contributi', contributions, 'drain'));
  links.push(connect('l-imponibile', 'ral', 'imponibile', taxable, 'source'));
  if (has('irpef')) links.push(connect('l-irpef', 'imponibile', 'irpef', irpef, 'drain'));
  if (has('regionale'))
    links.push(connect('l-regionale', 'imponibile', 'regionale', regional, 'drain'));
  if (has('comunale'))
    links.push(connect('l-comunale', 'imponibile', 'comunale', municipal, 'drain'));
  if (has('netto')) links.push(connect('l-netto', 'imponibile', 'netto', netFromTaxable, 'keep'));
  if (extras > 0 && has('netto'))
    links.push(connect('l-extra', 'integrazioni', 'netto', extras, 'keep'));

  /* Famiglia cromatica: un solo rosso che si schiarisce voce dopo voce, cosi' le
     trattenute restano distinguibili senza rompere la regola per cui il colore
     dice solo se il denaro resta o se ne va (docs/06 §6). */
  const drains = nodes.filter((n) => n.tone === 'drain');
  const colorOf = (id: string): string => {
    const found = nodes.find((n) => n.id === id);
    if (!found) return 'var(--text-muted)';
    if (found.tone === 'keep') return 'var(--positive)';
    if (found.tone === 'source') return 'var(--accent)';
    const index = Math.max(
      0,
      drains.findIndex((n) => n.id === id),
    );
    const strength = 100 - index * (48 / Math.max(1, drains.length - 1));
    return `color-mix(in oklch, var(--negative) ${strength}%, var(--surface-muted))`;
  };

  return { nodes, links, gross, colorOf };
}
