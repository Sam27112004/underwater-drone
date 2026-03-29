/**
 * InspectionPanel
 *
 * Props:
 *   taggedCount       number
 *   onViewGallery     () => void
 *   onDownloadReport  () => void
 *   onResetTags       () => void
 */
export default function InspectionPanel({
  taggedCount,
  onViewGallery,
  onDownloadReport,
  onResetTags,
}) {
  const noTags = taggedCount === 0;

  return (
    <div>
      <h2 className="section-title">06 // INSPECTION</h2>

      <p
        className="inspection-count"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>
          <span className="inspection-count-value">{taggedCount}</span>
          {' '}frame{taggedCount !== 1 ? 's' : ''} tagged
          <span className="inspection-count-hint"> (T / [ TAG ])</span>
        </span>
        <button
          className="btn hover-target"
          onClick={onResetTags}
          disabled={noTags}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', opacity: noTags ? 0.35 : 1 }}
        >
          [ RESET ]
        </button>
      </p>

      <div className="inspection-actions">
        <button
          className="btn btn-super hover-target"
          onClick={onViewGallery}
          disabled={noTags}
          style={{ opacity: noTags ? 0.35 : 1 }}
          title={noTags ? 'Tag at least one frame first' : 'Browse tagged frames with detections'}
        >
          VIEW GALLERY
        </button>

        <button
          className="btn btn-super hover-target"
          onClick={onDownloadReport}
          disabled={noTags}
          style={{ opacity: noTags ? 0.35 : 1 }}
          title={noTags ? 'Tag at least one frame first' : 'Download self-contained HTML report'}
        >
          DOWNLOAD REPORT
        </button>
      </div>
    </div>
  );
}
