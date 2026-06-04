export default function Flag({ code, name, className = 'w-8 h-8' }) {
  return (
    <img
      src={`/flags/${code.toLowerCase()}.svg`}
      alt={name || code}
      className={`inline-block rounded-sm object-cover flex-shrink-0 ${className}`}
      onError={e => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
