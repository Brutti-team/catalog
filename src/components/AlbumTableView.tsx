import { ArrowUpRight, Check, Eye, Folder, Package } from "lucide-react";
import type { Category } from "../lib/types";
import { albumPhotoCategoryIds, type AlbumPhoto } from "../lib/album";
import SafeImage from "./SafeImage";

export type AlbumCategoryGroup = {
  category: Category;
  items: AlbumPhoto[];
  cover?: string;
};

export function AlbumCategoryTable({
  groups, uncategorised, search, onOpen,
}: {
  groups: AlbumCategoryGroup[];
  uncategorised: AlbumPhoto[];
  search: string;
  onOpen: (id: string) => void;
}) {
  const needle = search.trim().toLowerCase();
  const matched = groups.filter(({category, items}) =>
    !needle || category.name.toLowerCase().includes(needle) ||
    items.some(photo => photo.name.toLowerCase().includes(needle))
  );
  const includeOther = !needle || "uncategorised".includes(needle) ||
    uncategorised.some(photo => photo.name.toLowerCase().includes(needle));
  return (
    <div className="brutti-album__table-shell">
      <table className="brutti-album__table brutti-album__table--folders">
        <caption className="brutti-album__sr-only">Album categories and number of photos</caption>
        <thead><tr>
          <th scope="col">Preview</th>
          <th scope="col">Category</th>
          <th scope="col">Photos</th>
          <th scope="col">Action</th>
        </tr></thead>
        <tbody>
          {matched.map(({category,items,cover}) => (
            <tr key={category.id}>
              <td className="brutti-album__table-preview">
                <span className="brutti-album__table-thumb">
                  {cover ? <SafeImage src={cover} alt="" loading="lazy"/> : <Folder size={24}/>}
                </span>
              </td>
              <td className="brutti-album__table-title">
                <strong>{category.name}</strong>
                <small>Product collection</small>
              </td>
              <td className="brutti-album__table-count">{items.length} photos</td>
              <td className="brutti-album__table-action">
                <button type="button" onClick={() => onOpen(category.id)}
                  aria-label={`Open ${category.name} category`}>
                  Open <ArrowUpRight size={15} aria-hidden="true"/>
                </button>
              </td>
            </tr>
          ))}
          {includeOther && (
            <tr key="uncategorised">
              <td className="brutti-album__table-preview">
                <span className="brutti-album__table-thumb"><Folder size={24}/></span>
              </td>
              <td className="brutti-album__table-title">
                <strong>Uncategorised</strong>
                <small>Photos without a category</small>
              </td>
              <td className="brutti-album__table-count">{uncategorised.length} photos</td>
              <td className="brutti-album__table-action">
                <button type="button" onClick={() => onOpen("__uncategorized__")}>
                  Open <ArrowUpRight size={15} aria-hidden="true"/>
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!matched.length && !includeOther && <p className="brutti-album__table-empty">No matching categories.</p>}
    </div>
  );
}

export function AlbumPhotoTable({
  photos, categories, publishedIds, picker, selectedKeys, excludedUrls, onView, onSelect,
}: {
  photos: AlbumPhoto[];
  categories: Category[];
  publishedIds: ReadonlySet<string>;
  picker: boolean;
  selectedKeys: string[];
  excludedUrls: string[];
  onView: (photo: AlbumPhoto) => void;
  onSelect: (photo: AlbumPhoto) => void;
}) {
  const categoryNames = new Map(categories.map(item => [item.id,item.name]));
  return (
    <div className="brutti-album__table-shell">
      <table className="brutti-album__table brutti-album__table--photos">
        <caption className="brutti-album__sr-only">Album photos in table view</caption>
        <thead><tr>
          <th scope="col">Photo</th>
          <th scope="col">Name</th>
          <th scope="col">Category</th>
          <th scope="col">Used by</th>
          <th scope="col">Status</th>
          <th scope="col">Action</th>
        </tr></thead>
        <tbody>
          {photos.map(photo => {
            const linked = photo.usedBy.length > 0;
            const covered = photo.categoryCovers.length > 0;
            const published = photo.usedBy.some(product => publishedIds.has(product.id));
            const alreadyAdded = picker && excludedUrls.includes(photo.url);
            const selected = selectedKeys.includes(photo.key);
            const names = albumPhotoCategoryIds(photo).map(id => categoryNames.get(id)).filter(Boolean);
            const status = published ? "Published" : linked || covered ? "In use" : "Unassigned";
            return (
              <tr key={photo.key} className={selected ? "is-selected" : undefined}>
                <td className="brutti-album__table-preview">
                  <button type="button" className="brutti-album__table-thumb"
                    disabled={alreadyAdded}
                    onClick={() => picker ? onSelect(photo) : onView(photo)}
                    aria-label={picker ? `Select ${photo.name}` : `Preview ${photo.name}`}>
                    <SafeImage src={photo.url} alt="" loading="lazy"/>
                  </button>
                </td>
                <td className="brutti-album__table-title">
                  <strong title={photo.name}>{photo.name}</strong>
                  <small>{linked ? "Product image" : covered ? "Category cover" : "Album upload"}</small>
                </td>
                <td className="brutti-album__table-category" title={names.join(", ")}>
                  {names.join(", ") || "Uncategorised"}
                </td>
                <td className="brutti-album__table-used">
                  {linked
                    ? <span className="brutti-album__table-used-count"><Package size={14} aria-hidden="true"/>{photo.usedBy.length} {photo.usedBy.length===1?"product":"products"}</span>
                    : covered ? "Category cover" : "Not linked"}
                </td>
                <td className="brutti-album__table-status">
                  <span className={`brutti-album__table-pill ${published?"is-published":linked||covered?"is-linked":"is-unassigned"}`}>
                    {status}
                  </span>
                </td>
                <td className="brutti-album__table-action">
                  <button type="button" disabled={alreadyAdded} aria-label={picker ? `Select ${photo.name}` : `View details for ${photo.name}`}
                    onClick={() => picker ? onSelect(photo) : onView(photo)}>
                    {picker
                      ? selected ? <><Check size={15} aria-hidden="true"/> Selected</>
                        : alreadyAdded ? "Added" : "Select"
                      : <><Eye size={15} aria-hidden="true"/> View</>}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
