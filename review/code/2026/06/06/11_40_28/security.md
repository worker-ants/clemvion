# 보안(Security) 리뷰

**대상 커밋**: 2bcc2a52 — `.claude/` harness hook Python 하드닝 패스
**리뷰어**: Security sub-agent
**일시**: 2026-06-06

---

## 발견사항

### 1. [WARNING] `_marker_path` 파일명에 세션 ID 및 브랜치명 미검증 삽입 (경로 조작 가능성)

- **위치**: `.claude/hooks/guard_review_before_stop.py` — `_marker_path()` 함수
- **상세**:
  `session_id` 는 Claude 하네스의 JSON payload 에서 읽은 외부 문자열이다. `_throttle_token()` 이 반환하는 브랜치명도 `git rev-parse --abbrev-ref HEAD` stdout 에서 온다. 두 값을 직접 f-string 으로 이어붙여 파일 경로를 구성한다:
  ```python
  return os.path.join(_state_dir(), f"{sid}__{token}")
  ```
  세션 ID에 `..` 또는 `/`(POSIX) 혹은 `\`(Windows) 가 포함되면 `_state_dir()` 바깥 경로를 가리킬 수 있다. 브랜치명의 `/` 는 `replace("/", "-")` 로 제거되지만, `session_id` 에는 아무 새니타이징도 없다. 실제로 Claude 하네스가 발급하는 session_id 는 UUID 계열이므로 현재 환경에서 실제 경로 탈출이 일어날 가능성은 낮다. 그러나 하네스 payload 가 임의 문자열을 넣을 수 있다면 `.claude/state/` 밖에 빈 파일이 생성될 수 있다.
- **제안**: `session_id` 를 경로에 사용하기 전에 `re.sub(r"[^a-zA-Z0-9_\-]", "_", sid)` 등으로 허용 문자 집합만 남기도록 정규화한다. 브랜치명 토큰에도 동일한 위생 처리를 권장한다.

---

### 2. [WARNING] `_code_review_in_flight` — `review/code/` 트리 전체를 os.walk 하며 `meta.json` 존재 여부로 게이트를 우회할 수 있음

- **위치**: `.claude/hooks/_lib/review_guard.py` — `_code_review_in_flight()` 함수
- **상세**:
  함수는 `review/code/` 아래 `meta.json` 이 존재하고 `SUMMARY.md` 가 없으며 타임스탬프가 30분 이내인 디렉터리를 찾으면 `True`(게이트 허용)를 반환한다.
  ```python
  if "meta.json" not in files or "SUMMARY.md" in files:
      continue
  t = _path_session_time(dirpath)
  if t > 0.0 and (now - t) <= _IN_FLIGHT_TTL_SECONDS:
      return True
  ```
  `review/code/` 아래에 `meta.json` 을 배치하는 것은 Claude 모델이 직접 수행하는 쓰기 작업이다. 하지만 모델이 실수로(또는 악의적인 프롬프트 주입에 의해) 잘못된 경로에 `meta.json` 을 생성하면 게이트가 30분 동안 침묵한다. `meta.json` 의 내용을 검증하지 않고(빈 JSON `{}` 도 통과) 디렉터리 이름 타임스탬프만 신뢰한다는 점도 게이트 우회 벡터가 된다.

  다만 Push 가드(`guard_review_before_push.py`)는 이 로직을 사용하지 않는다고 명시되어 있으므로, 영향 범위는 "Stop hook 의 단일 nudge" 에 한정된다. Push 가드가 실제 하드 게이트로 남아 있는 한 이 경로로 미검토 코드가 출시되지는 않는다.
- **제안**: `_code_review_in_flight` 에서 `meta.json` 을 파싱해 최소한 유효 JSON 임을 확인하고, 가능하면 필수 필드(`mode` 등)를 검사한다. 현재 코드도 `_is_impl_done_session()` 에서는 이를 수행하고 있으므로 일관성을 맞추는 것이 좋다.

---

### 3. [WARNING] `_summary_is_resolved` — RESOLUTION.md 존재만으로 리뷰를 해소 처리

- **위치**: `.claude/hooks/_lib/review_guard.py` — `_summary_is_resolved()` 함수
- **상세**:
  ```python
  if os.path.exists(os.path.join(session_dir, "RESOLUTION.md")):
      return True
  ```
  `RESOLUTION.md` 파일의 내용을 검증하지 않는다. 빈 파일, 1바이트 파일, 또는 모델이 제대로 된 해소 내용을 작성하지 않은 파일도 리뷰를 "해소됨"으로 처리한다. 이 변경으로 새로 추가된 로직은 아니지만, 이번 패스에서 해당 함수가 리뷰 범위에 포함되어 있으므로 지적한다.
- **제안**: `RESOLUTION.md` 가 일정 바이트 이상이거나 특정 서명 헤더(예: `## Resolution`)를 포함하는 경우에만 해소로 인정하는 최소 검증 추가를 고려한다.

---

### 4. [INFO] `lint_mermaid_posttooluse.py` — 파일 경로를 외부 프로세스에 직접 전달

- **위치**: `.claude/hooks/lint_mermaid_posttooluse.py` — `main()` 함수
- **상세**:
  ```python
  proc = subprocess.run(
      ["node", script, os.path.abspath(target)],
      ...
  )
  ```
  `target` 은 Claude 도구 호출 payload 의 `file_path` 필드에서 온다. `os.path.abspath()` 로 절대 경로화하지만, 경로 탈출(path traversal) 방어는 없다. `node` 는 이 경로를 파일로만 읽기 때문에 RCE 벡터가 되지는 않는다. 단, 리스트(list) 형식으로 `subprocess.run` 에 전달되므로 쉘 인젝션도 없다. 실질적 위험도는 낮다.
  추가된 `timeout=20.0` 과 `TimeoutExpired` 처리는 DoS 방어로 올바른 방향이다.
- **제안**: 필요 시 `target` 경로가 repo 루트 하위에 있는지 확인하는 경계 검사를 추가할 수 있으나 현재 환경에서는 낮은 우선순위.

---

### 5. [INFO] `_glob_to_regex` — 정규식 DoS(ReDoS) 위험도 낮음, 수정 방향 올바름

- **위치**: `.claude/hooks/_lib/review_guard.py` — `_glob_to_regex()` 함수
- **상세**:
  이번 패스에서 `**/` → `(?:.*/)?` 로 변경해 세그먼트 경계를 올바르게 처리하게 됐다. 패턴 입력은 `spec/**/*.md` 의 YAML frontmatter 에서 오며 spec 파일은 저장소 내부 소스이므로 외부 사용자가 임의 글로브를 주입할 수 없다. 중첩 수량자(`.*.*`)가 없으므로 ReDoS 가능성도 없다.
- **제안**: 추가 조치 불필요.

---

### 6. [INFO] `bootstrap-session.sh` — `find ... -delete` 에서 `$state_dir` 경로 안전성

- **위치**: `.claude/tools/bootstrap-session.sh`
- **상세**:
  ```bash
  find "$state_dir" -type f -mtime +30 -delete 2>/dev/null || true
  ```
  `$state_dir` 은 `$main_root/.claude/state/...` 로 하드코딩된 경로 아래에 있다. `$main_root` 는 `git rev-parse --git-common-dir` → `dirname` 으로 계산되며, 공격자가 이 값을 제어하려면 git 저장소를 조작해야 한다. 이미 `set -u` 로 미선언 변수를 막고 있다. `-delete` 는 `-type f` 가 앞에 있으므로 디렉터리를 삭제하지 않는다. 실질적 위험도 없음.
- **제안**: 추가 조치 불필요.

---

### 7. [INFO] `branch_guard.py` — 타임아웃 단축(4.0 → 2.0초)의 보안 영향

- **위치**: `.claude/hooks/_lib/branch_guard.py` — `_origin_default_branch()` 함수
- **상세**:
  Method 2(`git remote show origin`)의 타임아웃이 4초에서 2초로 줄었다. 이 메서드는 네트워크를 사용하며, 느린 네트워크에서 Method 1(로컬 심볼릭 ref)이 실패하면 Method 2도 타임아웃되어 `default` 가 `None` 을 반환한다. `evaluate()` 에서는 `default is None` 이면 `GuardDecision(False, "no origin remote …")` 즉 허용으로 처리된다. 네트워크가 느린 환경에서 타임아웃을 의도적으로 유발해 가드를 우회하는 TOCTOU 벡터가 이론적으로 존재하나, 이미 4초도 충분히 우회 가능한 시간이었고, 로컬 Method 1이 정상인 환경에서는 영향이 없다. 가드는 "fail-open" 을 설계 방침으로 명시하고 있다.
- **제안**: 보안 게이트로서 fail-open 정책을 유지하는 한 이 변경은 적절하다. BYPASS_DEFAULT_BRANCH_GUARD=1 환경변수가 유일한 명시적 우회 수단으로 남아 있는 것도 올바르다.

---

### 8. [INFO] `_read_payload()` 의 JSON 파싱 — `stop_hook_active` 신뢰

- **위치**: `.claude/hooks/guard_review_before_stop.py` — `main()` 함수
- **상세**:
  `payload.get("stop_hook_active")` 를 truthy 이면 무조건 허용한다. 이 payload 는 Claude 하네스가 stdin 으로 넣으며, 외부 사용자가 직접 주입할 수 없다(Claude Code 실행 환경에서 stdin 은 하네스 독점). 현재 아키텍처에서는 신뢰 가능.
- **제안**: 추가 조치 불필요.

---

## 요약

이번 하드닝 패스는 전반적으로 보안 위험을 줄이는 방향이다. 핵심 변경인 타임아웃 추가, ReDoS 가능성 제거, 포슬린 경로 파싱 강화, 게이트 fail-open 유지 모두 올바른 판단이다. 가장 주목할 점은 `_marker_path` 에서 세션 ID 가 경로에 직접 삽입된다는 것인데, 현재 Claude 하네스의 session_id 가 UUID 계열이어서 실제 악용 가능성은 낮지만 명시적 새니타이징이 없다는 방어 심층(defense-in-depth) 공백이다. `_code_review_in_flight` 의 `meta.json` 무내용 신뢰는 Stop hook 소프트 게이트를 우회할 수 있는 이론적 벡터지만, push 가드가 하드 백스톱으로 남아 있어 실질적인 미검토 코드 출시 위험은 없다. 하드코딩된 시크릿, 인증 우회, SQL/명령 인젝션, 취약 암호화 알고리즘은 발견되지 않았다.

## 위험도

LOW

---

STATUS: SUCCESS
