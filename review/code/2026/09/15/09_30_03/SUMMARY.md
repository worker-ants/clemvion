# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(CHANGELOG 방향 참조 오탈자 1건, `TriggersService.update()` 인라인 `save()` 창의 미검증 CASCADE 레이스 1건) 모두 즉시 차단 사유는 아니나 정정 권장. **forced whitelist(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보 확인** — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | CHANGELOG 정정 blockquote 가 "닫았다(아래 항목)"라고 적었으나, 실제로 그 판정을 설명하는 항목은 CHANGELOG 상 **위쪽**(최신 prepend 항목)에 있다. "아래"가 가리킬 대상이 파일 안에 없음 | `CHANGELOG.md:71` | "닫았다(아래 항목)" → "닫았다(위 항목 — «락을 잡아도 못 막는 세 번째 삭제 경로»)"로 구체적 항목명을 인용해 방향 모호성 제거 |
| 2 | security / concurrency | `TriggersService.update()`의 인라인 `save()` 경로(`acquireTriggerConfigLock`은 공유하지만 `rewriteTriggerConfigLocked`를 거치지 않는 유일한 예외)가 이번 PR이 발견한 3번째 삭제 경로(FK CASCADE)에 대해 검증되지 않음. `m.findOne` 재읽기와 `m.save()` 사이 창에서 CASCADE가 부모(Workflow/Workspace)를 먼저 지우면 TypeORM이 존재하지 않는 FK로 재-INSERT를 시도해 트랜잭션 실패(추정, 미확정)로 귀결될 수 있음 | `codebase/backend/src/modules/triggers/triggers.service.ts:632-680` | 후속 항목으로 명시 등재하고, `freshFindOne`을 두 번째 호출에서만 `null`로 바꾸는 fixture로 실제 실패 모드(에러 vs 조용한 orphan)를 재현·확정할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/database/requirement | `rewriteTriggerConfigLocked`의 `affected===0` 판정이 advisory lock으로 못 막는 3번째 삭제 경로(FK `onDelete: 'CASCADE'`)로 인한 orphaned-secret·거짓 성공 응답 회귀를 정확히 닫음(긍정 확인). 뮤테이션 테스트 2건(0행→false, null/undefined→true 유지)이 실제 분기점을 구별 | `trigger-config-lock.ts:239-241` | 조치 불요 — 이미 반영·검증됨 |
| 2 | security/database/concurrency | `SET LOCAL lock_timeout` 보간값을 `Number.isFinite`+clamp(`[1,60000]`)로 좁혀 `NaN`/`Infinity`/음수의 SQL 보간을 방지. 현재 호출부 전부 모듈 상수만 전달해 실질 익스플로잇은 없고 방어 심도 성격(긍정 확인) | `trigger-config-lock.ts` `toLockTimeoutMs()` (라인 29-55), 사용처 88 | 조치 불요 |
| 3 | side_effect/security | `normalizeNotificationSecretRef`(create/update 호출) 및 `chat-channel-binder.service.ts`의 degraded fallback 2곳이 `rewriteTriggerConfigLocked` 반환값을 여전히 확인하지 않음 — 이번 PR이 새로 만든 회귀는 아니나 같은 클래스(트리거 삭제 레이스로 인한 secret 정합성)의 잔여 표면 | `triggers.service.ts:876`, `chat-channel-binder.service.ts:310` | 후속 plan 항목으로 등재해 반환값 확인 및 skip 시 처리(로그/예외) 설계 결정 |
| 4 | concurrency/database | `rotateBotToken`에서 secret store 쓰기(`this.secrets.rotate`)가 `rewriteTriggerConfigLocked`의 `affected` 판정보다 먼저, 트랜잭션 밖에서 커밋 없이 실행됨 — 이번 PR로 HTTP 응답 계약(404)은 닫혔지만 보상 동작의 원자성(secret store vs DB 행 존재)까지는 닫히지 않음. 기존 설계의 잔여 한계, 이번 diff 스코프 밖 | `triggers.service.ts:1300-1307`(secret 쓰기), `:1318-1354`(affected 판정) | 신규 결함으로 등재하기보다 후속 planner 항목("삭제 경합 시 secret store 고아 정리/보상")으로 명시 |
| 5 | security/database/scope | `findByIdForUpdate` → `findByIdForPatchValidation` 개명 — 인가 스코핑(`workspaceId` 필터) 불변 확인, 저장소 전수 검색(`FOR UPDATE` 관용구 7개 파일, `…Precheck` 어휘 충돌)까지 거쳐 신중하게 결정됨(긍정 확인) | `triggers.service.ts:542-549`, 호출부 557 | 조치 불요 |
| 6 | concurrency | `affected`가 `null`/`undefined`(드라이버 미보고)이면 항상 성공(`true`)으로 처리 — "모른다≠없다" 의도된 fail-safe 설계이나, 향후 드라이버/쿼리 형태 변경 시 이 판정이 무력화되면 CASCADE 레이스가 재개방될 수 있음 | `trigger-config-lock.ts` `rewriteTriggerConfigLocked` | 조치 불요 — 드라이버 전환 시 재검토 대상으로만 인지 |
| 7 | side_effect | 신규 0-affected 분기는 `affected` 값을 알기 위해 이미 `merge()` 콜백과 `UPDATE` 문을 실행한 뒤 `false`를 반환 — 기존 `!fresh` 분기의 "쓰지 않을 거면 계산도 안 한다" 계약과 다른, 구조상 불가피한 트레이드오프 | `trigger-config-lock.ts:218-238` | JSDoc에 "쓰지 않을 거면 계산 안 함" 문구가 `!fresh` 분기에만 적용됨을 한 줄 명시 권장 |
| 8 | side_effect/scope | 공유 테스트 더블 `trigger-transaction-mock.ts`의 `manager.update` 기본 반환값이 `undefined`→`{affected:1}`로 변경돼 3개 spec 파일(triggers.service/triggers.web-chat/schedules.service)에 동시 영향 — 전체 재실행(367 tests)으로 검증됨 | `trigger-transaction-mock.ts:128-147` | 조치 불요(이미 검증됨). 향후 재수정 시 3개 파일 전부 재실행 규율 유지 |
| 9 | maintainability | JSDoc/주석 밀도가 실제 로직 대비 매우 높음(함수 JSDoc 68줄 vs 로직 10여줄) — 저장소 컨벤션에 부합하나 처음 읽는 사람의 진입장벽 | `trigger-config-lock.ts:115-183, 218-238` | 향후 리팩터링 시 서사적 근거는 CHANGELOG/plan 링크로, JSDoc은 계약만 남기는 방향 고려 |
| 10 | maintainability/testing | 신규 테스트가 `it.each`(기존 관례) 대신 `for` 루프로 다중 대표값을 검증 — 첫 실패 시 나머지 케이스 미실행·실패 케이스 라벨 미노출. `makeManager`의 두 번째 위치 인자(`updateAffected`)도 호출부만 보면 의미 불명확 | `trigger-config-lock.spec.ts:45, 169, 176-185, 214-226` | `it.each`로 통일 권장(낮은 우선순위) |
| 11 | testing | 유한성 검증 테스트가 `NaN`/`+Infinity`만 다루고 `-Infinity` 미포함. clamp 경계값(정확히 `1`, `60000`) 자체도 미검증 | `trigger-config-lock.spec.ts` | `Number.NEGATIVE_INFINITY` 및 경계값 케이스 추가(저비용 보강, 낮은 우선순위) |
| 12 | documentation | `rewriteTriggerConfigLocked`의 `@returns` JSDoc이 신규 0-affected 분기("UPDATE는 나갔지만 0행 매치")를 "쓰기 skip"이라는 기존 문구로만 서술 — 메커니즘이 다름. `trigger-config-lock.spec.ts` suite JSDoc의 "서비스 경유로 못 만드는 분기" 목록도 이번에 추가된 2개 신규 케이스를 반영 못함 | `trigger-config-lock.ts:165`, `trigger-config-lock.spec.ts:12-24` | `@returns` 문구 보강 및 suite JSDoc 목록에 신규 2항목 추가 |
| 13 | requirement | `spec/data-flow/11-workflow.md §3.1`의 CASCADE 열거 누락은 기존 스키마 이래의 문서 갭(이 PR이 만든 결함 아님) — developer 권한 밖이라 이미 `review/consistency/2026/09/15/08_58_18` WARNING#1로 planner 인계 완료 | `spec/data-flow/11-workflow.md §3.1` | 조치 불요 — 이미 planner 턴 대기 중 |
| 14 | scope | 실제 결함 수정(④ `affected` 판정)과 순수 정리 4건(개명·JSDoc·clamp·falsy 테스트)이 한 커밋에 묶여 있음 — 이 저장소의 "developer 후속 batch" 관행에 부합하며 plan 문서가 성격 전환을 스스로 명시 | 커밋 `79c3f79ce` 전체 | 조치 불요 |
| 15 | testing/security | 리뷰 도중 공유 워킹트리에서 병렬 리뷰 세션의 뮤테이션으로 추정되는 `trigger-config-lock.ts`의 일시적 상태 변화(`affected===0` 분기 소실→복원) 관측 — 재확인 결과 `git status`는 계속 clean, 코드/테스트 결함 아님 | `trigger-config-lock.ts` (일시적 관측) | 조치 불요 — 정보성 기록. 후속 세션은 유사 관측 시 `git diff`/`git status`로 먼저 실제 커밋 상태 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `affected===0`/`lock_timeout` 방어 모두 정확(긍정), `TriggersService.update()` 인라인 `save()` 창 미검증(WARNING) |
| requirement | NONE | 5개 항목 전부 claim대로 구현·테스트 검증(실행 재현 포함), spec 갭은 이미 planner 인계 완료 |
| scope | NONE | plan 5개 항목과 diff 1:1 대응, 무관한 변경·불필요한 리팩토링 없음 |
| side_effect | LOW | 핵심 신규 분기는 안전하게 흡수되나, `wrote` 미소비 호출부 2곳·공유 mock 파급 범위는 잔여 표면 |
| maintainability | LOW | JSDoc 밀도·테스트 스타일 비일관성 등 스타일 수준 INFO만 |
| testing | LOW | 핵심 분기 전부 뮤테이션 검증됨, 갭은 -Infinity/경계값 등 저비용 보강 대상뿐 |
| documentation | LOW | CHANGELOG 방향 참조 오탈자(WARNING), JSDoc 갱신 지연 2건(INFO) |
| database | NONE | `affected` 판정·lock_timeout 방어 정확, 스코프 밖 잔여(secret 비원자성)는 기존 설계 |
| concurrency | LOW | 핵심 TOCTOU 정확히 닫힘, `rotateBotToken` secret 쓰기 순서·update() 인라인 save() 창은 잔여 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원 최소 INFO 이상의 발견(다수는 긍정 확인 포함)을 보고함.

## 권장 조치사항

1. `CHANGELOG.md:71`의 "닫았다(아래 항목)" → "닫았다(위 항목 — «락을 잡아도 못 막는 세 번째 삭제 경로»)"로 정정 (WARNING #1).
2. `TriggersService.update()` 인라인 `save()` 경로(라인 632-680)의 미검증 CASCADE 레이스를 후속 트래커에 등재하고, `freshFindOne`을 두 번째 호출에서만 `null`로 바꾸는 fixture로 실제 실패 모드를 확정할 것 (WARNING #2).
3. `normalizeNotificationSecretRef`(create/update) 및 `chat-channel-binder.service.ts` degraded fallback 2곳의 `rewriteTriggerConfigLocked` 반환값 미확인 문제를 후속 plan 항목으로 등재 (INFO #3).
4. `rotateBotToken`의 secret store 쓰기와 `affected` 판정 간 트랜잭션 경계 비원자성을 "삭제 경합 시 secret store 고아 정리/보상" 후속 항목으로 명시 (INFO #4).
5. (낮은 우선순위) 테스트 미세 보강 — `-Infinity` fixture, clamp 경계값(`1`/`60000`) 명시적 케이스, `it.each` 통일 (INFO #10, #11).
6. `rewriteTriggerConfigLocked`의 `@returns` JSDoc 및 `trigger-config-lock.spec.ts` suite-level 분기 목록에 신규 2개 경로 반영 (INFO #12).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced 전원 결과 확보 확인됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(락 헬퍼 정리·개명)와 낮은 관련도 |
  | architecture | router 판단상 이번 diff 범위와 낮은 관련도 |
  | dependency | 의존성 변경 없음 |
  | api_contract | 공개 API 시그니처 변경 없음(순수 private 개명·내부 로직) |
  | user_guide_sync | 사용자 가이드 영향 없음 |