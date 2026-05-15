export default function ItemCard({ item, onEdit, onDelete, onToggle }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="h-36 w-full object-cover rounded-md mb-3"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{item.name}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            item.available
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {item.available ? "Available" : "Unavailable"}
        </span>
      </div>

      {item.category && (
        <span className="text-xs text-brand-600 mt-1">{item.category}</span>
      )}

      {item.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-3">
          {item.description}
        </p>
      )}

      <div className="mt-3 font-semibold text-gray-900">
        {item.price != null
          ? `${item.price} ${item.currency}`
          : "No price set"}
      </div>

      <div className="mt-4 flex gap-2 text-sm">
        <button
          onClick={() => onEdit(item)}
          className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          onClick={() => onToggle(item)}
          className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          {item.available ? "Mark unavailable" : "Mark available"}
        </button>
        <button
          onClick={() => onDelete(item)}
          className="px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
