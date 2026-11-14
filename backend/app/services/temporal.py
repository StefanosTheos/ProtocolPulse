from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def local_midnight(day: date, zone="Europe/Athens") -> datetime:
    return datetime.combine(day, time.min, ZoneInfo(zone)).astimezone(timezone.utc)


def calendar_window(day, window):
    start = day + timedelta(days=window.start_offset_days)
    end = day + timedelta(days=window.end_offset_days)
    if not window.start_inclusive:
        start += timedelta(days=1)
    if window.end_inclusive:
        end += timedelta(days=1)
    return local_midnight(start, window.time_zone), local_midnight(end, window.time_zone)


def age_on(birth: date, day: date) -> int:
    return day.year - birth.year - ((day.month, day.day) < (birth.month, birth.day))


def overlaps(start, end, window_start, window_end):
    return start < window_end and window_start < end
