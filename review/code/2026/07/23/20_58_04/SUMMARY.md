# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 핵심 diff(`guard_default_branch_bash.py` 세그먼트 분류기 확장 + §J 주석 재배치)는 3라운드 검증을 거쳐 안전이 확인됐으나, security/requirement 리뷰가 공통 재확인한 기존 CRITICAL 결함(`guard_review_before_push.py` 의 `_GIT_PUSH` 가 따옴표+공백 포함 `VAR=value` 접두에서 `git push` 탐지에 실패해 mandatory review-before-push 게이트 전체가 배너 없이 조용히 우회됨)이 여전히 HEAD 에 미해결 상태로 남아 있다. 이 diff 가 만든 결함은 아니고 plan §J 별건 PR("차단성, 최우선")로 투명하게 스코프 아웃된 상태이지만, 라이브 코드의 실질적 게이트 우회이므로 전체 위험도를 CRITICAL 로 유지해 후속 조치를 압박한다.

## 라우터·강제 이행 상태 (상단 고지)
- `routing_status=done`. forced(router_safety) 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원이 성공(success) 상태로 실행되었고, 인라인 전문이 7건 모두 authoritative 로 확보됨 — **누락 없음**.
- 아래 CRITICAL 은 forced whitelist 미이행이 아니라, forced reviewer(security/requirement)가 정상적으로 실행되어 스스로 보고한 기존(旣知) 결함이다. "강제 목록 결과 없음"에 해당하는 항목은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `guard_review_before_push.py` 의 `_GIT_PUSH` blind 정규식이 따옴표+공백 포함 `VAR=value` 접두(예: `GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main`, `GIT_AUTHOR_NAME="John Doe" git push --force origin main`)에서 push 탐지에 완전히 실패해, `main()` 이 배너·카운터 증가 없이 곧바로 `return 0` 하며 mandatory review-before-push 게이트 전체를 조용히 우회한다. security·requirement 양쪽이 직접 재현으로 확인(3라운드 연속). | `.claude/hooks/guard_review_before_push.py:107-109`(`_GIT_PUSH`), `:534`(`_is_git_push` 호출부); 추적: `plan/in-progress/harness-guard-followups.md` §J(체크리스트 미완료) | plan §J 별건 PR을 지체 없이 착수 — `_GIT_PUSH` env 값 부분을 `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)` 로 확장하고 `test_push_guard_allowlist.py` byte-for-byte 핀 갱신·차등 코퍼스 확장·뮤테이션 검증을 동반. testing 리뷰의 캐너리 테스트(아래 WARNING #1) 를 선행 추가하면 수정 검증이 쉬워짐. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | Critical #1(§J 게이트 우회)에 대해 관측용 회귀 테스트가 전혀 없다(`test_push_guard_allowlist.py` 내 §J/SSH_COMMAND 관련 케이스 0건). 정규식 수정 자체는 별건 PR로 미루는 것이 타당하나, 현재의 버그 동작을 캐너리로 고정하는 테스트 부재는 별개 문제 — 없으면 (a) 무관한 리팩터가 우회 폭을 더 넓히거나 좁혀도 스위트가 알 수 없고, (b) 별건 PR에서 실제 수정 검증이 전부 수작업에 의존한다. | `.claude/hooks/guard_review_before_push.py:96-109`; 테스트 갭 `.claude/tests/test_push_guard_allowlist.py` | `KnownGapTest` 류로 `self.assertFalse(guard._is_git_push('GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main'))` 를 §J 참조 주석과 함께 추가 — §J 수정 PR에서 이 assertion 을 뒤집는 것으로 "고쳐졌음"을 테스트가 직접 증명하게 함. `_GIT_PUSH` 패턴·차등 코퍼스는 건드리지 않으므로 별건 연기 판단과 충돌하지 않음. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `guard_default_branch_bash.py` 의 세그먼트 분할·`VAR=value`(따옴표 값 포함) 3-way alternation 확장 — ReDoS 없음(첫 글자 배타적 대안, 비-중첩 정규식). 20만 문자급 적대적 입력 서브프로세스+timeout 검증 통과, 구조 불변. | `.claude/hooks/guard_default_branch_bash.py` (`_MUTATING`, `_SEGMENT_SPLIT`, `_is_mutating`) | 조치 불필요 |
| 2 | 보안/부작용 | `_is_mutating` 은 차단 권한 없는 순수 advisory nudge(세션당 1회 stdout reminder)이며, 실제 차단은 `guard_default_branch_edit.py`/`pre-commit` 이 담당 — 인용 무시·간접 실행 미분류 한계는 인정된 것이고 악용 이득 없음. 세그먼트 분할이 인용을 모름(인용된 구분자, heredoc 본문)과 단일 `&` 신규 구분자는 두 가지 오탐 클래스를 열지만 `AcknowledgedFalsePositiveTest`로 명시 pin, `2>&1`/`&>` 리다이렉션 관용구에서 새 오탐 미발생(실측 확인). | `.claude/hooks/guard_default_branch_bash.py:149-157` | 조치 불필요 |
| 3 | 스코프 | `test_line_anchors.py` 의 `_pick_commit_fixture` 신설(HEAD 결속 제거)은 원 작업 주제(bash 넛지 세그먼트 FN)와 다른 서브시스템(리뷰 프롬프트 line-gutter 조립 테스트)이나, 이 diff 자신이 만든 회귀(§J 3R RESOLUTION W3)를 스스로 봉합한 것으로 정당성 있고 뮤테이션 검증 완료. | `.claude/tests/test_line_anchors.py` (`_pick_commit_fixture`, 커밋 `37fcfc494`) | 조치 불필요(참고 기록). docstring "Deliberately NOT HEAD" 문구가 실제로는 "HEAD 여부 무관, 임계값 만족 최근 커밋 선택(우연히 HEAD 일 수도)"이므로 문구를 "not hard-coded to HEAD"로 명확화 고려(낮은 우선순위). |
| 4 | 테스트 | CI(`actions/checkout@v7`, fetch-depth 미명시)의 얕은 클론에서는 `_pick_commit_fixture` 의 40커밋 탐색이 커밋 1개로 사실상 축소됨 — 회귀는 아님(shallow-root 커밋은 부모 없어 numstat 총합이 임계값을 가볍게 넘어 통과). | `.claude/tests/test_line_anchors.py:332-359` | 조치 불필요. docstring 에 "CI shallow clone 에서는 탐색이 단일 커밋으로 축소됨" 한 줄 추가 고려(낮은 우선순위). |
| 5 | 테스트 | `guard_default_branch_bash.py::main()`(세션당 1회 dedup, payload 파싱, `BYPASS_DEFAULT_BRANCH_GUARD` 처리)에 대한 오케스트레이션 레벨 테스트가 여전히 0건 — 2R 지적, 3R 에서 "이 PR 스코프는 분류기다"로 명시적 연기(타당). | `.claude/hooks/guard_default_branch_bash.py:160-227` | 별건 백로그로 `main()` 레벨 테스트(실프로세스+스텁 stdin) 추가 유지. |
| 6 | 유지보수성 | `_MUTATING` 정의 앞 주석 블록이 코드 대비 길다(~30줄 근거 vs ~20줄 정규식). 하우스 스타일(근거를 코드 옆에 남김)과 일관되나 신규 독자 진입 비용 존재. `_is_mutating` 이 세그먼트별 반복 매치로 바뀐 사실이 함수명만으로는 드러나지 않음(docstring 부재, 3줄 함수). | `.claude/hooks/guard_default_branch_bash.py:69-98, 152-157` | 조치 불필요. 향후 유사 주석 3번째 추가 시 정규식 직전 "무엇을 매치하는가" 요약 한 줄 고려. `_is_mutating` 에 한 줄 docstring 고려. |
| 7 | 유지보수성 | `BacktrackingTest._PROBE` 가 subprocess 실행용 Python 코드를 삼중따옴표 문자열로 인라인 — 문법 오류가 정적 검사로 안 잡히고 실행 시점에만 드러남. ReDoS 회귀를 시그널-안전하게 검증하려는 기존 관례(push 가드 계열에도 이미 있음)로 새 패턴 아님. | `.claude/tests/test_guard_default_branch_bash_mutating.py:218-232` | 조치 불필요(기존 관례). 여러 훅에서 반복되면 공통 헬퍼 추출 고려. |
| 8 | requirement | spec fidelity — `spec/`(제품 스펙) 은 이번 변경과 무관. 유일한 관련 "spec"인 `.claude/docs/worktree-policy.md` §5(구분자 6종 서술)는 코드·테스트와 line-level 로 완전히 일치. | `.claude/docs/worktree-policy.md:73` | 조치 불필요 |
| 9 | documentation | 이전 2라운드 documentation 지적사항(모듈 docstring 미언급, 정책 문서 구분자 5→6종 누락, §J 주석 오지정, plan Overview stale 카운트, 재현 불가능한 "프로브 8건" 서술, docstring 문법 오류) 전부 현재 HEAD 상태에서 실측 재검증 완료 — 신규 문서화 결함 없음. | `.claude/hooks/guard_default_branch_bash.py` docstring, `.claude/docs/worktree-policy.md:73`, `.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md` | 조치 불필요 |
| 10 | 스코프 | §J plan 신설(`harness-guard-followups.md`)과 `guard_review_before_push.py` 주석 3곳은 원 작업 도중 파생 발견된 것을 "발견→plan 기록→코드는 별건 PR로 defer"라는 표준 패턴으로 정확히 처리 — `_GIT_PUSH` 정규식·`test_push_guard_allowlist.py` 핀은 이번 diff 에서 미변경(실측 확인). | `plan/in-progress/harness-guard-followups.md` §J, `.claude/hooks/guard_review_before_push.py` 주석 | 조치 불필요 |
| 11 | 스코프 | 누적 diff 1825줄 중 실제 실행 코드 변경은 `guard_default_branch_bash.py`(+72/-15) 1개 파일뿐, 나머지 대부분(~1000줄)은 이전 2회 리뷰 라운드의 SUMMARY/RESOLUTION/reviewer 산출물 — 정상적인 감사 추적(audit trail) 커밋. | `review/code/2026/07/23/{20_02_29,20_33_56}/*` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | §J `_GIT_PUSH` 따옴표 env-prefix 우회로 review-before-push 게이트 전체 조용히 우회(재현 확인, 3라운드 연속). `guard_default_branch_bash.py` 는 ReDoS·인젝션 관점에서 안전 재확인. |
| requirement | LOW | 이전 라운드 WARNING 3건 전부 해소 검증(47 passed, 회귀 없음). §J 는 기존 결함으로 스코프 타당하게 별건 위임 확인, 최종 SUMMARY 에는 상태 명시 필요. |
| scope | LOW | 핵심 로직 변경은 `guard_default_branch_bash.py` 1개 파일로 국한. `test_line_anchors.py`/§J 문서는 자기 유발 회귀 봉합·표준 defer 패턴으로 스코프 침범 아님. |
| side_effect | LOW | `_is_mutating` 은 차단 없는 soft nudge로 부작용 반경 구조적으로 좁음. `guard_review_before_push.py` 는 주석만 변경, 실행 경로 부작용 없음. |
| maintainability | LOW | 핵심 로직은 짧고 읽기 쉬운 함수로 국한, 설계 근거 3중 기록(주석/plan/테스트). 이전 라운드 결함(주석 위치, drift, HEAD 결속) 전부 해소 확인. |
| testing | LOW | 핵심 분류기 테스트 0→13건, 직접 실행 검증 완료. §J 캐너리 테스트 부재(WARNING #1)만 유일한 실질 갭. |
| documentation | NONE | 3라운드 자기수정 이력 전부 실측 재검증, 신규 문서화 결함 없음. |

## 발견 없는 에이전트
- documentation (NONE — 신규 결함 없음, 이전 라운드 지적사항 전부 해소 검증)

## 권장 조치사항
1. **[최우선]** plan §J 별건 PR 착수 — `guard_review_before_push.py::_GIT_PUSH` 를 따옴표+공백 포함 `VAR=value` 접두를 인식하도록 확장(`(?:'[^']*'|"[^"]*"|[^\s'"]\S*)`), `test_push_guard_allowlist.py` byte-for-byte 핀 갱신 + 차등 코퍼스 확장 + 뮤테이션 검증 동반.
2. §J 수정 PR 착수 전이라도, 현재 버그 동작을 관측하는 캐너리 테스트(`assertFalse(_is_git_push('GIT_SSH_COMMAND="..." git push ...'))`)를 `test_push_guard_allowlist.py` 에 선제 추가해 회귀 방지 및 향후 수정 검증 기준선 확보.
3. (낮은 우선순위) `_pick_commit_fixture` docstring 에 CI shallow-clone 뉘앙스 및 "not hard-coded to HEAD" 문구 정정 반영.
4. (낮은 우선순위, 별건 백로그) `guard_default_branch_bash.py::main()` 오케스트레이션 레벨(세션 dedup, payload 파싱) 테스트 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 forced, 결과 확보 완료)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(훅 정규식·분류기 로직)와 낮은 관련성 |
  | architecture | router 판단상 이번 diff 와 낮은 관련성 |
  | dependency | 신규 의존성 변경 없음 |
  | database | DB 관련 변경 없음 |
  | concurrency | 동시성 관련 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 최종 사용자 가이드 대상 변경 없음(내부 하네스 훅) |