# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 없음(신규 repo-guard·e2e 단언 추가·문서 정리뿐). Critical 없음, WARNING 2건(둘 다 비차단 성격: doc-sync-matrix 완결성 갭 1건, 테스트 내부 vacuous 삼항식 1건). forced whitelist(7명) 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `2-trigger-list.md` frontmatter `code:` 목록이 §3(`TriggerDto.workflow` 계약)의 enforcing 파일로 `trigger-workflow-ref.e2e-spec.ts`만 등재하는데, 이번 PR이 `schedule-trigger.e2e-spec.ts`(C-2/G/H)에 추가한 3개 단언도 같은 §3 계약을 schedule 타입에 대해 처음 시행함 — doc-sync-matrix가 이 신규 enforcing 파일을 반영 못함 | `spec/2-navigation/2-trigger-list.md:20-27` vs `codebase/backend/test/schedule-trigger.e2e-spec.ts` | `project-planner` 턴에서 frontmatter `code:`에 `schedule-trigger.e2e-spec.ts` 추가하거나, 최소 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 갭 한 줄 등재 (developer 권한 밖) |
| 2 | maintainability | vacuous 삼항식 — `value === null` 분기에서 문자열을 `.toBe(0)`(숫자)와 비교해 항상 통과(never fails). 의도된 진단 메시지가 실제로는 트리거되지 않음(단, 바로 다음 줄이 null을 실제 검증하므로 커버리지 결함은 아님) | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:59` | 삼항식 제거하고 `if (value === null) throw new Error(...)` + `expect(value.length).not.toBe(0)`로 분리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | repo-guard는 "알려진 3곳"만 비교 — 미등재 4번째 사본이 생기면 감시 범위 밖. 이 자체는 방식의 태생적 한계 | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(`CANONICAL_SOURCE`/`MIRROR_SOURCES`) | 헤더 JSDoc에 "신규 사본은 `MIRROR_SOURCES`에 추가해야 감시됨" 한 줄 추가 |
| 2 | requirement | `GET /api/triggers/:id`(단건) schedule 타입 `workflow` 양성 커버리지 0건 잔존 — plan이 명시적으로 인지·유예한 스코프 축소 | `schedule-trigger.e2e-spec.ts`(단건 조회 테스트 없음) | 후속 트래커에 "단건 조회 schedule workflow 양성 1건" 등재 검토 |
| 3 | documentation | `schedule-trigger.e2e-spec.ts` 헤더 "검증 대상" 목록이 신규 `TriggerDto.workflow` 단언 축을 반영 안 함 | `codebase/backend/test/schedule-trigger.e2e-spec.ts` 헤더(16-28행) | 헤더 bullet에 "목록/PATCH의 `TriggerDto.workflow` 양성 고정" 한 줄 추가 |
| 4 | documentation | plan의 "`grep '가드 [0-9]'` 9자리 전부 검색됨" 수치 — 실측 재현 시 세는 기준(코멘트/헤딩/합계)에 따라 다른 수(예: 10)가 나올 수 있어 정의 불명확. 핵심 주장(옛 결합 케이스 누락) 자체는 정확함 | `plan/in-progress/trigger-canary-hardening.md:167` | "9자리"가 무엇을 가리키는지 괄호로 명시하거나 grep 라인 수로 재검산 |
| 5 | testing | `readStringArrayConst`가 대상 파일 부재(경로 오탈자/리네임)에 방어 없음 — raw `ENOENT`로 실패, 진단 메시지 없음 | `trigger-secret-columns-guard.ts`(`readStringArrayConst`) | 진입부에 `fs.existsSync` 체크 후 명시적 에러 메시지 |
| 6 | testing | control-group 테스트가 소스의 정확한 부분 문자열에 결합 — 향후 포맷 변경 시 실패 가능(단, false negative 아닌 false alarm 방향이라 안전 쪽) | `trigger-secret-columns.spec.ts:64-85` | 조치 불필요(트레이드오프로 판단) |
| 7 | testing | `expectTriggerWorkflowRef` 3곳의 실제 뮤턴트 kill 여부는 이번 세션 DB 미기동으로 런타임 재현 불가 — ts-jest 컴파일 통과만 확인, plan의 문서화된 실측(RED 3곳)은 신뢰 수준에 머묾 | `schedule-trigger.e2e-spec.ts:275-278, 390-393, 427-430` | 조치 불필요(문서화된 실측 존재, 부재 증거 아님) |
| 8 | maintainability | `expectTriggerWorkflowRef` 동일 인자 형태 호출이 3곳 반복 — 기존 `assertMatchesContract` 반복 관례와 일관되며 각 케이스 독립성 유지가 합리적 | `schedule-trigger.e2e-spec.ts` C-2/G/H | 조치 불필요 |
| 9 | security | 신규 guard의 파일 경로 인자는 하드코딩 상수로만 호출 — 경로 탐색 위험 없음 | `trigger-secret-columns-guard.ts` 40-109행 | 조치 불필요 |
| 10 | security | AST 파싱은 코드 실행 없이 안전 — 정규식 대신 AST 선택 근거 타당 | `trigger-secret-columns-guard.ts` JSDoc | 조치 불필요 |
| 11 | security | e2e 하드코딩 fake secret 값들은 더미이며 diff 범위 밖(기존 코드) | `chat-channel-trigger-create.e2e-spec.ts` | 조치 불필요 |
| 12 | security | `secret_store` 고아 row 방치는 이번 PR 신규 도입 아님 — 근거(테스트 인프라 vs 프로덕션 삭제 경로)가 정확히 분리되어 문서화됨 | `trigger-workflow-ref.e2e-spec.ts` afterAll JSDoc | 조치 불필요 |
| 13 | scope | 16개 diff 파일 전부 plan이 선언한 4개 항목 중 정확히 하나에 대응, 스코프 이탈 없음 | 전체 diff | 조치 불필요 |
| 14 | scope | consistency-check 지적(W2/W3)을 직접 수정하지 않고 권한 경계에 맞춰 새 트래커 항목으로만 등재 — 경계 준수 확인 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불필요 |
| 15 | side_effect | 신규 guard/spec 모두 순수 읽기 또는 격리된 tmp I/O(afterAll 정리) — 저장소 오염 없음 | `trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts` | 조치 불필요 |
| 16 | maintainability | 원문자(①②③)→아라비아 숫자 통일이 실제로 grep 가능성·가독성 개선 | `trigger-workflow-ref.spec.ts` | 조치 불필요(긍정적 변경) |
| 17 | documentation | CHANGELOG 미갱신은 순수 내부 테스트 하드닝 성격상 문제 없음 | `CHANGELOG.md` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 미변경, 신규 노출 경로 없음 |
| requirement | LOW | doc-sync-matrix 완결성 갭(WARNING) 1건 + INFO 3건 |
| scope | NONE | 4개 plan 항목과 diff 1:1 대응, 이탈 없음 |
| side_effect | NONE | 순수 읽기/격리된 tmp I/O, 프로덕션 부작용 없음 |
| maintainability | LOW | vacuous 삼항식(WARNING) 1건 + INFO 2건 |
| testing | LOW | 뮤테이션 실측으로 견고성 확인, INFO 3건(파일 부재 미방어 등) |
| documentation | LOW | 헤더 목록 누락 축 1건, plan 카운트 정의 모호 1건 (둘 다 INFO) |

## 발견 없는 에이전트

없음 (7명 모두 최소 1건 이상의 INFO 이상 기록, 다만 security/scope/side_effect는 위험도 NONE).

## 권장 조치사항
1. `trigger-secret-columns.spec.ts:59`의 vacuous 삼항식을 명시적 분기(`if (value === null) throw ...`)로 분리한다 (WARNING #2).
2. `project-planner` 턴에서 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록에 `schedule-trigger.e2e-spec.ts`를 추가하거나 후속 트래커에 명시적으로 등재한다 (WARNING #1, developer 권한 밖).
3. (선택) `schedule-trigger.e2e-spec.ts` 헤더 목록에 신규 `TriggerDto.workflow` 검증 축을 한 줄 추가하고, plan의 "9자리" 카운트 정의를 명확히 한다 (INFO #3, #4).
4. (선택) `readStringArrayConst`에 대상 파일 부재 시 명시적 에러 메시지를 추가한다 (INFO #5).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 해당 diff와 무관(신규 프로덕션 로직/핫패스 없음) |
  | architecture | router 판단상 해당 diff와 무관(구조 변경 없음, 기존 guard 패턴 재사용) |
  | dependency | router 판단상 해당 diff와 무관(신규 의존성 없음) |
  | database | router 판단상 해당 diff와 무관(DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 해당 diff와 무관(동시성 로직 변경 없음) |
  | api_contract | router 판단상 해당 diff와 무관(API 계약 변경 없음, 기존 필드 검증만 추가) |
  | user_guide_sync | router 판단상 해당 diff와 무관(사용자 가이드 대상 아님) |