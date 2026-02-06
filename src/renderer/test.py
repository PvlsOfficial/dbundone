#!/usr/bin/env python3
import sys
import os
import json
import pyflp
from concurrent.futures import ProcessPoolExecutor, as_completed
import time
import warnings
import functools
import multiprocessing

# Suppress warnings to reduce stderr noise
warnings.filterwarnings("ignore")

# Get maximum workers based on CPU cores (leave one core free)
MAX_WORKERS = max(1, multiprocessing.cpu_count() - 1)

# LRU Cache for file-based caching
@functools.lru_cache(maxsize=1000)
def cached_extract_metadata(file_path, mtime):
    """Extract metadata from FLP file with caching based on file path and modification time."""
    try:
        project = pyflp.parse(file_path)

        # Extract project title
        project_title = None
        if hasattr(project, 'title') and project.title is not None:
            project_title = str(project.title)

        # Extract BPM
        bpm = None
        if hasattr(project, 'tempo') and project.tempo is not None:
            bpm = float(project.tempo)

        # Extract channels count
        channels = None
        if hasattr(project, 'channels') and project.channels is not None:
            channels = len(project.channels)

        # Extract patterns count
        patterns = None
        if hasattr(project, 'patterns') and project.patterns is not None:
            patterns = len(project.patterns)

        # Extract time spent (in minutes)
        time_spent_minutes = None
        if hasattr(project, 'time_spent') and project.time_spent is not None:
            # Handle timedelta objects from PyFLP
            if hasattr(project.time_spent, 'total_seconds'):
                # It's a timedelta, convert to minutes
                time_spent_minutes = int(project.time_spent.total_seconds() // 60)
            elif isinstance(project.time_spent, (int, float)):
                # It's already a number, convert to minutes if needed
                time_spent_minutes = int(project.time_spent // 60) if project.time_spent > 60 else int(project.time_spent)

        # Extract total time in seconds
        total_time_seconds = None
        if hasattr(project, 'time_spent') and project.time_spent is not None:
            # Handle timedelta objects from PyFLP
            if hasattr(project.time_spent, 'total_seconds'):
                # It's a timedelta, get total seconds
                total_time_seconds = int(project.time_spent.total_seconds())
            elif isinstance(project.time_spent, (int, float)):
                # It's already a number in seconds
                total_time_seconds = int(project.time_spent)

        return {
            'title': project_title,
            'bpm': bpm,
            'channels': channels,
            'patterns': patterns,
            'length': total_time_seconds,
            'time_spent_minutes': time_spent_minutes,
            'total_time_seconds': total_time_seconds
        }
    except Exception as e:
        # Return None values on error
        return {
            'title': None,
            'bpm': None,
            'channels': None,
            'patterns': None,
            'length': None,
            'time_spent_minutes': None,
            'total_time_seconds': None
        }

def extract_single_file(file_path):
    """Extract metadata from a single FLP file."""
    try:
        # Get file modification time for cache key
        mtime = os.path.getmtime(file_path)

        # Extract metadata with caching
        metadata = cached_extract_metadata(file_path, mtime)

        return {
            'file_path': file_path,
            'title': metadata['title'],
            'bpm': metadata['bpm'],
            'channels': metadata['channels'],
            'patterns': metadata['patterns'],
            'length': metadata['length'],
            'time_spent_minutes': metadata['time_spent_minutes'],
            'total_time_seconds': metadata['total_time_seconds']
        }
    except Exception as e:
        return {
            'file_path': file_path,
            'title': None,
            'bpm': None,
            'channels': None,
            'patterns': None,
            'length': None,
            'time_spent_minutes': None,
            'total_time_seconds': None
        }

def extract_batch(file_paths):
    """Extract metadata from multiple FLP files in parallel using ProcessPoolExecutor."""
    results = []

    # Use ProcessPoolExecutor for CPU bound operations (faster than ThreadPool)
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks
        future_to_path = {executor.submit(extract_single_file, path): path for path in file_paths}

        # Process results as they complete
        processed_count = 0
        for future in as_completed(future_to_path):
            result = future.result()
            results.append(result)

            processed_count += 1

            # Send progress update every 5 files for more frequent updates
            if processed_count % 5 == 0 or processed_count == len(file_paths):
                progress_data = {
                    'type': 'progress',
                    'current': processed_count,
                    'total': len(file_paths)
                }
                print(json.dumps(progress_data), file=sys.stderr, flush=True)

    return results

def main():
    """Main function to handle batch processing of FLP files."""
    if len(sys.argv) < 2:
        print("Usage: python test.py --batch <file1.flp> <file2.flp> ...", file=sys.stderr)
        sys.exit(1)

    if sys.argv[1] == '--batch':
        file_paths = sys.argv[2:]
        if not file_paths:
            print("No files provided for batch processing", file=sys.stderr)
            sys.exit(1)

        # Extract metadata for all files
        results = extract_batch(file_paths)

        # Output results as JSON
        print(json.dumps(results))
    else:
        # Single file processing (legacy support)
        file_path = sys.argv[1]
        result = extract_single_file(file_path)
        print(json.dumps(result))

if __name__ == "__main__":
    main()