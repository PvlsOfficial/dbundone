#!/usr/bin/env python3
"""
FLP Metadata Extractor using PyFLP
Extracts metadata from FL Studio .flp files and outputs as JSON

Supports two modes:
1. Single file: python test.py <file.flp>
2. Batch mode: python test.py --batch (reads JSON array of paths from stdin)
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
from concurrent.futures import ThreadPoolExecutor, as_completed
import pyflp

def parse_time_string(time_str: str) -> Optional[int]:
    """Parse time string like '2h 30m' or '150 minutes' into minutes"""
    try:
        time_str = time_str.lower().strip()

        # Handle formats like "2h 30m"
        if 'h' in time_str or 'm' in time_str:
            hours = 0
            minutes = 0

            parts = time_str.replace(' ', '').split('h')
            if len(parts) > 1:
                hours = int(parts[0])
                time_str = parts[1]

            if 'm' in time_str:
                minutes = int(time_str.replace('m', ''))

            return hours * 60 + minutes

        # Handle formats like "150 minutes"
        elif 'minute' in time_str:
            return int(time_str.split()[0])

        # Handle plain numbers as minutes
        else:
            return int(time_str)

    except:
        return None

def extract_flp_metadata(file_path: str) -> Dict[str, Any]:
    """Extract metadata from FLP file using PyFLP"""
    try:
        # Load the FLP project
        project = pyflp.parse(file_path)

        metadata = {
            "file_path": file_path,
            "project_title": getattr(project, 'title', None) or Path(file_path).stem,
            "total_time_seconds": None,
            "bpm": None,
            "musical_key": None,
            "created_date": None,
            "modified_date": None,
            "time_spent_minutes": None,
            "channels": 0,
            "patterns": 0,
            "success": True
        }

        # Extract BPM
        if hasattr(project, 'tempo') and project.tempo:
            metadata["bpm"] = project.tempo

        # Extract channel count
        try:
            if hasattr(project, 'channels'):
                channels = project.channels
                if channels:
                    metadata["channels"] = len(list(channels))
        except Exception:
            pass

        # Extract pattern count
        try:
            if hasattr(project, 'patterns'):
                patterns = project.patterns
                if patterns:
                    metadata["patterns"] = len(list(patterns))
        except Exception:
            pass

        # Extract time spent (this might be in different places depending on FLP version)
        # PyFLP might have different attributes for time spent
        try:
            if hasattr(project, 'time_spent'):
                time_spent = project.time_spent
                if time_spent:
                    if isinstance(time_spent, str):
                        # Try to parse as time string
                        metadata["time_spent_minutes"] = parse_time_string(time_spent)
                    elif hasattr(time_spent, 'total_seconds'):  # datetime.timedelta
                        # Convert timedelta to minutes
                        total_seconds = int(time_spent.total_seconds())
                        metadata["time_spent_minutes"] = total_seconds // 60
                        metadata["total_time_seconds"] = total_seconds
                    elif isinstance(time_spent, (int, float)):
                        metadata["time_spent_minutes"] = int(time_spent // 60)
                        metadata["total_time_seconds"] = int(time_spent)
        except Exception as e:
            pass  # Silently skip time_spent extraction errors

        # Try to get other metadata if available
        if hasattr(project, 'created'):
            metadata["created_date"] = str(project.created) if project.created else None

        if hasattr(project, 'modified'):
            metadata["modified_date"] = str(project.modified) if project.modified else None

        # Extract musical key if available
        if hasattr(project, 'key'):
            metadata["musical_key"] = str(project.key) if project.key else None

        return metadata

    except Exception as e:
        return {
            "file_path": file_path,
            "error": str(e),
            "success": False
        }


def extract_batch(file_paths: List[str], max_workers: int = 4) -> List[Dict[str, Any]]:
    """
    Extract metadata from multiple FLP files in parallel.
    Uses thread pool for concurrent processing (pyflp is I/O bound).
    """
    results = []
    
    # Use ThreadPoolExecutor for parallel I/O-bound operations
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_path = {
            executor.submit(extract_flp_metadata, path): path 
            for path in file_paths
        }
        
        # Collect results as they complete
        completed = 0
        for future in as_completed(future_to_path):
            path = future_to_path[future]
            try:
                result = future.result()
                results.append(result)
                completed += 1
                
                # Send progress update every 10 files or at key milestones
                if completed % 10 == 0 or completed == len(file_paths):
                    progress_data = {
                        "type": "progress",
                        "current": completed,
                        "total": len(file_paths),
                        "phase": "extracting"
                    }
                    print(json.dumps(progress_data), file=sys.stderr)
                    sys.stderr.flush()
                    
            except Exception as e:
                results.append({
                    "file_path": path,
                    "error": str(e),
                    "success": False
                })
                completed += 1
    
    return results


def main():
    """CLI entry point - supports single file and batch mode"""
    
    # Batch mode: read file paths from stdin as JSON array
    if len(sys.argv) == 2 and sys.argv[1] == '--batch':
        try:
            # Read JSON array of file paths from stdin
            input_data = sys.stdin.read()
            file_paths = json.loads(input_data)
            
            if not isinstance(file_paths, list):
                print(json.dumps({
                    "error": "Batch mode expects a JSON array of file paths",
                    "success": False
                }))
                sys.exit(1)
            
            # Filter to only existing files
            valid_paths = [p for p in file_paths if Path(p).exists()]
            missing_paths = [p for p in file_paths if p not in valid_paths]
            
            # Process all files in parallel
            results = extract_batch(valid_paths)
            
            # Add error entries for missing files
            for missing in missing_paths:
                results.append({
                    "file_path": missing,
                    "error": f"File not found: {missing}",
                    "success": False
                })
            
            # Output all results as JSON array
            print(json.dumps(results))
            
        except json.JSONDecodeError as e:
            print(json.dumps({
                "error": f"Invalid JSON input: {e}",
                "success": False
            }))
            sys.exit(1)
        except Exception as e:
            print(json.dumps({
                "error": str(e),
                "success": False
            }))
            sys.exit(1)
        return
    
    # Single file mode (backwards compatible)
    if len(sys.argv) != 2:
        print(json.dumps({
            "error": "Usage: python test.py <file.flp> OR python test.py --batch",
            "success": False
        }))
        sys.exit(1)

    file_path = sys.argv[1]

    if not Path(file_path).exists():
        print(json.dumps({
            "error": f"File not found: {file_path}",
            "success": False
        }))
        sys.exit(1)

    metadata = extract_flp_metadata(file_path)
    print(json.dumps(metadata, indent=2))

if __name__ == "__main__":
    main()