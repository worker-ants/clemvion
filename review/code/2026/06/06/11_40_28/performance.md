# 성능(Performance) 리뷰

## 발견사항

### [INFO] `_dirty_set` 중복 호출 — `evaluate_review` 경로에서 2회 실행
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` — `_newest_resolved_review_mtime`, `_newest_resolved_impl_done_mtime`, `evaluate_review`
- **상세**: `evaluate_review`가 호출되면 `_dirty_set(repo_root)`이 `_newest_resolved_review_mtime` 내에서 1회, `_newest_resolved_impl_done_mtime` 내에서 또 1회 실행된다(spec_linked가 있을 때). 각 호출은 `git status --porcelain`을 subprocess로 실행하므로, 단일 `evaluate_review` 실행 당 최소 2회의 git 프로세스가 기동된다. 이 함수들은 이미 Stop hook / PreToolUse hook처럼 짧은 지연을 요구하는 경로에서 실행된다.
- **제안**: `evaluate_review`에서 `dirty = _dirty_set(repo_root)` 를 한 번만 계산한 뒤 `_newest_resolved_review_mtime(repo_root, dirty=dirty)` 형태로 전달하거나, `_authoritative_code_time`처럼 `dirty` 파라미터를 caller에서 주입할 수 있도록 두 함수의 시그니처를 확장한다.

---

### [INFO] `_code_review_in_flight` — `os.walk` 전체 순회 후 조기 반환 가능하지만 패턴 상 최선
- **위치**: `review_guard.py` — `_code_review_in_flight` 함수
- **상세**: `os.walk`는 `review/code/` 아래 모든 디렉터리를 DFS로 순회한다. 첫 in-flight 세션이 발견되면 즉시 `True`를 반환하므로 조기 종료 최적화는 이미 구현되어 있다. 세션이 많아질수록 순회 비용은 선형으로 증가하지만, 리뷰 디렉터리 수가 실무적으로 충분히 작아 현재 규모에서 문제가 되지 않는다. 단, 세션 수가 수백 개를 넘으면 Stop hook 지연에 영향을 줄 수 있다 — 이 경우 GC 주기를 단축하거나 별도 인덱스 파일을 도입해야 한다.
- **제안**: 현재 규모에서는 허용 가능. 향후 `review/code/` GC 정책이 없으면 느려질 수 있으므로 bootstrap GC(`bootstrap-session.sh`의 30일 규칙)를 리뷰 산출물에도 적용하는 것을 고려한다.

---

### [INFO] `_spec_code_patterns` — 매 `evaluate_review` 호출 시 모든 spec/*.md를 재파싱
- **위치**: `review_guard.py` — `_spec_code_patterns`, `_spec_linked_changes`
- **상세**: `_spec_code_patterns`는 `os.walk(spec_root)`로 모든 spec markdown을 열어 frontmatter를 파싱하고 정규식으로 컴파일한다. 이 작업은 `evaluate_review` 호출마다 반복된다. spec 파일이 수십~수백 개라면 Stop hook 실행 시간에 누적 영향을 줄 수 있다. 현재 코드는 호출 간 캐싱이 없다.
- **제안**: 프로세스 단위 캐싱(module-level `functools.lru_cache` 또는 `@cache`)을 `_spec_code_patterns`에 적용한다. hook 프로세스는 단명(single-shot)이므로 캐시 무효화 문제가 없다. spec 파일을 실시간 감시할 필요가 없는 hook 실행 컨텍스트에서는 무조건 이득이다.

---

### [INFO] `_throttle_token`에서 조건부 두 번째 subprocess 실행
- **위치**: `guard_review_before_stop.py` — `_throttle_token`
- **상세**: 정상 경로(브랜치 이름 획득 성공)에서는 subprocess 1회만 실행된다. 그러나 detached HEAD 상황에서는 `git rev-parse --abbrev-ref HEAD`가 "HEAD"를 반환한 뒤, 다시 `git rev-parse --short HEAD`를 두 번째로 실행한다. 각 호출에 timeout=5.0이 설정되어 있으므로 최악의 경우 10초까지 차단될 수 있다.
- **제안**: 정상 경로(브랜치 존재)에서는 영향이 없다. detached HEAD는 엣지 케이스이므로 현재 구현이 허용 가능하다. 만약 단일 호출로 줄이고 싶다면 `git symbolic-ref --short HEAD`를 우선 시도하고 실패 시 `--short HEAD`로 폴백하는 단일 패턴을 사용할 수 있다.

---

### [INFO] `branch_guard.py` — `git remote show origin` 타임아웃 4.0→2.0초 단축 (긍정적 변경)
- **위치**: `branch_guard.py` — `_origin_default_branch` Method 2
- **상세**: 이번 변경에서 네트워크 호출 타임아웃을 4.0초에서 2.0초로 줄였다. Method 1(로컬 symbolic-ref)이 성공하는 정상 경로에서는 이 경로에 진입하지 않으므로, 최악 케이스(Method 1 실패)의 블로킹 시간만 줄인 것이다. 올바른 방향의 개선이다.
- **제안**: 추가 개선 여지 없음. 현재 접근이 적절하다.

---

### [INFO] `bootstrap-session.sh` — GC `find`가 두 경로를 별도 프로세스로 실행
- **위치**: `bootstrap-session.sh` — 신규 섹션 3
- **상세**: 두 `state_dir`에 대해 `find … -delete`를 루프로 각각 실행한다. 이는 두 번의 `find` 프로세스 기동을 의미한다. SessionStart 시점에서 한 번 실행되므로 실용적으로 문제가 없지만, 두 경로를 단일 `find` 호출로 합칠 수 있다.
- **제안**: 성능 영향이 미미한 SessionStart 수준에서의 차이이므로 현재 구현이 충분하다.

---

## 요약

변경의 성능 측면에서 가장 주목할 사항은 `_dirty_set`이 단일 `evaluate_review` 실행 내에서 최대 2회(`_newest_resolved_review_mtime`과 `_newest_resolved_impl_done_mtime`에서 각각)  git subprocess를 실행한다는 점이다. hook이 Stop / PreToolUse처럼 저지연을 요구하는 경로에서 동작하는 만큼, `dirty` 세트를 `evaluate_review` 수준에서 한 번만 계산하고 하위 함수에 전달하면 git 프로세스 기동을 1회 절감할 수 있다. 또한 `_spec_code_patterns`의 결과가 매 호출마다 재계산되어 spec 파일 전체를 재파싱하는데, 단명 hook 프로세스 특성상 `lru_cache`를 적용하면 무비용으로 이 비용을 제거할 수 있다. 나머지 변경들(타임아웃 단축, bootstrap GC, 조기 반환 유지)은 성능 관점에서 긍정적이거나 중립적이다. 전체적으로 이번 변경이 성능을 악화시키는 부분은 없으며, 발견된 사항은 추가 최적화 기회에 해당한다.

## 위험도

LOW

STATUS: SUCCESS
