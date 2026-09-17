# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. WARNING 4건은 전부 "코드는 옳고 문서/주석이 stale" 류(spec·CHANGELOG·JSDoc 미반영)이지만, `concurrency` 리뷰어가 1·2라운드부터 이어지는 **미해결 race window**(외부 자원 해제 스냅샷과 잠금된 트리거 재열거 사이, 그 창에서 생긴 신규 schedule 트리거의 BullMQ job 이 정리되지 않을 수 있음)를 이번 라운드에도 코드 변경 없이 그대로 보고해 개별 위험도를 MEDIUM 으로 매겼다 — 이 항목은 팀이 실측 근거(비밀 삭제를 커밋 뒤로 옮기면 CASCADE 로 schedule 행을 먼저 잃는다)로 의도적으로 열어 두고 plan 체크리스트에 sweeper 후속 항목으로 추적 중이나, `complete/` 이동 전 그 후속 트래커 문서가 실제로 생성됐는지 확인이 필요하다. **forced(router_safety) 화이트리스트 7명 전원 결과 확보됨** — 강제 항목 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | (1·2라운드부터 이어짐, 이번 라운드도 코드 미변경) `releaseExternalForParent`(락 없는 스냅샷)와 `lockParentAndListTriggerIds`(잠금된 재열거) 사이에 새로 생긴 schedule 트리거는 CASCADE 로 행은 삭제되고 비밀도 정리되지만, 그 트리거가 등록한 BullMQ job scheduler 는 `releaseExternalMany` 스냅샷에 없어 정리되지 않는다 | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:67-70`(스냅샷) vs `:72-95`(재열거); 호출부 `workflows.service.ts:268,273`, `workspaces.service.ts:513,522` | 이번 PR 스코프 추가 조치 불요(팀의 실측 근거 있는 의도적 트레이드오프). 단 `plan/in-progress/trigger-deletion-release.md:176` 의 "sweeper 재판단 항목 신설"이 미체크(`[ ]`) 상태 — `complete/` 이동 전 실제 트래커 문서 생성 여부를 반드시 확인할 것 |
| 2 | `[SPEC-DRIFT]` | `[SPEC-DRIFT]` `spec/2-navigation/2-trigger-list.md` §4.3/§4.4 가 `d2184dcf2`(부모 행 잠금에도 5초 `lock_timeout` 적용)를 반영하지 않는다 — §4.4 는 "락 대기 상한 5초"를 트리거·스케줄 삭제 두 경로에만 명시하고, 워크플로·워크스페이스 부모 행 잠금까지 확장된 사실을 서술하지 않는다. 코드는 옳고(2라운드가 요구한 결함 수정) spec 문구가 좁다. 기존 SPEC-DRIFT 추적 목록(plan 176행)에도 미등재 | `spec/2-navigation/2-trigger-list.md:307`(§4.4), `:296-300`(§4.3); 근거 코드 `trigger-resource-release.ts`(`lockParentAndListTriggerIds` JSDoc), `trigger-resource-releaser.service.ts:76` | 코드는 유지. `--impl-done` 이후 project-planner 턴에서 §4.4 불릿에 워크플로·워크스페이스 부모 잠금을 포함하도록 문구 확장. 그 전에 developer 가 `plan/in-progress/trigger-deletion-release.md:176` "planner 후속 신설" 목록에 이 항목을 추가해 둘 것(현재 누락 — `complete/` 이동 시 유실 위험) |
| 3 | 문서화 | `CHANGELOG.md` 의 `## Unreleased` 항목이 `d2184dcf2`(부모 삭제 트랜잭션 무한 대기 hang 수정)를 반영하지 않는다 — 같은 파일의 다른 항목(67행 이하)이 "후속 라운드 발견을 원 항목에 `> **갱신(날짜)**` 블록으로 합류"하는 관행을 이 PR 작업 기간 동안 실제로 쓰고 있는데, 이 항목만 그 관행을 따르지 않았다 | `CHANGELOG.md:3-33`(`## Unreleased — 워크플로·워크스페이스를 지워도 트리거의 자원이 남았다`) | "리뷰가 잡은 것" 단락 뒤에 "워크플로·워크스페이스 삭제의 부모 행 잠금에도 `lock_timeout` 이 없어 동시 요청과 겹치면 반쯤 삭제된 상태가 무기한 hang 으로 굳을 수 있었다 — 트리거·스케줄 삭제와 같은 5초 상한을 적용했다" 한 문단 추가 |
| 4 | 유지보수성/문서화 | `SecretResolverService.deleteByPrefix` 의 JSDoc("현재 프로덕션 호출부는 `triggers.service.ts` 한 곳뿐")이 이번 PR 로 사실과 어긋난다 — 실제 유일한 직접 호출부는 새 파일 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit` 이고, 그 함수는 트리거·스케줄·워크플로·워크스페이스 삭제 + binder 보상 경로까지 다섯 자리에서 호출된다(개수는 1개 유지되나 근거 문구의 파일명·날짜가 stale). 실행 시점 위험은 없음(런타임 LIKE 메타문자 가드 + 모든 resourceId 가 UUID) — 다만 다음 안전성 재검토자의 전제를 흐릴 수 있음 (side_effect WARNING, database 는 동일 사실을 INFO 로 병기) | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:172-174`; 실제 호출부 `codebase/backend/src/modules/triggers/trigger-resource-release.ts:62` | JSDoc 을 "현재 프로덕션 호출부는 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit` 한 곳" 으로 정정하고 재확인 날짜 갱신. 여유 있으면 `buildSecretRefPrefix` 에 LIKE 메타문자 사전 검증을 추가해 실패를 접두 생성 시점으로 앞당기는 것도 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `setLocalLockTimeout` 이 두 호출부(`acquireTriggerConfigLock` 은 옵션 객체로 조건부, `lockParentAndListTriggerIds` 는 함수 진입 즉시 무조건)에서 서로 다른 방식으로 "트랜잭션 첫 호출" 계약을 만족시켜 형태가 통일돼 있지 않음. 위험 낮음(현재 위치 고정) | `trigger-config-lock.ts:63,95-102`; `trigger-resource-releaser.service.ts:76` | 세 번째 호출부 생기면 "트랜잭션 오프너가 콜백 전에 상한을 강제로 건다" 형태로 승격 고려 |
| 2 | 요구사항 | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 "소비자마다 다르다" 예시 목록이 스스로 경고한 drift 패턴대로 다시 과소 서술됨 — 이번 PR 로 3·4번째 소비자(워크플로·워크스페이스 부모 잠금)가 추가됐지만 목록은 트리거·스케줄 둘만 예시로 듦 | `trigger-config-lock.ts:105-113` | 다음에 이 파일을 손댈 때 "예시는 대표일 뿐"으로 일반화하거나 두 소비자를 추가 |
| 3 | 유지보수성 | `lockParentAndListTriggerIds` 의 "트랜잭션의 첫 호출이어야 한다" 불변식이 타입이 아니라 JSDoc+테스트로만 강제됨 — 현재 두 호출부(workflows/workspaces) 모두 첫 줄에 위치하고 순서 단언 테스트가 있어 안전하나, 이 PR 자체가 "안무 순서가 관례로만 강제돼 재배치 실수가 실제로 있었다"는 사례를 남김 | `trigger-resource-release.ts`(`TriggerResourceReleasePort.lockParentAndListTriggerIds` JSDoc); 호출부 `workflows.service.ts`, `workspaces.service.ts` | 즉시 조치 불요. 트래커 항목 1(호출부 3개 이상 시 템플릿 메서드 승격)이 충족될 때 이 계약도 함께 흡수 |
| 4 | 테스트 | 워크플로/워크스페이스 삭제 wiring 레벨에 "부모 밑 트리거 0개" 케이스의 직접 테스트 없음(빈 배열은 항상 mock 이 비어있지 않은 배열만 반환). 단위 레벨(`trigger-resource-release.spec.ts`)의 no-op 계약이 이미 커버해 실질 위험 낮음 | `workflows.service.ts:268,288`; `workspaces.service.ts:513,548` | 필수 아님. `lockAndList` mock 이 `[]` 반환하는 케이스 하나 추가 권장 |
| 5 | 테스트 | `deleteWorkspace()` 의 `WORKSPACE_NOT_FOUND` 분기에 전용 테스트 없음(이 PR 이전부터 있던 pre-existing 갭, 신규 아님) — `assertWorkspaceDeletable` 이 공유 private 메서드가 된 만큼 봉인 가치 있음 | `workspaces.service.ts:564-613`(`assertWorkspaceDeletable`) | 필수 아님. `workspaceRepo.findOne` 이 `null` 반환하는 케이스를 `deleteWorkspace` describe 에 추가 |
| 6 | 아키텍처 | (재확인, 신규 아님) 1·2라운드가 지적한 구조적 부채 3건(삭제 안무 4곳 손 중복 · `TriggerResourceReleaserService` 의 타 도메인 엔티티 직접 import · `ModuleRef` 서비스 로케이터의 모듈 캡슐화 우회)은 이번 라운드 diff 범위 밖이며 plan 트래커에 조건부(호출부 3개 이상/부모 타입 3번째 등장 시) 등재돼 있음 | `plan/in-progress/trigger-deletion-release.md:163,176` | 조치 불요, 조건 충족 시 집행 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 3라운드 코드 변경(`d2184dcf2`)은 순수 가용성 강화, 신규 인젝션/인가우회 없음. 유일 잔여(워크스페이스 선검사↔재검사 role-change 창)는 인가 우회 아닌 가용성 트레이드오프로 이미 처분됨 |
| architecture | LOW | 2라운드 W2 처분이 오히려 설계 개선(계약을 포트 구현에 내장). 신규 구조 결함 없음 |
| requirement | LOW | `[SPEC-DRIFT]` spec §4.3/§4.4 가 새 lock_timeout 확장을 반영 안 함(WARNING #2). 그 외 line-level 일치 재확인 |
| scope | NONE | 실질 코드 diff 23개 파일 전부 DRT-2 범위 내. 무관한 변경·포맷팅·불필요한 리팩터 없음 |
| side_effect | LOW | `deleteByPrefix` JSDoc stale(WARNING #4). 나머지 새 외부 호출(teardown 보상 경로)은 CHANGELOG·테스트로 뒷받침되는 의도된 변경 |
| maintainability | NONE | 트랜잭션 첫 호출 계약 타입 미강제(INFO #3)만. 1·2라운드 WARNING 전부 해소 유지 확인 |
| testing | LOW | 순서 재배치 회귀 테스트가 실제 구현과 정확히 일치(뮤턴트 M21/M22 대응). 좁은 커버리지 갭 2건(INFO #4,#5) |
| documentation | LOW | `CHANGELOG.md` 가 `d2184dcf2` 미반영(WARNING #3). 신규 JSDoc·주석은 코드와 정확히 일치 |
| database | LOW | W1(인덱스 부재, 기존 등재)·W2(잠금 무한대기) 모두 재확인 처분됨. `deleteByPrefix` 주석 stale 재확인(WARNING #4 와 동일 사실, INFO 로 병기) |
| concurrency | MEDIUM | 스냅샷-재열거 사이 race window(WARNING #1) 여전히 열려 있음(의도적, tracked). W2(잠금 무한대기)·1라운드 CRITICAL 은 해소 확인 |

## 발견 없는 에이전트

- scope — 실질 코드 diff 가 DRT-2 과업 범위에 정확히 국한됨을 확인, 지적사항 없음

## 권장 조치사항

1. `plan/in-progress/trigger-deletion-release.md:176` 의 "sweeper 재판단 항목 신설"(외부 해제 스냅샷 뒤 생긴 트리거의 BullMQ job 미정리, concurrency WARNING #1)이 실제 트래커 문서로 등재됐는지 확인 — `complete/` 이동을 막는 조건으로 취급.
2. 같은 plan 파일의 "planner 후속 신설" 목록(176행)에 `[SPEC-DRIFT]` spec §4.3/§4.4 lock_timeout 확장 미반영 항목(requirement WARNING #2)을 추가.
3. `CHANGELOG.md` Unreleased 항목에 `d2184dcf2`(부모 삭제 트랜잭션 잠금 대기 5초 상한) 갱신 블록 추가(documentation WARNING #3).
4. `SecretResolverService.deleteByPrefix` JSDoc 의 호출부 서술을 `trigger-resource-release.ts`/`deleteTriggerSecretsAfterCommit` 로 정정(side_effect/database WARNING #4).
5. (선택) INFO 항목들은 즉시 조치 불요 — 다음에 해당 파일을 손댈 때 함께 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(diff 범위에 성능 특화 영역 없음으로 추정 — 상세 사유는 라우터 산출에 미포함) |
  | dependency | 라우터 판단(신규/변경 외부 의존성 없음으로 추정) |
  | api_contract | 라우터 판단(공개 API 계약 변경 없음으로 추정) |
  | user_guide_sync | 라우터 판단(사용자 가이드 대상 표면 변경 없음으로 추정) |
