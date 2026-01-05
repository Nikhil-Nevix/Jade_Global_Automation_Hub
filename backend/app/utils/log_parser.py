"""
Ansible Log Parser
Parses and processes Ansible Runner output for storage and display
"""
import re
from datetime import datetime
from typing import List, Dict, Tuple


class AnsibleLogParser:
    """Parse Ansible output and extract structured log information"""
    
    # ANSI color code pattern
    ANSI_PATTERN = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    
    # Log level patterns
    LEVEL_PATTERNS = {
        'ERROR': re.compile(r'(?i)(error|failed|fatal)', re.IGNORECASE),
        'WARNING': re.compile(r'(?i)(warn|warning|deprecated)', re.IGNORECASE),
        'DEBUG': re.compile(r'(?i)(debug|verbose)', re.IGNORECASE),
    }
    
    # Task status patterns
    TASK_PATTERN = re.compile(r'^TASK \[(.*?)\]')
    PLAY_PATTERN = re.compile(r'^PLAY \[(.*?)\]')
    OK_PATTERN = re.compile(r'^ok: \[(.*?)\]')
    CHANGED_PATTERN = re.compile(r'^changed: \[(.*?)\]')
    FAILED_PATTERN = re.compile(r'^failed: \[(.*?)\]')
    SKIPPED_PATTERN = re.compile(r'^skipping: \[(.*?)\]')
    
    @staticmethod
    def strip_ansi_codes(text):
        """
        Remove ANSI escape codes from text
        
        Args:
            text: Text containing ANSI codes
        
        Returns:
            Clean text without ANSI codes
        """
        return AnsibleLogParser.ANSI_PATTERN.sub('', text)
    
    @staticmethod
    def detect_log_level(line):
        """
        Detect log level based on line content
        
        Args:
            line: Log line content
        
        Returns:
            Log level string (ERROR, WARNING, DEBUG, INFO)
        """
        for level, pattern in AnsibleLogParser.LEVEL_PATTERNS.items():
            if pattern.search(line):
                return level
        return 'INFO'
    
    @staticmethod
    def parse_line(line, line_number):
        """
        Parse a single log line and extract metadata
        
        Args:
            line: Raw log line
            line_number: Line number in output
        
        Returns:
            Dictionary with parsed log data
        """
        # Strip ANSI codes
        clean_line = AnsibleLogParser.strip_ansi_codes(line)
        
        # Detect log level
        log_level = AnsibleLogParser.detect_log_level(clean_line)
        
        # Detect task/play information
        task_match = AnsibleLogParser.TASK_PATTERN.match(clean_line)
        play_match = AnsibleLogParser.PLAY_PATTERN.match(clean_line)
        
        metadata = {
            'line_number': line_number,
            'content': clean_line.rstrip(),
            'log_level': log_level,
            'timestamp': datetime.utcnow(),
        }
        
        if task_match:
            metadata['task_name'] = task_match.group(1)
        elif play_match:
            metadata['play_name'] = play_match.group(1)
        
        return metadata
    
    @staticmethod
    def parse_output(output, start_line=0):
        """
        Parse complete Ansible output
        
        Args:
            output: Complete output string or list of lines
            start_line: Starting line number (for incremental parsing)
        
        Returns:
            List of parsed log entries
        """
        if isinstance(output, str):
            lines = output.split('\n')
        else:
            lines = output
        
        parsed_logs = []
        for idx, line in enumerate(lines, start=start_line + 1):
            if line.strip():  # Skip empty lines
                parsed = AnsibleLogParser.parse_line(line, idx)
                parsed_logs.append(parsed)
        
        return parsed_logs
    
    @staticmethod
    def extract_summary(logs):
        """
        Extract execution summary from logs
        
        Args:
            logs: List of parsed log entries
        
        Returns:
            Dictionary with execution summary
        """
        summary = {
            'total_tasks': 0,
            'ok': 0,
            'changed': 0,
            'failed': 0,
            'skipped': 0,
            'errors': [],
        }
        
        for log in logs:
            content = log.get('content', '')
            
            if AnsibleLogParser.TASK_PATTERN.match(content):
                summary['total_tasks'] += 1
            elif AnsibleLogParser.OK_PATTERN.match(content):
                summary['ok'] += 1
            elif AnsibleLogParser.CHANGED_PATTERN.match(content):
                summary['changed'] += 1
            elif AnsibleLogParser.FAILED_PATTERN.match(content):
                summary['failed'] += 1
                summary['errors'].append({
                    'line': log['line_number'],
                    'message': content
                })
            elif AnsibleLogParser.SKIPPED_PATTERN.match(content):
                summary['skipped'] += 1
        
        return summary
    
    @staticmethod
    def extract_errors(logs):
        """
        Extract all error messages from logs
        
        Args:
            logs: List of parsed log entries
        
        Returns:
            List of error log entries
        """
        errors = []
        for log in logs:
            if log.get('log_level') == 'ERROR' or 'failed' in log.get('content', '').lower():
                errors.append(log)
        return errors
    
    @staticmethod
    def format_for_display(logs, max_lines=None):
        """
        Format logs for frontend display
        
        Args:
            logs: List of parsed log entries
            max_lines: Maximum number of lines to return
        
        Returns:
            Formatted log entries for display
        """
        formatted = []
        for log in logs[:max_lines] if max_lines else logs:
            formatted.append({
                'line': log['line_number'],
                'content': log['content'],
                'level': log['log_level'],
                'timestamp': log['timestamp'].isoformat() if isinstance(log['timestamp'], datetime) else log['timestamp']
            })
        return formatted


# Singleton parser instance
log_parser = AnsibleLogParser()
