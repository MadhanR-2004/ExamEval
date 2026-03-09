export default function ScoreBadge({ score, maxScore, percentage }) {
  const pct = percentage ?? (maxScore > 0 ? (score / maxScore) * 100 : 0);
  
  let colorClass = 'text-red-600 bg-red-50';
  if (pct >= 80) colorClass = 'text-green-600 bg-green-50';
  else if (pct >= 60) colorClass = 'text-blue-600 bg-blue-50';
  else if (pct >= 40) colorClass = 'text-yellow-600 bg-yellow-50';
  else if (pct >= 20) colorClass = 'text-orange-600 bg-orange-50';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold ${colorClass}`}>
      {score !== undefined && maxScore !== undefined
        ? `${score}/${maxScore}`
        : `${pct.toFixed(1)}%`}
    </span>
  );
}
