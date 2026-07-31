# Security Review — 2026/07/31 12_38_42

## 검토 범위 메모

프롬프트에 전체 컨텍스트가 실리지 않은 4개 파일(`review_guard.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`, `tests/README.md`)은 `Read` 로 직접 열어 확인했고, 실제 코드 변경
범위 확정을 위해 `git diff origin/main...HEAD -- <path>` 로 각 파일의 diff 를 별도 확인했다.
이 세션은 `--route=all` + 파일 positional 인자로 준비되어 있어(각 파일 섹션에 diff 가 아니라
"전체 파일 컨텍스트" 만 실린 것이 그 증거) 아래 위치 인용은 diff 확인을 거쳐 정확한 실제 소스
라인 번호를 사용했다.

## 발견사항

- **[WARNING]** Critical 하향 금지 정책이 prompt 지시일 뿐이고 기계적 backstop 이 없음
  - 위치: `.claude/agents/consistency-summary.md:46` (§요약 지침 "3. 하향 금지"), `.claude/skills/consistency-checker/SKILL.md:113` (§4 BLOCK 처리 "Critical 하향은 금지다")
  - 상세: 이번 변경은 summary 통합 에이전트가 checker 의 `[CRITICAL]` 을 임의로 WARNING 으로
    하향해 `BLOCK: NO` 를 내보낸 실제 사고(`review/code/2026/07/25/22_58_00`)에 대응해
    "하향 금지 + 권한 밖 Critical 은 planner 즉시 인계" 규칙을 신설한다. 방향은 옳지만, 이 통제는
    여전히 자연어 prompt 지시일 뿐이다 — `review_guard.py` (`_BLOCK_LINE` 정규식, 이 게이트가
    push/턴종료를 막는 유일한 기계적 판정자)는 SUMMARY.md 상단의 `BLOCK:` 한 줄만 파싱하고, 그
    값이 각 checker 리포트에 실제로 몇 건의 `[CRITICAL]` 이 있는지와 모순되는지 전혀 대조하지
    않는다. 즉 이 보안 게이트의 최종 집행력은 여전히 "다음 세대의 summary 에이전트가 이번에
    새로 적힌 규약을 어기지 않을 것" 이라는 신뢰에만 의존한다 — 동일 클래스의 실패가 이미 한 번
    실측됐다. 팀 스스로도 이 갭을 인지하고 있다(`plan/in-progress/harness-review-gate-ci-backstop.md`
    "신규 후속 2. 하향 금지 정책에 기계적 backstop 이 없다").
  - 제안: 위 plan 문서가 이미 제안한 기계적 backstop — orchestrator 가 각 checker 산출물의
    `[CRITICAL]` 개수를 세어 최종 `BLOCK:` 값과 모순되면 stderr 경고 + 반환 플래그를 내는
    검증 단계 — 를 이 게이트 자체의 무결성을 위해 우선순위를 올려 구현할 것을 권고한다. 정책
    문서화만으로 끝내면 다음번 downgrade 시도를 막을 수단이 여전히 없다.

- **[INFO]** `_summary_block_is_no` 의 `BLOCK:` 파싱이 문서 전체에서 첫 매치를 신뢰 — 섹션 경계 앵커 없음
  - 위치: `.claude/hooks/_lib/review_guard.py:140` (`_BLOCK_LINE` 정의), `.claude/hooks/_lib/review_guard.py:692-703` (`_summary_block_is_no` 함수)
  - 상세: `_BLOCK_LINE.search(text)` 는 SUMMARY.md 전체 텍스트에서 `BLOCK:\s*(YES|NO)` 의 첫
    매치를 채택한다 — 문서 맨 위 줄이나 특정 헤딩으로 앵커링되어 있지 않다. 같은 파일의 위험도
    파서(`_RISK_LEVEL`, 라인 476-488)는 "`전체 위험도` 헤딩부터 다음 마크다운 헤딩 전까지" 로
    스코프를 명시적으로 제한하는 반면, 이 파서는 그런 경계가 없다. 현재 템플릿상 `BLOCK:` 은
    항상 문서 최상단(타이틀 바로 다음 줄)에 오므로 정상 경로에서는 문제가 없지만, 이번 PR 이
    직접 다루는 사고 사례처럼 summary 에이전트가 템플릿을 벗어나 앞부분에 예시/인용 형태로
    다른 "BLOCK: NO" 문자열을 먼저 적으면(예: 과거 사례를 설명하며 원문을 인용) 실제 최종
    판정보다 그 문자열이 먼저 매치되어 SPEC-CONSISTENCY 게이트(Gate 2, `evaluate_review`
    862-952행)가 오판할 수 있다. 이 함수 자체는 이번 diff 의 직접 수정 대상이 아니지만, 이번
    PR 이 강화하려는 바로 그 게이트가 의존하는 파싱 로직이라 함께 기록한다.
  - 제안: 매칭 범위를 문서 맨 앞 N줄 또는 첫 헤딩 섹션으로 한정해, "문서 어딘가의 첫 BLOCK: 문자열"
    이 아니라 "문서가 선언하는 공식 판정" 만 신뢰하도록 `_RISK_LEVEL` 과 동일한 방식으로 강화.

- **[INFO]** `build_files_section` 의 diff-only 오버플로 분기에 예산 초과 결함이 남아있음 (이번 PR 범위 밖, 이미 추적됨)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `build_files_section` 내 `if base_size >= max_total_size:` 분기 (diff 만으로 예산을 초과하는
    경로)
  - 상세: 이 분기의 절단 루프가 `_truncated_note`/"diff 생략" placeholder 문자열의 길이를 `cut`
    계산에 반영하지 않아 `max_total_size` 를 초과할 수 있다(팀 자체 실측: 동일 fixture 로
    origin/main 판 1,681자 vs cap 1,500자). 이번 PR 은 이 경로를 만들지도, 악화시키지도 않았고
    (오히려 이번에 추가한 안내가 overflow 계산에 포함돼 1,678자로 3바이트 감소), 이미
    `plan/in-progress/harness-review-gate-ci-backstop.md` "신규 후속 1" 로 명시적으로 defer 되어
    있다. 프롬프트 크기 초과는 리뷰 요청 자체의 안정성/가용성에 영향을 줄 수 있어 참고로 기재한다.
  - 제안: 이미 추적 중인 항목이므로 후속 PR 에서 동일 처방(안내문 길이를 절단량에 포함)으로 닫을 것.

## 확인했으나 문제 없음 (참고)

- **in-flight 억제 스코프 축소는 올바르게 구현됨**: `evaluate_review(cwd=None, *, in_flight_ok=False)`
  로 opt-in 화한 뒤(`review_guard.py:862-878`), push 가드(`guard_review_before_push.py` `_run_gates`
  → `_evaluate_over_targets` → `evaluate(target)`)는 여전히 `in_flight_ok` 를 넘기지 않고, Stop
  가드(`guard_review_before_stop.py:344`)만 `in_flight_ok=True` 를 명시적으로 전달한다. grep 으로
  전체 `.claude/hooks/`·`.claude/skills/` 범위에서 다른 production 호출부가 없음을 확인했다.
  이는 "in-flight 리뷰 억제가 push 게이트까지 30분간 열어주던" 실제 게이트 우회 결함의 수정이며,
  seam 테스트(`test_push_never_opts_into_the_in_flight_concession`,
  `test_stop_passes_in_flight_opt_in`)가 반환값이 아니라 실제로 전달된 kwarg 값을 파일에 기록해
  단언하므로 향후 회귀도 검출 가능하다.
- **커맨드 인젝션 없음**: 변경/신설된 모든 `subprocess.run` 호출(`review_guard.py`,
  `guard_review_before_stop.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)이
  `shell=True` 없이 리스트 인자로 실행되고 전부 `timeout` 을 지정한다. `eval`/`exec`/`pickle`/
  `yaml.load`/`os.system`/`shell=True` grep 결과 0건.
  - `consistency_orchestrator.py` 의 신설 `_branch_changed_rels` 가 `f"{diff_base}...HEAD"` 를
    단일 인자로 넘기는데, `diff_base`(CLI `--diff-base`) 가 `-` 로 시작하면 이론상 git 옵션으로
    해석될 여지가 있다 — 다만 이는 같은 파일/`review_guard.py` 전반에 이미 존재하는 기존 패턴과
    동일하고, 이 도구는 로컬 개발자/에이전트가 실행하는 CLI(신뢰 경계 밖 입력이 아님)라 별도
    발견사항으로 올리지 않았다.
- **경로 탐색(path traversal) 없음**: `guard_review_before_stop.py` 의 `_marker_path` /
  `_sanitize_component`(`_MARKER_SAFE = re.compile(r"[^A-Za-z0-9._-]")`)가 `session_id`/branch
  토큰의 `/`, `..` 를 전부 `_` 로 치환해 state 디렉터리 밖으로 벗어날 수 없다
  (`test_marker_path_sanitizes_path_traversal` 로 고정). 이 로직은 이번 diff 의 변경 대상이
  아니지만 관련 경로라 확인했다.
- **하드코딩된 시크릿 없음**: 변경된 6개 `.py`/`.md` 핵심 파일 전체에서 API 키·비밀번호·토큰·
  인증서 패턴 grep 매치 0건.
- **의존성 변경 없음**: 이번 diff 는 `package.json`/`requirements.txt` 등 의존성 매니페스트를
  건드리지 않으며, 신설 코드는 표준 라이브러리(`os`/`re`/`subprocess`/`json`/`time`/`datetime`)만
  사용한다.
- **암호화/해시 관련 코드 없음**: 이번 diff 범위에 해시·암호화 로직이 없어 해당 항목은 적용 대상
  아님.
- **에러 메시지**: `traceback.print_exc(file=sys.stderr)` 는 로컬 세션(같은 신뢰 경계) stderr 로만
  출력되고, 에러 메시지에 담기는 정보는 로컬 파일 경로/예외 텍스트뿐이라 민감정보 노출 우려 없음.

## 요약

이번 diff 는 두 개의 실제 게이트 결함을 고친다 — (1) Stop 전용이어야 할 "리뷰 in-flight 억제"가
`evaluate_review()` 공유로 인해 push 하드게이트까지 30분간 열어주던 결함을 `in_flight_ok` opt-in
kwarg 로 정확히 스코프 축소했고(호출부 grep + 양방향 seam 테스트로 검증됨), (2) consistency
summary 에이전트가 과거 한 차례 규약 없이 Critical 을 임의 하향했던 사고에 대응해 "하향 금지 +
권한 밖 Critical 의 planner 즉시 인계" 규칙을 신설했다. 커맨드 인젝션·경로 탐색·하드코딩된
시크릿·안전하지 않은 역직렬화 등 고전적 인젝션/OWASP 패턴은 신규·기존 코드 전체에서 발견되지
않았고, 신설된 번들 우선순위/생략-안내 로직은 프롬프트 콘텐츠를 재배열·표시할 뿐 신뢰 경계를
넘지 않는다. 유일한 구조적 우려는 (2)의 "하향 금지" 통제가 여전히 순수 prompt 지시일 뿐 게이트
코드 자체의 기계적 대조(BLOCK 값 vs 각 checker 의 실제 [CRITICAL] 개수)가 없다는 점인데, 이는
팀이 이미 별도 plan 항목으로 인지·추적 중인 잔여 갭이며 이번 PR 이 악화시키지 않았다(오히려
prompt 레벨 완화를 추가했다). 그 외 두 건은 이번 PR 범위 밖에서 이미 추적 중인 사소한 참고사항.

## 위험도

LOW
