import React from 'react';
import { FilterOptions } from '@shared/types';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
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
      genreFilter: null,
      artistFilter: null,
      recordingFilter: null,
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
          placeholder={t('searchFilter.search')}
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
          <label>{t('searchFilter.sortBy')}</label>
          <select value={filters.sortBy} onChange={handleSortChange}>
            <option value="date-newest">{t('sort.newest')}</option>
            <option value="date-oldest">{t('sort.oldest')}</option>
            <option value="name-asc">{t('sort.nameAsc')}</option>
            <option value="name-desc">{t('sort.nameDesc')}</option>
            <option value="bpm-asc">{t('sort.bpmAsc')}</option>
            <option value="bpm-desc">{t('sort.bpmDesc')}</option>
            <option value="time-spent-asc">{t('sort.timeAsc')}</option>
            <option value="time-spent-desc">{t('sort.timeDesc')}</option>
            <option value="key">{t('sort.key')}</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button className="clear-filters" onClick={handleClearFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            {t('searchFilter.clearFilters')}
          </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="tag-filters">
          <span className="tag-filters-label">{t('searchFilter.tags')}</span>
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
