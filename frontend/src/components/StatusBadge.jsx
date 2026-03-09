export default function StatusBadge({ status }) {
  const statusConfig = {
    uploaded: { label: 'Uploaded', className: 'badge-gray' },
    ocr_processing: { label: 'OCR Processing', className: 'badge-info' },
    ocr_completed: { label: 'OCR Done', className: 'badge-info' },
    evaluating: { label: 'Evaluating', className: 'badge-warning' },
    evaluated: { label: 'Evaluated', className: 'badge-success' },
    failed: { label: 'Failed', className: 'badge-error' },
  };

  const config = statusConfig[status] || { label: status, className: 'badge-gray' };

  return <span className={config.className}>{config.label}</span>;
}
