# Rationale 연속성 검토 — spec/2-navigation/ (--impl-done)

## 스코프 메모

`spec/2-navigation/` 자체의 spec 델타는 0개다 (정상 — 이 브랜치는 코드 전용 PR). 실제
구현 diff(`git diff origin/main...HEAD`)를 워킹트리에서 직접 확인한 결과, 이 스코프에
걸리는 코드 변경은 사실상 `codebase/backend/src/modules/triggers/triggers.service.ts` +
`codebase/backend/src/common/db/pg-error.ts` (trigger endpoint-path 409 처리) 한 건뿐이다.
나머지 diff 대부분(`User` 엔티티 노출 방어 3축, `workflow-versions.service.ts` 의
`creator` 투영, `dto-jsdoc-citation-guard.ts`, `review-citations.md`/`spec-impl-evidence.md`
정정)은 `spec/2-navigation/` 밖(User 엔티티·workflow-versions·리뷰 인용 규약)에 속하지만,
"관련 Rationale 발췌"에 `secret-store.md`·`error-codes.md`·`1-auth.md` 가 함께 번들되어
있어 교차 검증했다.

## 발견사항

### [INFO] Trigger endpoint-path 409 처리가 스펙과 정확히 합치한다 — 회귀 아님

- target 위치: (코드) `codebase/backend/src/modules/triggers/triggers.service.ts`
  `rethrowEndpointPathConflict` / `isEndpointPathUniqueViolation`
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §3 API 표 아래 PATCH 계약 노트
  ("`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드
  `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)")
- 상세: 새 코드는 `V002__indexes.sql` 의 partial unique 인덱스
  `idx_trigger_workspace_endpoint`(`WHERE endpoint_path IS NOT NULL`) 위반만 이름으로
  좁혀 문서가 이미 약속한 형태(409 + `details.field`/`details.code`)를 그대로 실현한다.
  기각·번복이 아니라 "문서한 보장이 구현보다 넓었다"(과거 관측 패턴, `spec/5-system/
  2-api-convention.md` §5.3 Rationale 의 "명시 의무" 원칙)는 결함을 닫는 정합화다.
- 제안: 없음. 다만 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 `3-error-handling.md §1` 카탈로그에
  아직 등재하지 않았는데, 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 "도메인 세부 에러 코드의 표현 방식을 정식화한다" 항목(2026-09-06 등재)이 이미 추적
  중이므로 이 검토에서 별도로 올리지 않는다.

### [INFO] `details.code` 배치가 저장소 다수 선례(top-level code 교체, 7건)와 다른 형태를 택함 — 단, 무근거 번복 아님

- target 위치: (코드) 위와 동일 파일의 `rethrowEndpointPathConflict` 주석
- 과거 결정 출처: `spec/conventions/error-codes.md` §5 Rename 이력 표(top-level `code` 를
  특화 코드로 **교체**하는 선례 다수) vs §4.2(도메인 세부 사유를 `error.details[].code` 로
  두는 파이프라인, `trigger-parameter.types.ts`)
- 상세: `error-codes.md` 는 이 둘 중 무엇이 기본값인지 명문화하지 않는다. 이번 구현은
  spec 문장이 "409 `RESOURCE_CONFLICT` (세부 코드 …)" 로 두 층을 나눠 적었다는 이유로
  §4.2 형태(`details.code`)를 택했는데, 이는 §4.2 가 원래 다루던 파이프라인(Manual/Webhook
  트리거 *파라미터 검증* 사유)과는 다른 문맥(DB UNIQUE 충돌)에 그 형태만 재사용한 것이라
  "결정을 뒤집으면서 새 Rationale 없이" 에 해당할 소지가 있었다. 그러나 개발자가 이를
  침묵 처리하지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` (§"도메인
  세부 에러 코드의 표현 방식을 정식화한다", 2026-09-06 planner 등재)에 명시적으로
  올려 두었다 — "결정의 무근거 번복" 기준이 요구하는 "새 Rationale" 대신 "정식화가
  필요함을 명시적으로 등재"로 갈음한 형태다.
- 제안: 다음 `project-planner` 턴에서 `spec/5-system/2-api-convention.md` §5.3 에 두 관례
  중 택일 기준을 명문화하고 `3-error-handling.md §1` 에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를
  등재할 것 (이미 plan 에 등재되어 있으므로 이번 리뷰의 신규 액션은 없음 — 존재 확인만).

### [NONE] `User` 비밀 컬럼 방어에서 `select: false` 를 재도입하지 않았다 — 기각 근거를 정확히 계승

- target 위치: (코드) `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
  `codebase/backend/src/shared/testing/user-secret-absence.ts`,
  `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
  (`CREATOR_PROJECTION` 명시 투영)
- 과거 결정 출처: `spec/conventions/secret-store.md` §1.1 (2026-09-05 신설) — "컬럼 수준
  (`select: false`)은 그 컬럼을 읽는 내부 경로(회전 승격·정리 스윕)가 예외 없이
  `undefined` 를 받아 조용히 오작동하므로 쓰지 않는다."
- 상세: 이번 PR 의 `CHANGELOG.md` 는 `User` 엔티티에 `select: false` 를 걸지 않은 이유로
  "19곳이 공유 깔때기(`findById`/`findByEmail`)를 지나므로 국소 수정이 불가능하고, 놓치면
  `comparePassword(x, undefined)` 가 인증을 조용히 실패시킨다" 를 든다 — 이는
  `secret-store.md` §1.1 이 이미 확립한 "select:false 는 조용한 undefined 실패를 유발하므로
  쓰지 않는다" 는 원칙을 **다른 컬럼 집합(시크릿 참조 → User 인증 컬럼)에 정확히 같은
  근거로 재적용**한 것이다. 기각된 대안을 이유 없이 되살린 사례가 아니라, 기각 근거를
  일관되게 계승한 사례로 판단한다.
- 제안: 없음 (정합).

### [NONE] `user-entity-exposure-guard.ts` 가 라우트별 opt-in 마커 패턴을 재도입하지 않았다

- target 위치: (코드) `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
  (`findEagerUserRelations`, `collectUserRelationNames` — 엔티티 타입 주석에서 파생하는
  구조 기반 스캔)
- 과거 결정 출처: `spec/5-system/1-auth.md` Rationale "부트 캐너리 — `@WorkspaceId()`
  reflection 자가검증" (b) 항 — "라우트별 opt-in 마커" 패턴을 명시적으로 재기각
  ("다음 라우트에서 같은 누락이 재발한다 — 이 저장소가 이미 최소 2회 겪었다")
- 상세: 이번 가드는 호출부에 마커를 요구하지 않고 엔티티 선언(타입 주석)에서 `User`
  관계 이름을 파생시키는 구조 기반 접근을 택했다 — 위 Rationale 이 선호하는 방향과
  같은 결("호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다")이다. 상충 없음.
- 제안: 없음.

## 요약

`spec/2-navigation/` 스코프에 걸리는 실질 코드 변경(트리거 endpoint-path 409 처리)은
`2-trigger-list.md` 가 이미 명시한 계약을 그대로 실현한 것으로, 기각된 대안의 재도입이나
합의 원칙 위반은 발견되지 않았다. 스코프 밖이지만 번들된 `User` 엔티티 노출 방어 작업은
하루 전 신설된 `secret-store.md` §1.1 의 "select:false 기각" 원칙과 `1-auth.md` 의 "라우트별
마커 재기각" 원칙을 새 컨텍스트에 일관되게 재적용한 것으로 판단되며, 유일한 애매한 지점
(`details.code` vs top-level code 교체 — 두 선례 중 택일)은 침묵 처리되지 않고
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정식화 대기 항목으로
명시 등재되어 있어 "결정의 무근거 번복" 기준에 해당하지 않는다.

## 위험도

NONE
