import React from 'react';
import { FilterOptions } from '@shared/types';
import './SearchFilter.css';

interface SearchFilterProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  availableTags: string[];
}

export const SearchFilter: React.FC<SearchFilterProps> = ({ 
  filters, 
  onFilterChange, 
  availableTags 
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, searchQuery: e.target.value });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, sortBy: e.target.value as FilterOptions['sortBy'] });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.selectedTags.includes(tag)
      ? filters.selectedTags.filter(t => t !== tag)
      : [...filters.selectedTags, tag];
    onFilterChange({ ...filters, selectedTags: newTags });
  };

  const handleClearFilters = () => {
    onFilterChange({
      searchQuery: '',
      sortBy: 'date-newest',
      selectedTags: [],
      collectionFilter: null,
      statusFilter: null,
      dawFilter: null,
    });
  };

  const hasActiveFilters = 
    filters.searchQuery || 
    filters.selectedTags.length > 0 || 
    filters.sortBy !== 'date-newest' ||
    filters.statusFilter?.length ||
    filters.dawFilter?.length;

  return (
    <div className="search-filter">
      <div className="search-bar">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search projects..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
        />
        {filters.searchQuery && (
          <button 
              className="search-clear"
              onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
              aria-label="Clear search"
            >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      <div className="filter-controls">
        <div className="sort-control">
          <label>Sort by:</label>
          <select value={filters.sortBy} onChange={handleSortChange}>
            <option value="date-newest">Newest first</option>
            <option value="date-oldest">Oldest first</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="bpm-asc">BPM (Low-High)</option>
            <option value="bpm-desc">BPM (High-Low)</option>
            <option value="time-spent-asc">Time Spent (Low-High)</option>
            <option value="time-spent-desc">Time Spent (High-Low)</option>
            <option value="key">Key</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button className="clear-filters" onClick={handleClearFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            Clear filters
          </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="tag-filters">
          <span className="tag-filters-label">Tags:</span>
          <div className="tag-filters-list">
            {availableTags.map(tag => (
              <button
                key={tag}
                className={`tag-filter ${filters.selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
