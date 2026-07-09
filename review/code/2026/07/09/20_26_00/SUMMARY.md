# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 unit 가드(`e2e-no-sub-global-timeout.test.ts`)는 기능적으로 완전히 구현·검증(11/11 통과, `e2e/**` 전수 위반 0건)되었으나, 가드 자체의 자기 검증(self-test) 신뢰성과 코드 가독성에 관한 WARNING 3건이 있다. 동반된 `execution-engine.service.spec.ts` 1줄 수정(`service`→`svcMetrics`)은 모든 리뷰어가 공통 확인한 바, 이번 태스크와 무관하지만 정당한 사유(사전 존재 `ReferenceError` 회귀 수정, #868)를 가진 의도적 동반 수정이다.

> 참고: 리뷰 세션 산출 디렉터리에 `security.md`·`scope.md`·`side_effect.md`·`testing.md` 4개 파일이 write 되지 않은 상태로 확인되어(harness 의 알려진 write-vs-status 갭 — MEMORY "Workflow subagent success인데 output파일 부재"), 세션 journal(`~/.claude/projects/.../subagents/workflows/wf_41522d27-75c/journal.jsonl`)에서 해당 4개 reviewer 의 실제 결과를 복원해 본 요약에 반영했다. 내용 손실 없음. 또한 `SUMMARY.md` 자체도 본 세션에서는 disk write 가 harness 에 의해 차단(`write_blocked`)되어, 호출자가 아래 전문을 멱등 Write 해야 한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Testing | 프로덕션 검출 로직(`findSubGlobalTimeouts`)과 self-test 로직(`scanLine`)이 각각 독립 재구현되어 drift 위험 — 프로덕션 쪽 임계값 비교(`v < global` 등)를 바꿔도 self-test 가 그 변경을 감지하지 못한다. testing 리뷰어도 별도로 "self-test 가 실제 파일 탐색 파이프라인 전체가 아닌 정규식 로직만 재검증한다"고 동일 근본 문제를 지적 — 두 리뷰어 발견을 통합 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` (`findSubGlobalTimeouts` 모듈 최상위 vs `scanLine`, `describe("검출 로직 true/false positives")` 내부) | 라인 단위 판정 로직을 `matchSubGlobalTimeoutsInLine(line, global): number[]` 같은 단일 헬퍼로 추출해 프로덕션 함수와 self-test 양쪽이 공유하도록 리팩터링. 여력이 되면 `fs.mkdtempSync` 기반 fixture 로 파일 탐색 파이프라인 전체를 검증하는 end-to-end self-test 추가 |
| 2 | Maintainability | 주석 의도와 실제 동작이 어긋나는 템플릿 리터럴(오도하는 코드) — 메인 `it(...)` 타이틀의 `${...}` 보간부는 "표시용 — 실패 메시지에 전역값 노출"이라 주석돼 있지만 실제로는 `GLOBAL` 변수가 아닌 고정 문자열 `"parsed from playwright.config.ts"` 만 보간해, 실패 시에도 실제 전역 timeout 숫자는 타이틀에 노출되지 않는다 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` 메인 `it(...)` 타이틀 | `` `...(${GLOBAL})` `` 로 실제 값을 보간하거나, 값 노출이 불필요하면 트릭 없는 평범한 정적 문자열로 단순화 |
| 3 | Requirement | `TIMEOUT_LITERAL` 정규식이 `timeout:` 앞 word-boundary 가 없어 향후 오탐 가능성(현재는 미발현, `e2e/**` 전수 확인 결과 위반 0건) — 대소문자 구분이라 `retryTimeout:` 류는 안 걸리지만 소문자로 끝나는 무관 키나 서술형 주석(`// timeout: 3000 이었으나 ...`)도 라인 단위로 그대로 매칭 대상 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:31` `const TIMEOUT_LITERAL = /timeout:\s*(\d[\d_]*)\b/g;` | 당장 조치 불필요(과탐이 누락보다 CI 차단 목적상 안전). 향후 오탐 사례 발생 시 `{`/`}` 옵션 객체 컨텍스트로 좁히거나 주석 라인 스킵 로직 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope / Requirement / Documentation / Security / Side-effect / Testing (6개 리뷰어 공통 확인) | `execution-engine.service.spec.ts` 의 `service`→`svcMetrics` 1줄 수정은 이번 e2e timeout 가드 작업과 무관한 pre-existing 버그(#868 회귀로 유입된 `ReferenceError: service is not defined`) 수정 — 별도 커밋(`7887bfb93`)으로 최소 격리, 커밋 메시지가 "브랜치 e2e 가드 작업과 무관한 pre-existing 결함이나 TEST WORKFLOW(unit)를 막아 함께 조치"라고 명시적으로 disclose. 여러 리뷰어가 직접 재현 검증(`reentryWorkflowInput` 타겟 실행 2/2 통과, 전체 스펙 378/378 통과) | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:17005` (`NF-OB-07 BusinessMetrics 동작` describe 내부) | 조치 불필요(이미 올바름). PR 본문/커밋 메시지에 "이 changeset 은 가드 기능 + 무관한 선행 결함 수정의 2개 독립 커밋으로 구성"을 한 줄 명시해 리뷰어 diff 범위 혼선만 방지 |
| 2 | Testing / Requirement / Documentation | 정규식 기반 가드의 오탐·미탐 경계 케이스 미검증 — 주석/문자열 내 우연한 `timeout: N` 오탐(self-test 미포함), 멀티라인 포맷(`timeout:` 과 숫자가 다른 줄) 미탐지, `timeout : N`(콜론 앞 공백) 등 비정형 포맷 미탐지가 docstring 에 전제로 명시되지 않음 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` (`TIMEOUT_LITERAL`, `findSubGlobalTimeouts`, 파일 헤더 JSDoc) | 우선순위 낮음. self-test 에 "주석 안 timeout 무시" 케이스 추가, 또는 docstring/인접 주석에 "Prettier 표준 포맷(콜론 앞 공백 없음, 단일 라인) 전제" 한 구절 추가 |
| 3 | Documentation | 신규 가드(`e2e-no-sub-global-timeout.test.ts`)가 PROJECT.md 의 "자동 가드(build-time 차단)" 목록 표에는 등록되지 않고 e2e 작성 패턴 절 본문에만 언급됨(`test_doc_sync_matrix.py` 검증 대상은 아니라 하네스는 통과) | `PROJECT.md` §e2e 테스트 작성 가이드 / §자동 가드 목록 | 사소한 일관성 이슈, 차단 사유 아님 — 표에 항목 추가 권장 |
| 4 | Maintainability | 근거 주석 없는 매직 넘버 — `expect(collectE2eFiles().length).toBeGreaterThan(10)` 에서 왜 10인지 설명 부재 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` | 짧은 인라인 주석("e2e 스펙 최소 예상 개수") 추가 또는 named constant 로 추출 |
| 5 | Requirement | `readGlobalExpectTimeout` 의 `[^}]*` 는 `expect` 블록 내부에 `timeout` 보다 앞서는 중첩 객체 키가 추가되면 매칭 실패 가능 — 다만 명시적 `throw` 로 fail-closed 하도록 설계되어 있어 silent fail-open 이 아닌 안전한 방향 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts:41` | 조치 불필요, 참고로만 기록 |
| 6 | Requirement | 규칙이 positive/negative assertion(`.not.toBeVisible` 등)을 구분하지 않고 무차별 차단 — PROJECT.md 문구도 이 구분을 언급하지 않아 코드-스펙 불일치는 아닌 설계상 트레이드오프 | `PROJECT.md` §Frontend e2e 패턴 / 가드 코드 전체 | 조치 불필요. 향후 negative-assertion 용 짧은 timeout 필요성이 실제 발생하면 `project-planner` 경유로 PROJECT.md 예외 문구 + 가드 스킵 로직 추가 |
| 7 | Security | 신규 가드는 `__dirname` 기준 리포지토리 내부 고정 경로만 `fs.readFileSync`/`readdirSync` 로 read-only 스캔 — 외부 입력·시크릿·네트워크 호출 없음, injection/path traversal 벡터 없음 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` | 조치 불필요. 향후 이 가드가 외부 입력(예: 다른 리포 파일)을 스캔하도록 확장되면 심볼릭 링크/경로 escape 방지 재검토 권장 |
| 8 | Side-effect | 신규 가드의 파일시스템 재귀 스캔은 순수 read-only(쓰기·삭제 없음)이며 기존 저장소의 다른 build-time 가드(`spec-frontmatter.test.ts` 등)와 동일 패턴 — 신규 부작용 유형 아님. 전역 변수·함수 시그니처·환경변수·네트워크·이벤트 어느 관점에서도 의도치 않은 부작용 없음 | `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 외부 입력/시크릿 노출 없는 순수 내부 read-only 스캔, 취약점 미발견 |
| requirement | LOW | 핵심 가드 기능 완전 구현·직접 실행 검증(11/11 통과, 위반 0건); regex word-boundary 오탐 가능성(WARNING, 현재 미발현) |
| scope | LOW | 핵심 산출물은 태스크 범위에 정확히 부합; 동반된 무관 1줄 수정은 커밋 메시지로 명시된 정당한 예외 |
| side_effect | NONE | read-only 파일 스캔뿐, 기존 가드 패턴과 동일, 부작용 없음 |
| maintainability | LOW | self-test/프로덕션 로직 이중 구현으로 drift 위험(WARNING); 오도하는 템플릿 리터럴(WARNING) |
| testing | LOW | self-test 커버리지 갭(주석/멀티라인 오탐·미탐 미검증, 파일 탐색 파이프라인 전체 미검증) — 직접 실행 검증(378/378, 11/11) 수행 |
| documentation | LOW | 문서화 전반 우수(PROJECT.md·plan 정합); 자동 가드 목록 표 미등록, docstring 커버리지 한계 미명시는 사소한 INFO |

## 발견 없는 에이전트

해당 없음 — 실행된 7개 에이전트 모두 최소 1건 이상의 INFO(또는 WARNING)를 보고했다 (문제 발견이 아닌 "조치 불필요" 확인성 기록 포함).

## 권장 조치사항

1. (WARNING #1, 최우선) `e2e-no-sub-global-timeout.test.ts` 의 self-test(`scanLine`)를 프로덕션 함수(`findSubGlobalTimeouts`)와 판정 로직을 공유하도록 리팩터링 — 현재는 두 곳이 독립 재구현되어 있어 프로덕션 로직 변경 시 self-test 가 회귀를 못 잡는다.
2. (WARNING #2) 메인 `it(...)` 타이틀의 템플릿 리터럴을 실제 `GLOBAL` 값으로 보간하거나, 주석이 약속한 동작을 안 할 거면 평범한 정적 문자열로 단순화해 주석-코드 불일치를 없앤다.
3. (선택, non-blocking) TIMEOUT_LITERAL 정규식에 주석-스킵/멀티라인/콜론-공백 등 오탐·미탐 경계 케이스를 self-test 에 보강하거나 최소한 docstring 에 포맷 전제를 명시한다.
4. (선택) PROJECT.md 의 "자동 가드(build-time 차단)" 목록 표에 신규 가드 항목을 추가하고, PR 본문에 무관 1줄 수정(`svcMetrics` 오참조 수정)의 사유를 한 줄 명시해 향후 리뷰어 혼선을 방지한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 `agents_forced`(router_safety)로 강제 포함)
  - **제외**: 7명 (표 참조)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 사유: 소스 코드 변경(신규 unit 테스트 + `execution-engine.service.spec.ts` 수정) 및 문서 파일(`PROJECT.md`, `plan/in-progress/e2e-retry-visibility-followup.md`) 변경이 있어 router_safety 정책상 항상 적용

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 반복문 I/O·대용량 처리 변경 없음 — 문서·테스트 가드만 |
  | architecture | 모듈 경계·DI·레이어 변경 없음 — 테스트 변수명 리팩토링만 |
  | dependency | package.json 변경 없음 — 기존 vitest/playwright 사용 |
  | database | DB 쿼리·마이그레이션·ORM 호출 변경 없음 |
  | concurrency | async/락/큐 코드 변경 없음 — 동기 테스트 인프라만 |
  | api_contract | HTTP route·controller·GraphQL 변경 없음 — 내부 테스트 가드만 |
  | user_guide_sync | 매트릭스 trigger(노드·API·통합·i18n) 변경 없음 — 문서화 가이드만 |