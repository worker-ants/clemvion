# 동시성(Concurrency) 리뷰 — 라운드 3 (`ad8662bd5..8bc7e6df1`)

## 발견사항

- **[INFO]** `--task` 의 캐시 파일 쓰기가 비원자적이고, 304 에서도 같은 바이트를 다시 쓴다
  - 위치: `.claude/tools/nerv-mirror/pull.py:598-599` (`cmd_task` 의 `cache.mkdir(...)` · `(cache / f"{key}.md").write_bytes(raw)`), 읽는 쪽은 `_cached_raw` · `conditional_etag`(`:553-567`)
  - 상세: 워크트리는 main 의 `.nerv` 를 공유하므로(`local_config.py` 가 링크하고 pull.py docstring `:46-48` 도 그렇게 적는다) `.nerv/cache/mirror/<KEY>.md` 는 동시에 도는 세션들의 공유 파일이다. `write_bytes` 는 `open("wb")` 로 잘라낸 뒤 쓰므로 읽는 세션이 빈 파일이나 자른 파일을 볼 수 있고, 두 세션이 동시에 쓰면 두 버전이 섞인 파일도 남을 수 있다. 또 `?task=` 기준 버전은 Task 마다 다를 수 있어 세션끼리 같은 키의 캐시를 서로 덮는다.
    - **정합성은 지켜진다.** 읽는 쪽은 `conditional_etag` 에서 `etag_of(cached)` 를 미러 frontmatter `etag` 와 비교하고, 같을 때만 조건부 요청을 한다. 304 가 오면 그 메모리의 `cached` 를 그대로 `raw` 로 쓴다(`:594-595`). 디스크를 다시 읽지 않으므로 읽기와 사용 사이에 끼어들 틈이 없다. 잘리거나 섞인 파일은 해시가 달라 `None` 이 되고 본문을 새로 받는다. 틀린 304 로 이어지는 경로는 찾지 못했다(docstring `:46-48` 의 주장이 맞다). 기존 테스트 `test_cache_of_another_version_means_no_conditional_request` 와 `test_malformed_mirror_etag_is_refetched_not_sent` 가 그 분기를 고정한다.
    - **남는 비용은 효율이다.** 304 를 받은 세션이 같은 바이트를 굳이 다시 써서 다른 세션이 읽는 순간에 잘린 파일을 보게 만든다. 그 세션은 조건부 요청을 포기하고 본문 전체를 받는다.
  - 제안: (1) `status == 304` 일 때는 캐시를 다시 쓰지 않는다(`raw is cached`). (2) 쓸 때는 같은 디렉터리에 임시 파일을 만들고 `os.replace` 로 바꿔 읽는 쪽이 완성본만 보게 한다. 필수는 아니다. 이 경합은 해시 검증이 이미 안전하게 만든다.

- **[INFO]** 심볼릭 링크 방어가 검사와 쓰기 사이의 간격(check-then-act)을 닫지 못한다
  - 위치: `.claude/tools/nerv-mirror/pull.py:283-298` (`_write_target` · `write_if_changed`), 사전 검사 루프 `:319-321`
  - 상세: `_write_target` 이 `path.is_symlink()` 와 `resolve()` 로 검사한 뒤 `write_if_changed` 가 별도로 `open(path, "w")` 를 한다. 라운드 2 수정이 "쓰기 전에 모든 대상을 먼저 검사"(`:319-321`)하도록 바꿔서 검사와 실제 쓰기 사이의 간격이 문서 수만큼 넓어졌다. 그 사이에 같은 사용자 권한의 다른 프로세스(다른 세션, 에디터, 스크립트)가 대상 경로를 링크로 바꾸면 `open(..., "w")` 는 링크를 따라간다. 이미 존재하던 링크는 막히지만 검사 뒤에 생긴 링크는 막히지 않는다. 위협 모델이 로컬 개발 도구(공격자가 `spec/` 쓰기 권한을 이미 가진 상태)라 실제 위험은 낮다. 다만 CHANGELOG 의 "심볼릭 링크는 따라가 쓰거나 지우지 않는다"는 동시 변경까지 덮는 보장은 아니다. 지우는 쪽은 `Path.unlink()` 가 링크 자체만 지우므로 영향이 없다.
  - 제안: 문구를 "검사 시점에 이미 있는 링크는 따라가지 않는다" 정도로 좁히거나, 쓸 때 `os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW)` 로 마지막 구성요소의 추종을 막는다(상위 폴더 링크는 여전히 `_write_target` 의 `resolve()` 검사에 의존한다).

## 변경에서 동시성과 무관하거나 문제없음을 확인한 곳

- **훅 `guard_nerv_owned_paths.py`**: 상태가 없고 읽기만 한다(stdin JSON 읽기, 경로 조회, stderr 출력). 병렬 도구 호출로 훅이 동시에 여러 개 떠도 공유 자원이 없다. `traceback` 을 모듈 상단으로 옮긴 것과 `_` 접두 함수 이름 변경은 동작이 같다. `sys.exit(main())` 의 `SystemExit` 은 `except Exception` 에 걸리지 않으므로 exit 2 가 exit 0 으로 바뀌는 경로가 없다.
- **`PullError` 의 `SystemExit` → `Exception` 전환**: `check()` 의 `except PullError`(`:522`)는 이제 `SystemExit` 을 삼키는 대신 정상적인 예외로 잡는다. `__main__` 의 `except (PullError, RuntimeError)` 가 CLI 종료를 맡는다. 다른 곳에 `except Exception` 으로 `PullError` 를 삼키는 자리는 없다. 테스트의 `test_tree_cycle_stops` 는 데몬 스레드에서 `pull.PullError` 를 잡고 `join(10)` 뒤 읽으므로(`join` 이 happens-before 를 만든다) 데이터 경합이 없다.
- **`subprocess.run(curl ...)`**: `input=` 과 `capture_output=True` 를 함께 써서 `communicate()` 가 두 파이프를 같이 비우므로 파이프 교착이 없다. `--max-time 120` 이 전송 전체를 제한한다. `--task` 는 키마다 순차 호출이라 scope 가 크면 오래 걸릴 수 있다(최악 키 수 × 120s). 풀 · 스레드가 없으므로 정확성 문제는 아니다.
- **테스트의 `mock.patch.dict(os.environ)`**: 수동 저장 · 복원을 대체한다. unittest 는 직렬이고 스레드가 환경 변수를 바꾸지 않으므로 안전하다. `patch.dict` 는 중지할 때 `os.environ` 전체를 스냅샷으로 되돌려 수동 복원보다 오히려 안전하다.
- **`_NERV_MIRROR_REL` · `NERV_MIRROR` · `KEY_RE.fullmatch` 등 정규식 · 주석 변경, 워크플로 `sparse-checkout`, 문서 변경**: 동시성과 무관하다.
- 범위 밖의 기존 사항: `spec-link-checks.yml` 의 `concurrency: cancel-in-progress: true` 는 `push: main` 에서도 같은 그룹(`refs/heads/main`)이라 연속 머지 시 앞선 main 커밋의 실행이 취소될 수 있다. 이번 diff 가 바꾼 것이 아니며 PR 체크에는 영향이 없다.

## 요약

이번 범위는 대부분 문서 · 주석 · 테스트 · 입력 검증 변경이고 동시성 표면은 거의 없다. 유일한 실질 공유 자원은 워크트리들이 공유하는 `.nerv/cache/mirror` 이며, 비원자적 쓰기와 덮어쓰기가 있지만 캐시 원문의 sha256 을 미러 etag 와 대조한 뒤에만 조건부 요청을 하고 304 일 때 메모리의 같은 바이트를 재사용하는 구조라 틀린 304 나 깨진 미러로 이어지는 경로는 찾지 못했다(남는 것은 불필요한 재다운로드). 심볼릭 링크 방어에는 검사와 쓰기 사이의 간격이 있으나 로컬 도구 위협 모델에서 위험은 낮고 문구를 좁히거나 `O_NOFOLLOW` 로 닫을 수 있다. 훅은 무상태 읽기 전용이라 병렬 호출에 안전하고, 차단 경로(exit 2)가 fail-open 으로 바뀌는 회귀도 없다. 저장소 파일은 수정하지 않았다(`git status --short` 는 기존 untracked `review/` 세 줄뿐).

## 위험도

LOW
