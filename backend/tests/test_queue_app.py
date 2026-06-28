def _job_is_superseded(current, seq):
    from config import settings

    settings.REDIS_URL = "redis://localhost:6379/0"
    from queue_app import _job_is_superseded as helper

    return helper(current, seq)


def test_expired_inbound_seq_key_does_not_drop_job():
    assert _job_is_superseded(None, 7) is False


def test_newer_inbound_seq_supersedes_old_job():
    assert _job_is_superseded(b"8", 7) is True


def test_matching_inbound_seq_processes_job():
    assert _job_is_superseded(b"7", 7) is False
