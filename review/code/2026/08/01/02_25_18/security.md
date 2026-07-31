# Security Review — 2026/08/01 02_25_18 (Round 7)

컨텍스트: 이전 라운드(6R)의 changeset 이 소스 대신 리뷰 산출물을 담아 오구성됐다는 안내에 따라,
이번 라운드를 이 소스에 대한 사실상 첫 정식 보안 리뷰로 취급했다. 프롬프트에 전체 내용이 실리지
않은 대형 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`)은 `Read` 로 직접 열어 확인했고, `origin/main` 대비 실제 diff 도
`git diff origin/main...HEAD -- <해당 17개 파일>` 로 별도 대조했다.

## 발견사항

- **[WARNING]** `code_review_orchestrator.collect_change_infos()` 의 `elif` 우선순위 때문에
  `--branch` 가 `--files` 를 경고 없이 통째로 덮어씀 — 리뷰 게이트의 커버리지 보장을 무력화할 수
  있는 살아있는 경로 (이번 라운드 diff 가 만든 결함은 아니며, 이미 계획 문서에 추적 중)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `collect_change_infos` — 이 파일은 프롬프트에서 크기 제한으로 생략되어 게이트 숫자가 없으므로
    `Read` 로 직접 확인한 실제 소스 줄 번호를 그대로 인용한다: 1235행 `if args.commit:` 부터
    1248행 `elif args.branch:`, 1254행 `elif args.files:` 순서의 `elif` 체인.
    교차 추적: `plan/in-progress/harness-review-gate-ci-backstop.md:94` (항목 #11, "신규 발견
    2026-08-01").
  - 상세: `if args.commit: … elif args.range: … elif args.branch: … elif args.files: …` 순서라,
    호출자가 (positional) 파일 목록과 `--branch` 를 함께 넘기면 `--branch` 분기가 먼저 매치되어
    지정한 파일 목록은 아무 경고 없이 전량 버려지고, changeset 이 `--branch` 기준 diff 로 전부
    교체된다. 문제는 이 조합이 예외적 오용이 아니라 **이 저장소가 스스로 문서화한 표준 절차**라는
    점이다 — "커밋 후 리뷰는 명시 파일 + `--route=all` 이 표준인데, 커밋 이후엔 diff base 를
    맞추려고 `--branch` 를 함께 줘야 한다"(같은 plan 문서 §결정이 필요한 지점). plan 문서는 바로 그
    조합에서 실제로 발현한 사고를 실측으로 남기고 있다: `meta.json` 상 파일 수가
    `--prepare --files A B` → 2(그대로) 인데 `--prepare --branch origin/main --files A B` →
    44(전부 `review/**`, 지정 목록 폐기)로 바뀌었고, 이 방식으로 준비된 세션에서 리뷰어 14명 전원이
    실제 변경 소스를 한 줄도 못 본 채 "Critical 0"을 반환했다. 이는 이 PR 이 강화하려는 대상인
    "리뷰가 실제로 코드를 봤는지"를 판정하는 게이트(`review_guard.evaluate_review`, `_shared/
    block_integrity.py`)가 전제하는 "changeset = 실제 변경분"이라는 가정을 조용히 깨는 경로다.
  - 제안: plan 문서 §11 에 이미 적힌 최소 조치 — 두 옵션이 함께 오면 `--files` 를 우선하고
    무시되는 쪽을 stderr 로 경고 — 를 이 결함의 실제 파급력(게이트 무력화)을 근거로 우선순위를
    올려 반영. 새 조치를 요구하는 것이 아니라, 이번 라운드가 바로 이 게이트 코드를 다루는 만큼
    같은 세션에서 함께 닫는 것을 권장한다는 취지.

- **[INFO]** 다운그레이드 알림 중복 억제에 SHA-1 사용 — 비-암호화 용도라 실질 위험 없음
  - 위치: `.claude/hooks/guard_review_before_stop.py:31` (`import hashlib`),
    `.claude/hooks/guard_review_before_stop.py:381`
    (`digest = hashlib.sha1(note.encode("utf-8")).hexdigest()[:12]`).
  - 상세: `consistency-summary` 의 BLOCK 하향 모순 advisory 텍스트를 해시해, 같은 문구가 턴마다
    반복 출력되지 않도록 마커 파일명(`note<digest>`)을 만드는 데만 쓰인다. SHA-1 은 충돌 저항이
    약해 서명·비밀번호 해시·무결성 검증 등 보안 경계에는 부적합하지만, 여기서는 신뢰 경계를 넘는
    인증·무결성 판단에 전혀 관여하지 않는 로컬 중복 제거 키다. 충돌이 나도 최악의 결과는 서로 다른
    경고 문구 하나가 한 턴 늦게 출력되는 정도.
  - 제안: 현재 용도로는 조치 불필요. 이 값이 향후 신뢰 경계(외부 입력 검증 등)로 재사용될 계획이
    생기면 그때 `hashlib.sha256` 로 교체 검토.

- **[INFO]** git 서브프로세스 인자에 사용자 지정 ref/브랜치명을 f-string 으로 이어붙임 — 이론상
  git 자체의 옵션 인젝션 여지가 있으나 신뢰 경계를 넘지 않아 실질 위험 없음
  - 위치(대표 예시): `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
    함수 `get_git_branch_diff_files`/`get_git_branch_diff` (`f"{branch}..."`);
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수
    `_branch_changed_rels`/`_collect_code_diff` (`f"{diff_base}...HEAD"`);
    `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` 함수
    `branch_diff_stat`/`resolve_branch`.
  - 상세: `--branch`/`--diff-base`/`--base-hint`/브랜치명 등 CLI 로 받은 문자열이 `-` 로 시작하면
    `git` 이 그 토큰을 revision 이 아니라 옵션(예: `git diff` 의 `--output=<path>`)으로 해석할
    이론적 여지가 있다. `subprocess.run` 은 전부 리스트 인자(`shell=True` 전무)라 셸 인젝션은
    없지만, git 자신의 인자 파서 단계에서의 옵션-주입은 별개 문제다. 다만 이 값들은 전부 이 CLI
    도구를 실행하는 사람/에이전트 본인이 로컬에서 직접 지정하는 인자이고, 원격·미신뢰 입력이 이
    경로로 흘러들어오는 지점이 없어(같은 신뢰 수준의 동일 행위자) 실질적 악용 시나리오는 없다.
  - 제안: 방어적 코딩 차원에서 아쉬우면 ref 인자 앞에 `--` 구분자를 추가하거나 `-` 로 시작하는
    값을 거부할 수 있으나, 현재 위험도상 시급하지 않음.

- **[INFO]** `merge_coordinator_orchestrator.py` 가 `gh pr view` 로 얻은 PR 제목/브랜치명을 검증
  없이 analyzer 프롬프트에 그대로 삽입 — LLM 프롬프트 인젝션 표면 (이번 라운드 변경 아님, 이
  도구의 근본 설계)
  - 위치: 함수 `format_branches_section`(PR title 삽입), `build_analyzer_prompt`.
  - 상세: 외부 기여자가 지정한 PR 제목/브랜치 이름이 그대로 analyzer sub-agent 프롬프트 본문에
    섞여 들어간다. 악의적 제목·브랜치명으로 checker LLM 의 판단을 흔드는 prompt injection 시도가
    이론상 가능하다. 다만 이는 diff 내용(리뷰 대상 코드) 자체도 동일한 신뢰 수준으로 LLM 에
    전달되는 이 도구의 근본 설계이며 이번 PR 이 새로 만든 표면이 아니다.
  - 제안: 별도 조치는 불요(design trade-off). 다만 이번 PR 이 "checker 리포트의 `[CRITICAL]` 태그를
    기계적으로 신뢰해 게이트 판정에 반영"하는 `_shared/block_integrity.py` 를 도입해 리포트 내용의
    기계적 신뢰 비중이 커지는 만큼, "그 리포트 자체가 조작된 입력의 영향을 받을 수 있는가"는 향후
    이 계열 기능을 확장할 때 함께 재검토할 가치가 있다는 점만 기록.

## 검토했으나 문제없음으로 확인한 항목 (참고)

- **커맨드 인젝션 전반**: 이번 라운드 diff 및 전체 대상 17개 파일에서 `subprocess` 호출은 예외
  없이 리스트 인자 방식이었고 `shell=True` / `os.system` / `os.popen` 은 전무했다(grep 확인).
- **위험한 역직렬화·코드 실행**: `eval`/`exec`/`pickle`/`marshal`/`yaml.load` 사용 없음.
- **하드코딩 시크릿**: API 키·비밀번호·토큰 패턴 grep 결과 없음.
- **새 핵심 기능(`_shared/block_integrity.py`, BLOCK 하향 모순 backstop)**: 순수 텍스트 파싱
  (정규식 매칭 + 카운팅)만 수행하며 파일 시스템 쓰기·외부 프로세스 호출이 없다. 새 정규식
  (`_CRITICAL_TAG`, `_BLOCK_AT_LINE_START`, `_BLOCK_AT_LINE_END`)은 중첩 정량자나 모호한
  교차-일치 구간이 없어 치명적 백트래킹(ReDoS) 패턴은 아니다. 이 기능은 차단이 아니라 advisory
  (`notes`)만 추가하므로 기존 게이트를 더 관대하게(bypass 방향으로) 바꾸지 않는다 — 오히려 이전엔
  전혀 감지되지 않던 "checker 의 `[CRITICAL]` 을 SUMMARY 가 조용히 하향"하는 사례(측정: 732개 중
  24건, 3.3%)를 처음으로 표면화하는 보안 강화 성격의 변경이다.
  - `.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_push.py`,
    `.claude/hooks/guard_review_before_stop.py` 에 대한 diff(각각 `notes` 필드/advisory 배선
    추가)도 같은 성격 — 차단 로직(Gate 1/Gate 2, `push_blocks`) 자체는 손대지 않고 advisory 출력
    경로만 추가했다. 스트림 선택(exit code 별 stdout/stderr, Stop 훅의 JSON 프로토콜 보존)도
    올바르게 분리돼 있어 새로 도입된 코드가 기존 fail-open/차단 흐름을 훼손하지 않는다.
  - `evaluate_review(cwd, *, in_flight_ok=False)` 의 opt-in 화(과거 "SUMMARY pending 세션이 push
    까지 열어주던" 결함의 수정)는 이미 `origin/main` 에 존재함을 `git show origin/main:… | grep
    in_flight_ok` 로 확인 — 이번 라운드가 새로 만든 것이 아니다.
- **상태 관리 리팩터(`_shared/retry_state.py`)**: 두 orchestrator 의 중복 함수를 추출한 것으로,
  커밋 메시지의 AST 비교 주장 + `test_retry_state_shared.py`/`test_consistency_orchestrator_
  state.py` 로 동작 보존이 뒷받침된다. 원자적 쓰기(`os.replace`)는 그대로 유지, 파일 권한·경로
  구성 모두 로컬 신뢰 경계 내에서만 동작한다.

## 요약

이번 라운드(7R)의 실제 diff 핵심은 (1) checker 의 `[CRITICAL]` 태그와 SUMMARY 의 `BLOCK:` 판정이
모순될 때 경고하는 새 backstop(`_shared/block_integrity.py`) 도입과 (2) 두 orchestrator 에
중복돼 있던 상태 관리 함수 5종을 `_shared/retry_state.py` 로 추출하는 리팩터이며, 둘 다 기존
차단/허용 로직을 바꾸지 않고 advisory 만 추가하거나 동작 보존 리팩터라는 점이 diff·테스트로
뒷받침된다. 커맨드 인젝션, 하드코딩 시크릿, 안전하지 않은 역직렬화, 인증/인가 우회는 발견되지
않았다. 다만 이 PR 이 강화하는 "리뷰 게이트" 인접 코드에 이미 추적 중인 실질적 결함
(`collect_change_infos` 의 `--branch`/`--files` 우선순위 충돌, 게이트 커버리지 보장을 조용히
깨뜨릴 수 있는 경로, plan 문서 #11)이 여전히 살아 있어 WARNING 으로 별도 기록했다 — 이번 diff가
만든 결함은 아니지만 이번 PR 의 주제와 직결되므로 같은 세션에서 우선순위를 올려 닫을 것을
권장한다. 그 외 SHA-1 의 비-암호화 용도, git 서브프로세스 인자 구성, LLM 프롬프트 삽입에 대한
관찰은 신뢰 경계를 넘지 않아 정보성으로만 기록했다.

## 위험도

LOW
