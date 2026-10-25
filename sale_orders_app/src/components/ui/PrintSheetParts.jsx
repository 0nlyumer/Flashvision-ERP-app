import React from 'react';
import { amountInWords, fmtQty, ensureContrastText, resolveBandTextColor, uomSymbol } from '../../utils/printDesign';

// ---------------------------------------------------------------------------
// Shared print sheet parts — the finalized print family (Meta-Grid header,
// accent title band, styled table, phase matrix). SINGLE source of truth
// for how a printed sheet looks: the Universal Print Studio renders its
// pages from these components, PrintLayout's slips mirror the same
// header, and the Print Settings & Layout Designer's WYSIWYG preview
// renders THESE components too (Omer, 2026-10-25 — the designer must
// show exactly the layout that prints, and customizations made there
// are the same saved layout the studio loads).
// ---------------------------------------------------------------------------

// Approved design tokens (from the signed-off samples)
export const DESIGN = {
  ink: '#1b1e2e',
  dark: '#232946',
  muted: '#71748c',
  line: '#dde0ea',
  zebra: '#f6f7fb',
  soft: '#eef0f8'
};

// ---------------------------------------------------------------------------
// Approved Meta-Grid sheet header: party | company/division | meta grid
// strip, with the accent title band under it. headerAlign left/center/
// right is a Print Settings option (Omer, 2026-10-24).
//
// Band text (Omer, 2026-10-25, rider 10 + band-title fix): the band's
// text color is resolved ONCE through the contrast guard and applied
// EXPLICITLY to the band container, the title and the doc sub — never
// left to inheritance — so a dark band can never render a dark title,
// whatever a saved layout carries in bandTextColor.
// ---------------------------------------------------------------------------
export function MetaGridHeader({ layout, companyName, companyLegal, companyAddress, party, metaRows, docTitle, docSub, planVariant, onSelectMeta = null, selectedMetaKey = null, onSelectParty = null, partySelected = false }) {
  const band = `linear-gradient(90deg, ${layout.bandColor || '#4338ca'}, ${layout.bandColor2 || layout.bandColor || '#4f46e5'})`;
  // Band text derives from the band colors alone (resolveBandTextColor) —
  // never from a stored bandTextColor — and is applied inline AND through
  // the .fv-bandtext CSS variable (index.css, !important), so no saved
  // layout or global rule can leave dark text on a dark band.
  const bandText = resolveBandTextColor(band);
  const align = layout.headerAlign || 'left';
  const accent = layout.bandColor || '#4338ca';

  const companyBlock = (centered = false) => (
    <div style={{ textAlign: centered ? 'center' : 'left' }}>
      <div style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase', marginBottom: '1.4mm' }}>
        {planVariant ? 'Division' : 'Company'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', justifyContent: centered ? 'center' : 'flex-start' }}>
        {planVariant && (
          <div style={{ width: '11mm', height: '9mm', border: '1.6px solid #232946', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11pt', color: '#232946', flexShrink: 0 }}>
            AJ
          </div>
        )}
        <div style={{ fontSize: '13.5pt', fontWeight: 800, letterSpacing: '.4px', lineHeight: 1.2, color: DESIGN.ink }}>{companyName}</div>
      </div>
      {planVariant && (
        <div style={{ fontSize: '8pt', color: DESIGN.muted, marginTop: '0.8mm' }}>Production &amp; Planning Division</div>
      )}
      {companyLegal && (
        <div style={{ fontSize: '7.5pt', color: DESIGN.muted, lineHeight: 1.45, marginTop: '1mm' }}>{companyLegal}</div>
      )}
      {!planVariant && layout.showHeaderDetails !== false && companyAddress && (
        <div style={{ fontSize: '7.5pt', color: DESIGN.muted, lineHeight: 1.45, marginTop: '1mm' }}>{companyAddress}</div>
      )}
    </div>
  );

  const bandEl = (
    <div
      style={{
        marginTop: '3mm', background: band, color: bandText, borderRadius: '6px',
        padding: '2.4mm 4.5mm', display: 'flex', justifyContent: align === 'center' ? 'center' : 'space-between',
        alignItems: 'center', gap: '4mm', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
        '--fv-bandtext': bandText
      }}
    >
      <div className="fv-bandtext" style={{ fontSize: '13pt', fontWeight: 700, letterSpacing: '3.5px', textAlign: align === 'center' ? 'center' : 'left', color: bandText }}>{docTitle}</div>
      {docSub && align !== 'center' && (
        <div className="fv-bandtext" style={{ fontSize: '7.5pt', fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', opacity: 0.9, color: bandText }}>{docSub}</div>
      )}
    </div>
  );

  // Meta grid strip (shared by the classic box and the graphic header
  // designs): label ABOVE the value, up to 4 fields per row; a long value
  // (address / contact) takes 2 columns when the field count leaves room.
  const metaSpanFor = (row) => {
    const isLong = /address|contact/i.test(row.label || '') || String(row.value || '').length > 34;
    return isLong && metaRows.length <= 7 ? 2 : 1;
  };
  const metaGrid = (withTopBorder) => (metaRows.length > 0 ? (
    <div
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        ...(withTopBorder ? { borderTop: `1px solid ${DESIGN.line}` } : {}), background: '#fbfcfe'
      }}
    >
      {metaRows.map((row, i) => (
        <div
          key={i}
          style={{ padding: '1.9mm 4mm 2.1mm', gridColumn: `span ${metaSpanFor(row)}`, minWidth: 0, ...(onSelectMeta ? { cursor: 'pointer', boxShadow: selectedMetaKey && row.key === selectedMetaKey ? 'inset 0 0 0 2px #3b82f6' : 'none' } : {}) }}
          onClick={onSelectMeta ? () => onSelectMeta(row, i) : undefined}
        >
          <div style={{ fontSize: '6.3pt', fontWeight: 700, letterSpacing: '1.2px', color: DESIGN.muted, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</div>
          <div style={{ fontSize: '9.3pt', fontWeight: row.strong ? 800 : 600, color: DESIGN.ink, lineHeight: 1.3, marginTop: '0.5mm', fontVariantNumeric: 'tabular-nums', overflowWrap: 'break-word' }}>{row.value}</div>
        </div>
      ))}
    </div>
  ) : null);

  // ------------------------------------------------------------------
  // Graphic header designs (Omer, 2026-10-25): opt-in per document via
  // layout.headerDesign. 'classic' (the default, and the fallback for
  // any unknown value) renders EXACTLY the header below — the graphic
  // branch only runs when a design was deliberately picked in Print
  // Settings. Every design takes its colors from the document's band
  // colors, anchors/mirrors with headerAlign, and renders the SAME
  // identity fields as classic (division/company eyebrow, company name,
  // division sub-line, legal name, address) plus the same party + meta
  // fields — compact and in-line per the standing print rules.
  // ------------------------------------------------------------------
  const design = ['ribbon', 'wave', 'sideblock', 'topstrip', 'frame', 'diagonal', 'ribbonfold', 'medallion', 'swoosh', 'watermark', 'premium', 'aurora', 'facet', 'cornerslash', 'arch', 'hexbadge', 'blueprint', 'crest', 'steps', 'duotone', 'pinstripe'].includes(layout.headerDesign) ? layout.headerDesign : 'classic';
  if (design !== 'classic') {
    const initials = String(companyName || 'F').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'F';
    const monogramText = planVariant ? 'AJ' : initials;
    const eyebrow = (color) => (
      <div style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color, textTransform: 'uppercase', marginBottom: '1.4mm' }}>
        {planVariant ? 'Division' : 'Company'}
      </div>
    );
    const identityLines = (mainColor, subColor) => (
      <>
        <div style={{ fontSize: '13.5pt', fontWeight: 800, letterSpacing: '.4px', lineHeight: 1.2, color: mainColor }}>{companyName}</div>
        {planVariant && (
          <div style={{ fontSize: '8pt', color: subColor, marginTop: '0.8mm' }}>Production &amp; Planning Division</div>
        )}
        {companyLegal && (
          <div style={{ fontSize: '7.5pt', color: subColor, lineHeight: 1.45, marginTop: '1mm' }}>{companyLegal}</div>
        )}
        {!planVariant && layout.showHeaderDetails !== false && companyAddress && (
          <div style={{ fontSize: '7.5pt', color: subColor, lineHeight: 1.45, marginTop: '1mm' }}>{companyAddress}</div>
        )}
      </>
    );
    const exact = { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' };

    // Round 5 shade helpers (stylish set): derive darker/lighter tints
    // from a layout color so folds, tails and the premium block skin
    // from the document's own band colors. Unparseable colors pass
    // through untouched.
    const rgbOf = (color) => {
      const m = String(color || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!m) return null;
      let h = m[1];
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const scaleRgb = (color, f) => {
      const rgb = rgbOf(color);
      return rgb ? `rgb(${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v * f)))).join(', ')})` : color;
    };
    const rgbaOf = (color, a) => {
      const rgb = rgbOf(color);
      return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : color;
    };
    // Round 6 helper: lerp a layout color toward a target hex (white
    // for glow/bright shades) so the premium set skins from band colors.
    const mixRgb = (color, targetHex, t) => {
      const a = rgbOf(color);
      const b = rgbOf(targetHex);
      return a && b ? `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})` : color;
    };
    const bandColor1 = layout.bandColor || '#4338ca';
    const bandColor2 = layout.bandColor2 || layout.bandColor || '#4f46e5';

    // Split identity lines for designs that carry the name in the shape
    // and the legal/address lines elsewhere (Ribbon Fold's sub-strip).
    const nameLine = (mainColor) => (
      <div style={{ fontSize: '13.5pt', fontWeight: 800, letterSpacing: '.4px', lineHeight: 1.2, color: mainColor }}>{companyName}</div>
    );
    const planSubLine = (subColor) => (planVariant ? (
      <div style={{ fontSize: '8pt', color: subColor, marginTop: '0.8mm' }}>Production &amp; Planning Division</div>
    ) : null);
    const legalLines = (subColor) => (
      <>
        {companyLegal && (
          <div style={{ fontSize: '7.5pt', color: subColor, lineHeight: 1.45 }}>{companyLegal}</div>
        )}
        {!planVariant && layout.showHeaderDetails !== false && companyAddress && (
          <div style={{ fontSize: '7.5pt', color: subColor, lineHeight: 1.45, marginTop: companyLegal ? '0.4mm' : 0 }}>{companyAddress}</div>
        )}
      </>
    );

    const ribbonBlock = (
      <div data-design-shape="ribbon" style={{ position: 'relative', background: band, borderRadius: '6px', overflow: 'hidden', padding: '3mm 4.5mm 3.4mm', ...exact }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: '18mm', background: layout.bandColor2 || layout.bandColor || '#4f46e5', opacity: 0.35, transform: align === 'right' ? 'skewX(18deg)' : 'skewX(-18deg)', ...(align === 'right' ? { left: '-7mm' } : { right: '-7mm' }), ...exact }} />
        <div style={{ position: 'relative', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.75)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.85)')}
        </div>
      </div>
    );

    const waveBlock = (
      <div data-design-shape="wave" style={{ position: 'relative', background: band, borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 6.5mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.75)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.85)')}
        </div>
        <svg data-design-shape="wave-svg" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 10" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '5mm', display: 'block', transform: align === 'right' ? 'scaleX(-1)' : 'none' }}>
          <path d="M0,5 C22,9.5 38,0.5 60,3 C78,5 90,7.5 100,4.5 L100,10 L0,10 Z" fill="#ffffff" opacity="0.3" />
          <path d="M0,7.5 C28,10.5 52,3.5 100,6.5 L100,10 L0,10 Z" fill="#ffffff" />
        </svg>
      </div>
    );

    const sideBlock = (
      <div style={{ display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row', border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div data-design-shape="sideblock" style={{ background: band, width: '27mm', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.2mm 2mm', ...exact }}>
          <div style={{ width: '11mm', height: '9mm', border: '1.6px solid rgba(255,255,255,0.92)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11pt', color: '#ffffff' }}>{monogramText}</div>
          <div style={{ fontSize: '6pt', fontWeight: 700, letterSpacing: '1.8px', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginTop: '1.4mm' }}>{planVariant ? 'Division' : 'Company'}</div>
        </div>
        <div style={{ flex: 1, padding: '3.2mm 4mm 3.4mm', textAlign: align === 'center' ? 'center' : 'left' }}>
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
      </div>
    );

    const topStripBlock = (
      <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div data-design-shape="topstrip" style={{ height: '2.4mm', background: band, ...exact }} />
        <div style={{ padding: '2.8mm 4mm 3.2mm', textAlign: align }}>
          {eyebrow(accent)}
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
      </div>
    );

    const frameBlock = (
      <div data-design-shape="frame" style={{ border: `2px solid ${accent}`, borderRadius: '4px', padding: '1.1mm', ...exact }}>
        <div style={{ border: `1px solid ${accent}`, borderRadius: '2px', padding: '2.6mm 4mm 3mm', textAlign: 'center' }}>
          {eyebrow(accent)}
          {identityLines(DESIGN.ink, DESIGN.muted)}
          <div style={{ height: '0.7mm', width: '38mm', maxWidth: '60%', background: band, margin: '2.2mm auto 0', ...exact }} />
        </div>
      </div>
    );

    // --------------------------------------------------------------
    // Round 5 — the STYLISH set (Omer, 2026-10-25: Round 3 read
    // "thoda classical zyada"; he wants proper graphics). Same rules
    // as Round 3: band-color skinned, alignment-mirrored, same
    // identity fields, compact, light text on dark shapes.
    // --------------------------------------------------------------

    // Diagonal Split — gradient panel with a skewed diagonal edge on
    // the aligned side carries the monogram; name + lines in ink on
    // white. The diagonal flips with alignment.
    const diagonalBlock = (
      <div style={{ position: 'relative', display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row', border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
        <div data-design-shape="diagonal" style={{ position: 'relative', background: band, width: '30mm', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.2mm 2mm', zIndex: 1, ...exact }}>
          <div style={{ width: '11mm', height: '9mm', border: '1.6px solid rgba(255,255,255,0.92)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11pt', color: '#ffffff' }}>{monogramText}</div>
          <div style={{ fontSize: '6pt', fontWeight: 700, letterSpacing: '1.8px', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginTop: '1.4mm' }}>{planVariant ? 'Division' : 'Company'}</div>
          <div data-design-shape="diagonal-edge" style={{ position: 'absolute', top: 0, bottom: 0, width: '7mm', background: band, ...(align === 'right' ? { left: '-3.4mm', transform: 'skewX(16deg)' } : { right: '-3.4mm', transform: 'skewX(-16deg)' }), ...exact }} />
        </div>
        <div style={{ flex: 1, padding: '3.2mm 4mm 3.4mm 7mm', textAlign: align }}>
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
      </div>
    );

    // Ribbon Fold — award ribbon: gradient ribbon with folded tails
    // (swallowtail clip) and darker fold triangles at both ends; the
    // name sits centered in white inside the ribbon, legal/address in
    // a slim sub-strip under it.
    const ribbonFoldBlock = (
      <div>
        <div style={{ position: 'relative', margin: '0 2.5mm' }}>
          <div data-design-shape="ribbonfold-tail" style={{ position: 'absolute', top: '2.6mm', bottom: '2.2mm', left: '-2.5mm', width: '7mm', background: scaleRgb(bandColor2, 0.68), clipPath: 'polygon(0 0, 100% 10%, 74% 50%, 100% 90%, 0 100%)', ...exact }} />
          <div data-design-shape="ribbonfold-tail" style={{ position: 'absolute', top: '2.6mm', bottom: '2.2mm', right: '-2.5mm', width: '7mm', background: scaleRgb(bandColor2, 0.68), clipPath: 'polygon(100% 0, 0 10%, 26% 50%, 0 90%, 100% 100%)', ...exact }} />
          <div data-design-shape="ribbonfold-fold" style={{ position: 'absolute', bottom: '-1.7mm', left: '0.4mm', width: '3.4mm', height: '3.4mm', background: scaleRgb(bandColor2, 0.5), clipPath: 'polygon(0 0, 100% 0, 0 100%)', ...exact }} />
          <div data-design-shape="ribbonfold-fold" style={{ position: 'absolute', bottom: '-1.7mm', right: '0.4mm', width: '3.4mm', height: '3.4mm', background: scaleRgb(bandColor2, 0.5), clipPath: 'polygon(0 0, 100% 0, 100% 100%)', ...exact }} />
          <div data-design-shape="ribbonfold" style={{ position: 'relative', background: band, borderRadius: '2px', padding: '3mm 4.5mm 3.4mm', textAlign: 'center', ...exact }}>
            {eyebrow('rgba(255,255,255,0.75)')}
            {nameLine('#ffffff')}
            {planSubLine('rgba(255,255,255,0.85)')}
          </div>
        </div>
        {(companyLegal || (!planVariant && layout.showHeaderDetails !== false && companyAddress)) && (
          <div style={{ marginTop: '2.4mm', background: DESIGN.soft, border: `1px solid ${DESIGN.line}`, borderRadius: '5px', padding: '1.6mm 4mm', textAlign: 'center' }}>
            {legalLines(DESIGN.muted)}
          </div>
        )}
      </div>
    );

    // Medallion — dark gradient band; a circular monogram medallion
    // straddles the band's bottom edge on the aligned side; name +
    // lines in white inside the band clear of the medallion.
    const medallionBlock = (
      <div style={{ position: 'relative', paddingBottom: '6.5mm' }}>
        <div data-design-shape="medallion-band" style={{ background: band, borderRadius: '6px', padding: '3mm 4.5mm 3.6mm', ...exact }}>
          <div style={{ textAlign: align, ...(align === 'right' ? { paddingRight: '15mm' } : { paddingLeft: '15mm' }) }}>
            {eyebrow('rgba(255,255,255,0.75)')}
            {identityLines('#ffffff', 'rgba(255,255,255,0.85)')}
          </div>
        </div>
        <div data-design-shape="medallion" style={{ position: 'absolute', bottom: '0.2mm', width: '13mm', height: '13mm', borderRadius: '50%', background: band, border: '2.2px solid #ffffff', boxShadow: `0 0 0 1.6px ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11.5pt', color: '#ffffff', ...(align === 'right' ? { right: '6mm' } : { left: '6mm' }), ...exact }}>{monogramText}</div>
      </div>
    );

    // Double Swoosh — full gradient base with two layered translucent
    // SVG swooshes sweeping across; name in white over them. The
    // swooshes mirror with right alignment.
    const swooshBlock = (
      <div data-design-shape="swoosh" style={{ position: 'relative', background: band, borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <svg data-design-shape="swoosh-svg" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 24" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', transform: align === 'right' ? 'scaleX(-1)' : 'none' }}>
          <path d="M0,17 C26,7 52,21 100,8 L100,0 L0,0 Z" fill="#ffffff" opacity="0.15" />
          <path d="M0,21.5 C32,12 60,24 100,14" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.5" />
          <path d="M0,4.5 C30,-1 66,8.5 100,2.5 L100,0 L0,0 Z" fill={bandColor2} opacity="0.4" />
        </svg>
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 3.4mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.78)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.88)')}
        </div>
      </div>
    );

    // Watermark — clean white header: huge faint monogram initial
    // clipped at the aligned edge + name in ink + a thick gradient
    // rule under the identity block. Modern minimal.
    const watermarkBlock = (
      <div data-design-shape="watermark" style={{ position: 'relative', border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden', background: '#ffffff', padding: '3mm 4mm 0' }}>
        <div data-design-shape="watermark-mark" aria-hidden="true" style={{ position: 'absolute', top: '-7mm', fontSize: '46pt', fontWeight: 900, lineHeight: 0.8, color: rgbaOf(bandColor1, 0.09), ...(align === 'right' ? { right: '-1mm' } : { left: '-1mm' }), ...exact }}>{monogramText}</div>
        <div style={{ position: 'relative', textAlign: align }}>
          {eyebrow(accent)}
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
        <div data-design-shape="watermark-rule" style={{ height: '1.6mm', background: band, margin: '2.6mm -4mm 0', ...exact }} />
      </div>
    );

    // Premium Dark — near-black block derived from the darkest band
    // shade, gold-outline monogram box, name in white, thin metallic
    // gold accent line (the signature — stays gold at any band color),
    // legal/address in light grey.
    const GOLD = '#c9a227';
    const premiumBlock = (
      <div data-design-shape="premium" style={{ background: `linear-gradient(90deg, ${scaleRgb(bandColor1, 0.3)}, ${scaleRgb(bandColor2, 0.38)})`, borderRadius: '6px', padding: '3.2mm 4.5mm 3.6mm', display: 'flex', flexDirection: align === 'center' ? 'column' : align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: '3.6mm', ...exact }}>
        <div data-design-shape="premium-mono" style={{ width: '12mm', height: '10mm', border: `1.4px solid ${GOLD}`, borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11.5pt', color: GOLD, flexShrink: 0, ...exact }}>{monogramText}</div>
        <div style={{ flex: 1, textAlign: align }}>
          {eyebrow(GOLD)}
          {nameLine('#ffffff')}
          {planSubLine('rgba(255,255,255,0.66)')}
          <div data-design-shape="premium-rule" style={{ height: '0.55mm', width: '36mm', maxWidth: '70%', background: `linear-gradient(90deg, ${GOLD}, #e8cf6a)`, marginTop: '1.7mm', ...(align === 'center' ? { marginLeft: 'auto', marginRight: 'auto' } : align === 'right' ? { marginLeft: 'auto' } : {}), ...exact }} />
          <div style={{ marginTop: '1.4mm' }}>{legalLines('rgba(255,255,255,0.66)')}</div>
        </div>
      </div>
    );

    // --------------------------------------------------------------
    // Round 6 — TOP TEN premium set (Omer, 2026-10-25): shortlisted
    // from web research over premium invoice/letterhead headers.
    // Same rules as Rounds 3/5: band-color skinned, alignment
    // mirrored/anchored, same identity fields, compact, light text
    // on dark shapes.
    // --------------------------------------------------------------

    // Aurora Gradient — band gradient with 2–3 large soft translucent
    // glow blobs (lightened band shades) drifting across; name white.
    const auroraBlock = (
      <div data-design-shape="aurora" style={{ position: 'relative', background: `linear-gradient(115deg, ${bandColor1}, ${bandColor2})`, borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <div data-design-shape="aurora-blob" style={{ position: 'absolute', top: '-16mm', width: '38mm', height: '38mm', borderRadius: '50%', background: `radial-gradient(circle at center, ${rgbaOf(mixRgb(bandColor2, '#ffffff', 0.55), 0.55)}, transparent 70%)`, ...(align === 'right' ? { right: '16mm' } : { left: '16mm' }), ...exact }} />
        <div data-design-shape="aurora-blob" style={{ position: 'absolute', bottom: '-18mm', width: '30mm', height: '30mm', borderRadius: '50%', background: `radial-gradient(circle at center, ${rgbaOf(mixRgb(bandColor1, '#ffffff', 0.5), 0.5)}, transparent 70%)`, ...(align === 'right' ? { left: '30mm' } : { right: '30mm' }), ...exact }} />
        <div data-design-shape="aurora-blob" style={{ position: 'absolute', top: '-10mm', width: '20mm', height: '20mm', borderRadius: '50%', background: `radial-gradient(circle at center, ${rgbaOf(mixRgb(bandColor1, '#ffffff', 0.75), 0.45)}, transparent 70%)`, ...(align === 'right' ? { left: '-4mm' } : { right: '-4mm' }), ...exact }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 3.4mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.78)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.88)')}
        </div>
      </div>
    );

    // Geometric Facet — band filled with low-poly triangular facets
    // (SVG polygons in band shades); name white on top.
    const facetBlock = (
      <div data-design-shape="facet" style={{ position: 'relative', background: bandColor1, borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <svg data-design-shape="facet-svg" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 24" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', transform: align === 'right' ? 'scaleX(-1)' : 'none' }}>
          <polygon points="0,0 26,0 12,13" fill={scaleRgb(bandColor1, 0.78)} />
          <polygon points="26,0 52,0 38,11 12,13" fill={mixRgb(bandColor1, '#ffffff', 0.14)} />
          <polygon points="52,0 78,0 64,13 38,11" fill={bandColor2} />
          <polygon points="78,0 100,0 100,12 64,13" fill={scaleRgb(bandColor2, 0.8)} />
          <polygon points="0,0 12,13 0,24" fill={mixRgb(bandColor2, '#ffffff', 0.1)} />
          <polygon points="12,13 38,11 30,24 0,24" fill={scaleRgb(bandColor1, 0.62)} />
          <polygon points="38,11 64,13 56,24 30,24" fill={mixRgb(bandColor1, '#ffffff', 0.22)} />
          <polygon points="64,13 100,12 100,24 56,24" fill={scaleRgb(bandColor2, 0.66)} />
        </svg>
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 3.4mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.78)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.88)')}
        </div>
      </div>
    );

    // Corner Slash — white header; a bold band-gradient diagonal
    // slash block in the aligned top corner + a second smaller slash
    // + a gradient rule under the ink identity.
    const cornerSlashBlock = (
      <div style={{ position: 'relative', border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden', background: '#ffffff', padding: '3mm 4mm 0' }}>
        <div data-design-shape="cornerslash" style={{ position: 'absolute', top: 0, bottom: 0, width: '26mm', background: band, ...(align === 'right' ? { right: '-6mm', transform: 'skewX(16deg)' } : { left: '-6mm', transform: 'skewX(-16deg)' }), ...exact }} />
        <div data-design-shape="cornerslash-2" style={{ position: 'absolute', top: 0, bottom: 0, width: '2.6mm', background: scaleRgb(bandColor2, 0.62), ...(align === 'right' ? { right: '17.5mm', transform: 'skewX(16deg)' } : { left: '17.5mm', transform: 'skewX(-16deg)' }), ...exact }} />
        <div style={{ position: 'relative', textAlign: align, ...(align === 'right' ? { paddingRight: '27mm' } : { paddingLeft: '27mm' }) }}>
          {eyebrow(accent)}
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
        <div data-design-shape="cornerslash-rule" style={{ height: '1.4mm', background: band, margin: '2.6mm -4mm 0', ...exact }} />
      </div>
    );

    // Modern Arch — an arch-topped gradient panel holding the
    // identity, anchored per alignment, with an inner arch outline.
    const archBlock = (
      <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
        <div data-design-shape="arch" style={{ background: band, borderTopLeftRadius: '24mm', borderTopRightRadius: '24mm', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', padding: '1.6mm', width: '76%', maxWidth: '150mm', ...exact }}>
          <div data-design-shape="arch-ring" style={{ border: '1px solid rgba(255,255,255,0.55)', borderTopLeftRadius: '22mm', borderTopRightRadius: '22mm', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', padding: '3.4mm 4mm 3mm', textAlign: 'center' }}>
            {eyebrow('rgba(255,255,255,0.78)')}
            {identityLines('#ffffff', 'rgba(255,255,255,0.88)')}
          </div>
        </div>
      </div>
    );

    // Hexagon Badge — band whose far end is cut at an angle, with a
    // hexagonal monogram badge (white outer ring, gradient inner) on
    // the aligned side.
    const hexBadgeBlock = (
      <div data-design-shape="hexbadge-band" style={{ background: band, padding: '3mm 4.5mm 3.4mm', display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: '3.6mm', clipPath: align === 'right' ? 'polygon(3% 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 97% 100%, 0 100%)', ...exact }}>
        <div data-design-shape="hexbadge" style={{ position: 'relative', width: '13.5mm', height: '12.5mm', flexShrink: 0, background: '#ffffff', clipPath: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', ...exact }}>
          <div data-design-shape="hexbadge-inner" style={{ position: 'absolute', inset: '1.1mm', background: band, clipPath: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10.5pt', color: '#ffffff', ...exact }}>{monogramText}</div>
        </div>
        <div style={{ flex: 1, textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.78)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.88)')}
        </div>
      </div>
    );

    // Blueprint — deep darkest-band block with a fine light grid and
    // crosshair plus marks in the corners; technical feel, name white.
    const blueprintBlock = (
      <div data-design-shape="blueprint" style={{ position: 'relative', background: scaleRgb(bandColor1, 0.32), borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <div data-design-shape="blueprint-grid" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.13) 1px, transparent 1px)', backgroundSize: '6mm 6mm', ...exact }} />
        <div data-design-shape="blueprint-cross" aria-hidden="true" style={{ position: 'absolute', top: '1mm', fontSize: '10pt', fontWeight: 700, color: 'rgba(255,255,255,0.55)', lineHeight: 1, ...(align === 'right' ? { left: '2.4mm' } : { right: '2.4mm' }) }}>+</div>
        <div data-design-shape="blueprint-cross" aria-hidden="true" style={{ position: 'absolute', bottom: '1.2mm', fontSize: '10pt', fontWeight: 700, color: 'rgba(255,255,255,0.55)', lineHeight: 1, ...(align === 'right' ? { right: '2.4mm' } : { left: '2.4mm' }) }}>+</div>
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 3.4mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.72)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.85)')}
        </div>
      </div>
    );

    // Executive Crest — shield monogram flanked by ornamental double
    // rules with diamond centers; the crest group anchors per
    // alignment and the identity sits under it in ink.
    const crestRule = (
      <>
        <div data-design-shape="crest-rule" style={{ width: '17mm', height: '1.7mm', borderTop: `0.55mm solid ${accent}`, borderBottom: `0.55mm solid ${accent}`, flexShrink: 0, ...exact }} />
        <div data-design-shape="crest-diamond" style={{ width: '2.2mm', height: '2.2mm', background: accent, transform: 'rotate(45deg)', flexShrink: 0, ...exact }} />
        <div data-design-shape="crest-rule" style={{ width: '17mm', height: '1.7mm', borderTop: `0.55mm solid ${accent}`, borderBottom: `0.55mm solid ${accent}`, flexShrink: 0, ...exact }} />
      </>
    );
    const crestBlock = (
      <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', padding: '3mm 4mm 3.4mm', display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
        {eyebrow(accent)}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.2mm', marginBottom: '2mm' }}>
          {crestRule}
          <svg data-design-shape="crest-shield" aria-hidden="true" viewBox="0 0 24 28" style={{ width: '10mm', height: '11.7mm', display: 'block', flexShrink: 0 }}>
            <path d="M12 1 L21 4 V13 C21 20.2 17.2 24.6 12 27 C6.8 24.6 3 20.2 3 13 V4 Z" fill={bandColor1} stroke={mixRgb(bandColor1, '#ffffff', 0.35)} strokeWidth="1" />
            <text x="12" y="16.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff">{monogramText}</text>
          </svg>
          {crestRule}
        </div>
        <div style={{ textAlign: align }}>
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
      </div>
    );

    // Stacked Steps — three offset stacked rectangles in band shades
    // ascending behind the monogram box; identity in ink beside it.
    const stepsBlock = (
      <div style={{ display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: '5mm', border: `1px solid ${DESIGN.line}`, borderRadius: '8px', padding: '3.4mm 4.5mm 3.6mm' }}>
        <div style={{ position: 'relative', width: '15mm', height: '13mm', flexShrink: 0 }}>
          <div data-design-shape="steps" style={{ position: 'absolute', width: '11.5mm', height: '10mm', background: scaleRgb(bandColor1, 0.55), borderRadius: '3px', ...(align === 'right' ? { right: 0, bottom: 0 } : { left: 0, bottom: 0 }), ...exact }} />
          <div data-design-shape="steps" style={{ position: 'absolute', width: '11.5mm', height: '10mm', background: scaleRgb(bandColor2, 0.8), borderRadius: '3px', ...(align === 'right' ? { right: '1.7mm', bottom: '1.5mm' } : { left: '1.7mm', bottom: '1.5mm' }), ...exact }} />
          <div data-design-shape="steps" style={{ position: 'absolute', width: '11.5mm', height: '10mm', background: band, borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11pt', color: '#ffffff', ...(align === 'right' ? { right: '3.4mm', bottom: '3mm' } : { left: '3.4mm', bottom: '3mm' }), ...exact }}>{monogramText}</div>
        </div>
        <div style={{ flex: 1, textAlign: align }}>
          {eyebrow(accent)}
          {identityLines(DESIGN.ink, DESIGN.muted)}
        </div>
      </div>
    );

    // Duotone Split — band split horizontally: upper 62% darkest band
    // shade, lower 38% brightest; the name straddles the split line.
    const duotoneBlock = (
      <div data-design-shape="duotone" style={{ position: 'relative', background: `linear-gradient(180deg, ${scaleRgb(bandColor1, 0.42)} 0%, ${scaleRgb(bandColor1, 0.42)} 62%, ${mixRgb(bandColor2, '#ffffff', 0.18)} 62%, ${mixRgb(bandColor2, '#ffffff', 0.18)} 100%)`, borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <div data-design-shape="duotone-line" style={{ position: 'absolute', left: 0, right: 0, top: '62%', height: '0.6mm', background: 'rgba(255,255,255,0.4)', ...exact }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 3.4mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.75)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.92)')}
        </div>
      </div>
    );

    // Pinstripe Edge — gradient band whose aligned side carries thin
    // diagonal pinstripes (translucent white) fading toward the
    // center; name white over the band.
    const pinstripeBlock = (
      <div data-design-shape="pinstripe" style={{ position: 'relative', background: band, borderRadius: '6px', overflow: 'hidden', ...exact }}>
        <div data-design-shape="pinstripe-stripes" style={{ position: 'absolute', top: 0, bottom: 0, width: '46%', backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.22) 0, rgba(255,255,255,0.22) 1.1mm, transparent 1.1mm, transparent 3.1mm)', ...(align === 'right' ? { right: 0, WebkitMaskImage: 'linear-gradient(270deg, black 55%, transparent)', maskImage: 'linear-gradient(270deg, black 55%, transparent)' } : { left: 0, WebkitMaskImage: 'linear-gradient(90deg, black 55%, transparent)', maskImage: 'linear-gradient(90deg, black 55%, transparent)' }), ...exact }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '3mm 4.5mm 3.4mm', textAlign: align }}>
          {eyebrow('rgba(255,255,255,0.78)')}
          {identityLines('#ffffff', 'rgba(255,255,255,0.88)')}
        </div>
      </div>
    );

    const graphicBlock = design === 'ribbon' ? ribbonBlock
      : design === 'wave' ? waveBlock
      : design === 'sideblock' ? sideBlock
      : design === 'topstrip' ? topStripBlock
      : design === 'diagonal' ? diagonalBlock
      : design === 'ribbonfold' ? ribbonFoldBlock
      : design === 'medallion' ? medallionBlock
      : design === 'swoosh' ? swooshBlock
      : design === 'watermark' ? watermarkBlock
      : design === 'premium' ? premiumBlock
      : design === 'aurora' ? auroraBlock
      : design === 'facet' ? facetBlock
      : design === 'cornerslash' ? cornerSlashBlock
      : design === 'arch' ? archBlock
      : design === 'hexbadge' ? hexBadgeBlock
      : design === 'blueprint' ? blueprintBlock
      : design === 'crest' ? crestBlock
      : design === 'steps' ? stepsBlock
      : design === 'duotone' ? duotoneBlock
      : design === 'pinstripe' ? pinstripeBlock
      : frameBlock;

    const partyStrip = party ? (
      <div
        onClick={onSelectParty || undefined}
        style={{ marginTop: '2mm', background: DESIGN.soft, border: `1px solid ${DESIGN.line}`, borderRadius: '6px', padding: '1.8mm 4mm', display: 'flex', gap: '3mm', alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', ...(onSelectParty ? { cursor: 'pointer', boxShadow: partySelected ? 'inset 0 0 0 2px #3b82f6' : 'none' } : {}) }}
      >
        <span style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase' }}>{party.label}</span>
        <span style={{ fontSize: '11.5pt', fontWeight: 700, lineHeight: 1.25, color: DESIGN.ink }}>{party.value}</span>
      </div>
    ) : null;

    return (
      <>
        <div data-header-design={design}>
          {graphicBlock}
          {partyStrip}
          {metaRows.length > 0 && (
            <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden', marginTop: '2mm' }}>
              {metaGrid(false)}
            </div>
          )}
        </div>
        {bandEl}
      </>
    );
  }

  if (align === 'center') {
    return (
      <>
        <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', padding: '3mm 4mm', textAlign: 'center' }}>
          {companyBlock(true)}
          {party && (
            <div
              style={{ marginTop: '2mm', fontSize: '10pt', fontWeight: 700, color: DESIGN.ink, ...(onSelectParty ? { cursor: 'pointer', boxShadow: partySelected ? 'inset 0 0 0 2px #3b82f6' : 'none', borderRadius: '4px' } : {}) }}
              onClick={onSelectParty || undefined}
            >
              <span style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase', display: 'block' }}>{party.label}</span>
              {party.value}
            </div>
          )}
          {metaRows.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1mm 6mm', marginTop: '2mm' }}>
              {metaRows.map((row, i) => (
                <span
                  key={i}
                  style={{ fontSize: '8.5pt', color: DESIGN.ink, ...(onSelectMeta ? { cursor: 'pointer', boxShadow: selectedMetaKey && row.key === selectedMetaKey ? 'inset 0 0 0 2px #3b82f6' : 'none', borderRadius: '4px', padding: '0 2px' } : {}) }}
                  onClick={onSelectMeta ? () => onSelectMeta(row, i) : undefined}
                >
                  <span style={{ fontSize: '7pt', fontWeight: 600, letterSpacing: '1px', color: DESIGN.muted, textTransform: 'uppercase' }}>{row.label}: </span>
                  <strong>{row.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
        {bandEl}
      </>
    );
  }

  // Meta fields: full-width compact grid strip UNDER the party/company
  // row, inside the same bordered box (Omer, 2026-10-25 — the old 33%
  // side rail crushed 8 Sale Order fields into per-word wraps and ate
  // ~40% of the page). The grid itself is the shared metaGrid above.
  return (
    <>
      <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          {party && (
            <div
              style={{ width: '38%', padding: '3.2mm 4mm 3.4mm', ...(onSelectParty ? { cursor: 'pointer', boxShadow: partySelected ? 'inset 0 0 0 2px #3b82f6' : 'none' } : {}) }}
              onClick={onSelectParty || undefined}
            >
              <div style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase', marginBottom: '1.4mm' }}>{party.label}</div>
              <div style={{ fontSize: '12.5pt', fontWeight: 700, lineHeight: 1.25, color: DESIGN.ink }}>{party.value}</div>
            </div>
          )}
          <div style={{ flex: 1, padding: '3.2mm 4mm 3.4mm', borderLeft: party ? `1px solid ${DESIGN.line}` : 'none' }}>
            {companyBlock(!party)}
          </div>
        </div>
        {metaGrid(true)}
      </div>
      {bandEl}
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase-Matrix sheet (BOM / Consumption): slim header + title band, then
// item sections whose phase panels flow side-by-side and wrap to the next
// panel row (phasesPerRow, default 4) — never squeezed. Phase totals live
// inside the panels; there is deliberately NO category grand total.
// Quantities carry ONLY the unit symbol (uomSymbol — Omer, 2026-10-25).
// ---------------------------------------------------------------------------
export function PhaseMatrixSheet({ record, layout, companyName, companyLegal, margins, paperWidth, paperHeight, pageIdx = 0, pageCount = 1 }) {
  const perRow = Math.max(2, Math.min(6, Number(layout.phasesPerRow) || 4));
  const gapMm = 3.5;
  const basis = `calc((100% - ${(perRow - 1) * gapMm}mm) / ${perRow})`;
  const align = layout.headerAlign || 'left';

  return (
    <div
      data-contrast-ignore
      className="bg-white text-slate-900 shadow-2xl relative print-preview-page"
      style={{
        width: paperWidth,
        minHeight: paperHeight,
        maxWidth: paperWidth,
        fontFamily: layout.fontFamily || 'Inter',
        padding: `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}`,
        color: DESIGN.ink,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="no-print absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
        Page {pageIdx + 1} of {pageCount}
      </div>

      <MetaGridHeader
        layout={layout}
        companyName={companyName}
        companyLegal={companyLegal}
        companyAddress=""
        party={null}
        metaRows={(record.metaRows || []).map((r) => ({ label: r.key, value: r.value, strong: r.key.toLowerCase().includes('id') }))}
        docTitle={record.docTitle}
        docSub={record.docSub}
      />

      {(record.sections || []).map((section, sIdx) => (
        <div key={sIdx} style={{ marginTop: sIdx === 0 ? '1mm' : '3mm' }}>
          {section.name && (
            <div
              style={{
                marginTop: '2mm', background: DESIGN.soft, border: `1px solid ${DESIGN.line}`,
                borderLeft: `3.5px solid ${layout.bandColor || '#4f46e5'}`, borderRadius: '6px',
                padding: '1.3mm 4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
              }}
            >
              <div style={{ fontSize: '9.5pt', fontWeight: 800, letterSpacing: '.4px' }}>
                {section.code && <span style={{ color: layout.bandColor2 || '#4338ca' }}>{section.code} · </span>}
                {section.name}
              </div>
              {section.qtyLabel && (
                <div style={{ fontSize: '8.5pt', fontWeight: 700, color: '#3c4060', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{section.qtyLabel}</div>
              )}
            </div>
          )}

          <div
            style={{
              display: 'flex', gap: `${gapMm}mm`, flexWrap: 'wrap', marginTop: '2.5mm',
              alignItems: layout.phaseRowHeight === 'equal' ? 'stretch' : 'flex-start'
            }}
          >
            {(section.phases || []).map((phase, pIdx) => (
              <div
                key={pIdx}
                style={{
                  flex: `0 0 ${basis}`, border: `1px solid ${DESIGN.line}`, borderRadius: '8px',
                  overflow: 'hidden', breakInside: 'avoid', pageBreakInside: 'avoid',
                  display: 'flex', flexDirection: 'column'
                }}
              >
                <div style={{ background: layout.tableHeaderBgColor || DESIGN.dark, color: ensureContrastText(layout.tableHeaderBgColor || DESIGN.dark, layout.tableHeaderTextColor || '#fff'), padding: '1.8mm 3mm 2mm', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                  <div style={{ fontSize: '6.3pt', fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', opacity: 0.75 }}>
                    Phase {pIdx + 1}
                  </div>
                  <div style={{ fontSize: '9.5pt', fontWeight: 700, lineHeight: 1.25, marginTop: '.4mm' }}>{phase.name}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ background: DESIGN.soft, color: '#3c4060', fontSize: '6.8pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '1.4mm 3mm', textAlign: 'left' }}>Raw Material</th>
                      <th style={{ background: DESIGN.soft, color: '#3c4060', fontSize: '6.8pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '1.4mm 3mm', textAlign: 'right', whiteSpace: 'nowrap' }}>{record.qtyColumnLabel || 'Qty'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(phase.rows || []).map((row, rIdx) => (
                      <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? DESIGN.zebra : '#fff' }}>
                        <td style={{ fontSize: '8.6pt', fontWeight: 600, padding: '1.3mm 3mm', borderTop: `1px solid ${DESIGN.line}`, verticalAlign: 'middle' }}>{row.name}</td>
                        <td style={{ fontSize: '8.6pt', padding: '1.3mm 3mm', borderTop: `1px solid ${DESIGN.line}`, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtQty(row.qty)} {uomSymbol(row.uom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {layout.showPhaseTotals !== false && (phase.totals || []).length > 0 && (
                    <tfoot>
                      <tr>
                        <td style={{ fontSize: '8.6pt', fontWeight: 700, padding: '1.4mm 3mm', borderTop: `2px solid ${layout.tableHeaderBgColor || DESIGN.dark}`, background: DESIGN.soft }}>Phase Total</td>
                        <td style={{ fontSize: '8.6pt', fontWeight: 700, padding: '1.4mm 3mm', borderTop: `2px solid ${layout.tableHeaderBgColor || DESIGN.dark}`, background: DESIGN.soft, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {phase.totals.map((t) => `${fmtQty(t.qty)} ${uomSymbol(t.uom)}`).join(' · ')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ))}
            {(section.phases || []).length === 0 && (
              <p style={{ fontSize: '9pt', color: DESIGN.muted, fontStyle: 'italic', padding: '2mm 0' }}>No phase data recorded for this item.</p>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: '6mm', textAlign: align === 'left' ? 'center' : align, fontSize: '7pt', letterSpacing: '1.2px', color: '#a2a6ba', textTransform: 'uppercase' }}>
        Powered by Flashvision
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta-Grid table sheet — ONE page of a table document in the finalized
// family. The studio paginates and renders one of these per page; the
// Print Settings designer renders a single one holding every sample row.
// Cell values come from the caller's getCellValue(colKey, row, index).
// Optional designer callbacks (onSelectColumn / onSelectMeta /
// onSelectParty / onSelectSignature) make canvas elements clickable for
// the Inspector; the studio passes none.
// ---------------------------------------------------------------------------
export function PrintTableSheet({
  layout, companyName, companyLegal, companyAddress, party, metaRows,
  docTitle, docSub, planVariant = false,
  columns, items, getCellValue, startItemNo = 0, columnTotals = {},
  grandTotal, showHeader = true, showTotals = true, isLastPage = true,
  pageLabel = null, footerPageText = null,
  margins, paperWidth, paperHeight, fixedHeight = true, fitScale = 1,
  pageRef = null,
  onSelectColumn = null, selectedColumnKey = null,
  onSelectMeta = null, selectedMetaKey = null, onSelectParty = null, partySelected = false,
  onSelectSignature = null, selectedSignatureKey = null
}) {
  const totalsBarBg = layout.goldenTotalRow ? '#fbbf24' : (layout.totalsColor || '#232946');
  const totalsBarText = layout.goldenTotalRow ? '#232946' : ensureContrastText(totalsBarBg, '#ffffff');
  let runningItems = startItemNo;

  return (
    <div
      ref={pageRef || undefined}
      data-contrast-ignore
      className="bg-white text-slate-900 shadow-2xl relative print-preview-page"
      style={{
        width: paperWidth,
        height: fixedHeight ? paperHeight : 'auto',
        minHeight: paperHeight,
        maxWidth: paperWidth,
        fontFamily: layout.fontFamily || 'Inter',
        padding: `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}`,
        color: DESIGN.ink,
        display: 'flex',
        flexDirection: 'column',
        overflow: fixedHeight ? 'hidden' : 'visible'
      }}
    >
      {pageLabel && (
        <div className="no-print absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
          {pageLabel}
        </div>
      )}
      <div data-fit-content style={{ transform: fitScale !== 1 ? `scale(${fitScale})` : undefined, transformOrigin: 'top left', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {showHeader && (
          <MetaGridHeader
            layout={layout}
            companyName={companyName}
            companyLegal={companyLegal}
            companyAddress={companyAddress}
            party={party}
            metaRows={metaRows}
            docTitle={docTitle}
            docSub={docSub}
            planVariant={planVariant}
            onSelectMeta={onSelectMeta}
            selectedMetaKey={selectedMetaKey}
            onSelectParty={onSelectParty}
            partySelected={partySelected}
          />
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3mm' }}>
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  onClick={onSelectColumn ? () => onSelectColumn(col, ci) : undefined}
                  style={{ background: layout.tableHeaderBgColor || DESIGN.dark, color: ensureContrastText(layout.tableHeaderBgColor || DESIGN.dark, layout.tableHeaderTextColor || '#fff'), fontSize: '7pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '2mm 2.5mm', textAlign: col.align || 'left', width: col.width, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', ...(onSelectColumn ? { cursor: 'pointer', boxShadow: selectedColumnKey && col.key === selectedColumnKey ? 'inset 0 0 0 2px #facc15' : 'none' } : {}) }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, rIdx) => {
              if (row._isGroup) {
                return (
                  <tr key={rIdx}>
                    <td colSpan={Math.max(1, columns.length)} style={{ background: DESIGN.soft, borderTop: `1px solid ${DESIGN.line}`, borderBottom: `1px solid ${DESIGN.line}`, padding: '1.8mm 3mm', fontSize: '8.6pt', fontWeight: 800, color: DESIGN.ink }}>
                      {row._group}
                      <span style={{ fontWeight: 600, color: DESIGN.muted, marginLeft: '3mm' }}>
                        {row._count} order{row._count === 1 ? '' : 's'}
                        {columns.filter((c) => c.total).map((c) => ` · ${c.label}: ${Number(row._sums[c.key] || 0).toLocaleString()}`).join('')}
                      </span>
                    </td>
                  </tr>
                );
              }
              runningItems += 1;
              const itemNo = runningItems;
              return (
                <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? DESIGN.zebra : '#fff' }}>
                  {columns.map((col, ci) => {
                    let val;
                    if (['serial_no', 'sr', 'sr_no'].includes(col.key) && (row[col.key] === undefined || row[col.key] === null)) {
                      val = String(itemNo).padStart(2, '0');
                    } else {
                      val = getCellValue(col.key, row, itemNo - 1);
                    }
                    return (
                      <td key={ci} style={{ fontSize: '8.8pt', padding: '1.6mm 2.5mm', borderTop: `1px solid ${DESIGN.line}`, textAlign: col.align || 'left', fontVariantNumeric: 'tabular-nums', fontWeight: col.total ? 700 : 400 }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={Math.max(1, columns.length)} style={{ padding: '4mm', textAlign: 'center', color: DESIGN.muted, fontStyle: 'italic', fontSize: '9pt' }}>No rows to display.</td></tr>
            )}
          </tbody>
          {showTotals && columns.some((c) => c.total) && (
            <tfoot>
              <tr>
                {columns.map((col, ci) => (
                  <td key={ci} style={{ background: totalsBarBg, color: totalsBarText, fontSize: '9pt', fontWeight: 800, padding: '2.2mm 2.5mm', borderTop: `2px solid ${totalsBarBg}`, textAlign: col.align || 'left', fontVariantNumeric: 'tabular-nums', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                    {col.total ? Number(columnTotals[col.key] || 0).toLocaleString() : (ci === 0 ? 'TOTAL' : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>

        {showTotals && grandTotal !== undefined && grandTotal !== null && (
          <div style={{ marginTop: '2.5mm', border: `1px solid ${DESIGN.line}`, borderRadius: '6px', padding: '2.2mm 4mm', display: 'flex', justifyContent: 'space-between', gap: '4mm', background: '#fff' }}>
            <span style={{ fontSize: '8.5pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: DESIGN.muted }}>Amount in Words</span>
            <span style={{ fontSize: '9.5pt', fontWeight: 700, textAlign: 'right' }}>Rupees {amountInWords(grandTotal)} Only</span>
          </div>
        )}

        {isLastPage && layout.termsConditions && (
          <div style={{ marginTop: '3mm', fontSize: '8pt', color: DESIGN.muted, lineHeight: 1.5 }}>
            <strong>Terms &amp; Conditions: </strong>{layout.termsConditions}
          </div>
        )}

        {isLastPage && (layout.signatures || []).length > 0 && (
          <div style={{ display: 'flex', gap: '8mm', marginTop: '8mm' }}>
            {(layout.signatures || []).map((sig, si) => (
              <div
                key={si}
                style={{ flex: 1, textAlign: 'center', ...(onSelectSignature ? { cursor: 'pointer', boxShadow: selectedSignatureKey && (sig.key || sig.label) === selectedSignatureKey ? 'inset 0 0 0 2px #3b82f6' : 'none', borderRadius: '4px' } : {}) }}
                onClick={onSelectSignature ? () => onSelectSignature(sig, si) : undefined}
              >
                <div style={{ borderTop: `1.5px solid ${DESIGN.ink}`, paddingTop: '1.5mm', fontSize: '8.5pt', fontWeight: 700 }}>{sig.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '7pt', letterSpacing: '1.2px', color: '#a2a6ba', textTransform: 'uppercase' }}>
          <span>{layout.customFooterText || 'Powered by Flashvision'}</span>
          {layout.showPageNumbers !== false && footerPageText && <span>{footerPageText}</span>}
        </div>
      </div>
    </div>
  );
}
