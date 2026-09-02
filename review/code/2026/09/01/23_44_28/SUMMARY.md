# Code Review 통합 보고서

## 전체 위험도
**NONE** — 8개 reviewer(전원 forced whitelist, 전원 결과 확보) 모두 CRITICAL/WARNING 0건으로 수렴. 이 changeset 은 이미 4라운드의 fix→review 사이클을 거친 harness 위생 정리(누적 diff 125파일, 실질 코드 변경은 6~8개 파일)이며, 5번째 독립 재검증에서도 새 결함이 발견되지 않았다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / requirement | 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 `spec-impl-evidence.md §4.2` SoT 표에 미등재 — 4라운드 연속 재확인된 의도적 유예(사유: 이 PR 의 spec 축 이미 과다 번들과 상충). 재개 신호가 `plan/in-progress/harness-review-gate-followups.md:174-181` 에 명시 | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규) / `spec/conventions/spec-impl-evidence.md §4.2` | 조치 불요. 다음 harness 가드 추가 시 함께 등재 |
| 2 | side_effect / maintainability | `plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` blockquote 비대칭 카운팅 확장을, 같은 목적의 독립 셸 스크립트(`plan-stale-audit.sh`)가 받지 않아 두 SoT 간 진행률 신호 drift 가 한 단계 더 벌어짐 | `.claude/hooks/_lib/plan_guard.py:95,98` vs `.claude/tools/plan-stale-audit.sh:123-125` | 조치 불요(이전 라운드에 이미 범위 밖으로 등재, 검증 표면 없는 셸 정규식은 이번 PR 에서 안 고침) — 참고 기록만 |
| 3 | testing | `plan_guard.py` 체크박스 스캐너가 코드펜스를 건너뛰지 않는 pre-existing 특성 위에, 이번 PR 이 정규식을 blockquote 까지 넓혀 blast radius 가 소폭 커짐. 대칭 테스트 케이스 없음 | `.claude/hooks/_lib/plan_guard.py` `_all_checkboxes_done()` / `.claude/tests/test_plan_guard.py` | 급하지 않음. `spec-links.test.ts` 의 코드펜스 fixture 와 대칭되는 케이스 하나 추가 권장 |
| 4 | testing | `tree-walk.ts` 의 `readonly string[]` 타입 수정을 잠그는 회귀 테스트 없음 — frontend `__tests__/` 디렉터리가 어떤 CI 게이트에서도 typecheck 되지 않아 재퇴행을 못 잡음(근본 원인) | `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:67-73` | 새 조치 불요 — `harness-review-gate-followups.md:192-194` 에 이미 트래킹 중 |
| 5 | maintainability | `_QUOTED = re.compile(r">")` 는 단일 문자 포함 검사에 정규식 컴파일이라는 불필요한 간접 계층 | `.claude/hooks/_lib/plan_guard.py` | `elif ">" not in m.group("quote"):` 로 단순화 가능. 차단 사유 아님 |
| 6 | user_guide_sync | `error-codes.ts` 변경이 `new-error-code` trigger glob 과 파일 경로 단위로 매칭되나, 실제 diff 는 JSDoc 주석뿐(enum 멤버 변경 0건)이라 매트릭스의 의미 조건("enum 추가")을 충족하지 않는 false-positive 근접 사례 | `codebase/backend/src/nodes/core/error-codes.ts` / `.claude/config/doc-sync-matrix.json` `new-error-code` 행 | 조치 불요 — 관측 기록. 실제 enum 멤버 추가 시 `backend-labels.ts` `ERROR_KO` 갱신 재검토 |

## SPEC-DRIFT

없음 (`[SPEC-DRIFT]` 태그된 발견사항 없음).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드는 `plan_guard.py`(선형 정규식, ReDoS 없음)와 `stray-tool-tags.test.ts`(격리된 tmpdir fixture, 저장소는 읽기 전용)뿐. 하드코딩 시크릿 0건, 인증/인가·DB·암호화 경로 미접촉 |
| requirement | LOW | 실 코드 표면 8개 파일로 좁음. 실측(파일 수 505/386, `EngineErrorCode` 사용처 등) 전수 재현해 spec 서술과 일치 확인. 유일 잔여 INFO(SoT 미등재)는 4라운드 연속 확인된 유예 |
| scope | NONE | 4R diff(커밋 `7829dbd61`)는 직전 라운드가 지적한 4가지에만 정확히 대응, 무관한 리팩토링/기능확장/설정변경 없음 |
| side_effect | LOW | `_CHECKBOX` 확장의 blast radius 는 Stop 소프트 넛지로 국한(push 하드블록과 무관, 두 소비자 파일 직접 확인). `walkTree` readonly 확장은 공변 widening, 파괴적 변경 없음 |
| maintainability | NONE | 실질 6개 코드 파일은 이미 4라운드 다듬어짐. 함수 짧고 중첩 얕음, 중복은 공유 헬퍼로 흡수됨 |
| testing | LOW | 비대칭 카운팅 양방향 회귀 테스트로 봉인. 새 CRITICAL/WARNING 급 테스트 갭 없음, 남은 2건은 INFO |
| documentation | NONE | 4R 이 고친 stale 줄번호 인용·SoT 유예 등재·실측 오기 정정이 전부 정확히 반영됨을 직접 재현 확인 |
| user_guide_sync | NONE | 매트릭스 20개 trigger 중 파일경로 매칭 1건(`new-error-code`)뿐이며 semantic 조건(enum 추가) 미충족 — INFO 1건만 |

## 발견 없는 에이전트

security, scope, maintainability, documentation, user_guide_sync (CRITICAL/WARNING/INFO 어느 등급도 신규 발견 없음 — documentation/user_guide_sync 는 INFO 1건씩 관측 기록 있으나 조치 불요로 위 표에 포함)

## 권장 조치사항

1. (선택, 급하지 않음) `plan_guard.py` 코드펜스 안 체크박스에 대한 대칭 테스트 케이스 1건 추가 — `spec-links.test.ts` 의 코드펜스 fixture 패턴을 따라.
2. (선택) `_QUOTED = re.compile(r">")` 를 `">" in m.group("quote")` 문자열 검사로 단순화.
3. 기존 트래킹 항목 유지: `stray-tool-tags.test.ts` 의 `spec-impl-evidence.md §4.2` 미등재, frontend `__tests__/` typecheck 게이트 부재, `plan-stale-audit.sh` drift — 모두 `harness-review-gate-followups.md` 에 재개 신호와 함께 등재된 상태로 이번 PR 범위 밖 유지.
4. Critical/Warning 이 없으므로 즉시 차단할 조치 없음. resolution-applier fix 단계는 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset(harness 위생·정규식 확장·테스트 가드)과 관련성 낮음 |
  | architecture | 실질 아키텍처 변경 없음(단일 함수 정규식 확장, 신규 테스트 파일) |
  | dependency | package.json/lockfile 변경 없음 |
  | database | DB 접근 코드 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | api_contract | API 계약 변경 없음(JSDoc 주석만, enum 멤버 변경 없음) |