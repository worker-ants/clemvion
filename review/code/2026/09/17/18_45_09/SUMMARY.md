# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 워크플로/워크스페이스 삭제의 "배치(다건) schedule job 해제"가 원자적이지 않아, 여러 스케줄 트리거를 가진 부모를 지울 때 일부 job 만 해제되고 삭제 자체는 실패하는 CRITICAL 결함(concurrency)이 있다. 이 PR 이 없애려는 결함 클래스("고아 자원")를 배치 경로에서 좁게 재도입한다. 그 외에는 정책 단일화·spec 정합·테스트가 전반적으로 견고하다(요구사항·스코프는 LOW/NONE). forced(router_safety) 7명은 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | 워크플로/워크스페이스 삭제 시 `releaseExternalMany`의 schedule job 배치 해제가 순차 `for` 루프 + 트랜잭션 진입 전 실행이라 원자적이지 않다. N개 스케줄 중 k번째(k>1)에서 `removeJob` 실패 시 1..k-1 은 이미 Redis 에서 제거됐지만 삭제 자체(행 삭제)는 전부 취소된다 — "삭제 실패(500)"로 보이는데 실제로는 일부 스케줄 job 이 영구히 사라진 상태가 된다. 이 PR 이 고치려는 결함 클래스("Schedule not found" 좀비)를 배치 실패 경로에서 재도입. | `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:137-139`(`releaseExternalMany`), 호출부 `workflows.service.ts:267-268`, `workspaces.service.ts:512-513` | 스케줄 2개 이상에서 부분 실패하는 뮤테이션 테스트로 갭을 우선 드러내고, `Promise.allSettled`로 실패 목록과 함께 던지거나 best-effort(로그만 남기고 삭제 계속)로 정책을 명시적으로 재설계한다. "일부는 이미 저지르고 전체는 취소"가 최악의 상태임을 인지할 것. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | concurrency | 워크스페이스 삭제: 잠금 없는 선검사(`assertWorkspaceDeletable`) → 외부 해제(`releaseExternalForParent`) → 잠금 있는 재검사 순서에서, (1)~(3) 사이 요청자 role 이 강등되면 재검사가 거부(403)돼 워크스페이스·트리거는 살아있는데 이미 실행된 외부 해제(schedule job 취소·provider teardown·listener unregister)는 되돌려지지 않는다 — 삭제가 거부된 워크스페이스의 트리거가 조용히 비활성화된다. | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace`(504·512-513) / `assertWorkspaceDeletable`(551-586) | 재검사 실패 시 "외부 자원은 이미 해제됨"을 로그로 남기거나, 선검사~외부해제 창을 좁힌다. `plan` D7 표에 이 경합(권한 철회 vs 삭제)을 별도 행으로 등재 — D7-1/D7-2 는 트리거 생성 경합만 다룬다. |
| 3 | concurrency | `releaseExternalForParent`(락 없는 스냅샷)와 `lockParentAndListTriggerIds`(잠금된 열거) 사이 시차: 그 사이 부모에 새 트리거가 생성되면 비밀은 삭제 대상에 포함되지만(잠금이 INSERT 를 막음) 외부 자원(schedule job/provider 등록)은 스냅샷 이전 트리거만 대상이라 정리되지 않는다 — 부모 삭제 경로에서 "고아 자원" 결함이 좁게 재발. | `trigger-resource-releaser.service.ts:55-58`(스냅샷) vs `:60-82`(잠금 열거); 호출부 `workflows.service.ts:267-278`, `workspaces.service.ts:512-530` | "무엇을 해제할지"의 SoT 를 잠금된 열거 하나로 통일(커밋 후 그 결과로 외부 해제+비밀 삭제 수행)하거나, 최소 JSDoc 에 창을 명시하고 sweeper 트래커에 이 시나리오를 추가. |
| 4 | side_effect | (발견 #2 와 동일 현상, side_effect 관점 중복 보고) 워크스페이스 삭제 권한 재검사 실패 시 이미 실행된 외부 해제가 되돌려지지 않아 "삭제 거부됐지만 트리거는 비활성화" 회귀 — `assertWorkspaceDeletable` JSDoc 의 "best-effort" 뉘앙스보다 실제 영향(웹훅 수신·스케줄 실행 중단)이 크다. | `workspaces.service.ts` `deleteWorkspace`/`assertWorkspaceDeletable` | 발견 #2 제안과 동일. |
| 5 | concurrency | `deleteWorkspace`(신규 `assertWorkspaceDeletable`, Member→Workspace 잠금 순)와 `transferOwnership`(Workspace→Member 잠금 순)의 락 획득 순서가 반대라 동시 실행 시 데드락(`40P01`) 가능 — 기존 패턴이며 이 PR 이 만든 것은 아니지만 이번에 별도 메서드로 승격돼 노출. | `workspaces.service.ts:558-572`(`assertWorkspaceDeletable`) vs `:688-708`(`transferOwnership`) | 잠금 순서를 통일하거나 후속 트래커에 등재. |
| 6 | maintainability | `triggerResourceReleaser()` 지연 해석 헬퍼(ModuleRef.get + strict:false, 못 찾으면 throw)가 `WorkflowsService`/`WorkspacesService` 두 파일에 JSDoc 포함 거의 동일하게 복제 — 정책 변경 시 한쪽만 고쳐질 drift 위험. | `workflows.service.ts:292-305`, `workspaces.service.ts:588-598` | `trigger-resource-release.ts`에 `resolveTriggerResourceReleaser(moduleRef)` 공용 함수로 추출. |
| 7 | maintainability | `ChatChannelBinderService.setupChatChannel`(260줄 초과 단일 함수)에 거의 동일한 `undoAbsentTriggerWrite` 보상 블록이 성공/degraded 두 경로에 중복 추가돼 길이·복잡도 증가. | `chat-channel-binder.service.ts:296-305`, `:340-347` | 로컬 헬퍼 `undoWrite(cfg, caller)`로 두 호출부를 1줄씩으로 축약. |
| 8 | maintainability | `triggerSecretPrefix()`가 `secret-ref.ts`의 URI 빌더(`buildSecretRef`)를 재사용하지 않고 `'triggers'` 스킴을 별도로 하드코딩 — 스킴 변경 시 한쪽만 고쳐지면 `deleteByPrefix` LIKE 매칭이 조용히 어긋날 위험. | `trigger-resource-release.ts:27-29` | `secret-ref.ts`에 `buildSecretPrefix(scope, resourceId)` 공용 헬퍼 추가 후 위임. |
| 9 | testing | `ChatChannelBinderService.setupChatChannel`에 신규 추가된 두 보상 분기(성공/degraded)가 그 클래스 자신의 spec 파일엔 테스트가 없고 `TriggersService` 통합 스펙에서만 검증됨 — 클래스 단독 회귀 확인 시 놓치기 쉬움. | `chat-channel-binder.service.ts:292,337,369`; 검증은 `triggers.service.spec.ts`에서만 | `chat-channel-binder.service.spec.ts`에 `setupChatChannel` 전용 describe 추가(성공/degraded 보상, 성공 시 미보상 케이스). |
| 10 | documentation | 직전 5개 연속 `fix` 커밋 전부 갱신한 `CHANGELOG.md`가 이번 자원 누수 수정(운영 영향 큼)에서는 갱신되지 않음 — 저장소 확립 관행 이탈. | `CHANGELOG.md`(diff 미포함), 관련 커밋 `1544a1501`/`a11889086` | `## Unreleased`에 문제·원인·수정·검증 형식으로 항목 추가. |
| 11 | documentation | `ChatChannelBinderService`의 로그가 여전히 `TriggersService:` 접두를 사용 — 이미 트래커에 "다음에 이 파일 손댈 때 정정"으로 등재됐고, 이번 PR 이 정확히 그 기회였는데 오히려 호출 경로만 5곳으로 확대(정정 안 됨). | `chat-channel-binder.service.ts:379`(및 105·312·315) | 네 곳을 `ChatChannelBinderService:`로 정정하거나, 못 하면 트래커에 "블라스트 반경 확대" 사실을 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 12 | security | 워크스페이스 삭제 소유자 재검사의 좁은 TOCTOU 창(가용성 영향만, 이미 문서화·부분 테스트됨) | `workspaces.service.ts` `deleteWorkspace`/`assertWorkspaceDeletable` | 필요 시 창을 더 좁히거나 plan 알려진 리스크로 명시. |
| 13 | security | 커밋 후 비밀 삭제 실패는 예외 없이 로그만 남김 — 반복 실패 시 고아 암호문 잔존 가능(이미 sweeper 후속 트래커 등재됨) | `trigger-resource-release.ts` `deleteTriggerSecretsAfterCommit` | 기존 트래커 항목에서 sweeper/알림 검토. |
| 14 | architecture | `ModuleRef.get(..., {strict:false})` Service Locator 가 두 서비스의 진짜 의존성을 생성자 밖으로 숨김(순환 회피 목적, 문서화됨) | `workflows.service.ts:300-305`, `workspaces.service.ts:593-598` | 관용구를 conventions 문서에 등재. |
| 15 | architecture | `TriggerResourceReleasePort`가 `EntityManager`를 시그니처에 노출해 완전한 영속성-불가지적 포트는 아님 | `trigger-resource-release.ts:132-135` | 현행 유지 가능, 타 영속성 계층 이관 시 재검토. |
| 16 | architecture | 삭제 안무 순서(외부해제→잠금→열거→행삭제→커밋→비밀정리)가 타입이 아닌 관례+단위테스트로만 강제 | `workflows.service.ts:263-283`, `workspaces.service.ts:498-538` | 호출부 3개 이상으로 늘면 템플릿 메서드로 승격 고려. |
| 17 | architecture | `releaseExternalMany`의 트리거 타입별 분기가 인라인 하드코딩(전략 레지스트리 아님) | `trigger-resource-releaser.service.ts:128-147` | 타입 3~4개 이상 시 맵/레지스트리 리팩터 고려. |
| 18 | requirement / SPEC-DRIFT | `[SPEC-DRIFT]` `spec/2-navigation/2-trigger-list.md §4.3`의 "그 전까지는 트리거 화면 삭제만 정리한다" 과도기 문구와 `data-flow/10-triggers.md §1.4` Planned 태그가 이 PR 착지 시 낡음 — 코드는 spec 최종 요구사항과 line-level 일치, 이미 consistency-check·plan 체크리스트에 추적됨(새로 등재 불요). | `spec/2-navigation/2-trigger-list.md:287`, `spec/data-flow/10-triggers.md §1.4` | `--impl-done` 이후 별도 `project-planner` 턴에서 과도기 문구 삭제 + Planned 태그 정합 + `secret-store.md` status: partial→implemented. |
| 19 | requirement | `lockParentAndListTriggerIds`가 부모 `findOne` 결과(`null`)를 확인하지 않음(non-locking `findById` 직후 동시 삭제 레이스, 기존 클래스와 동일 성격) | `trigger-resource-releaser.service.ts` | 명시적 조기 반환(빈 배열) 방어 고려, 급하지 않음. |
| 20 | requirement | `WorkspacesService.deleteWorkspace` 트랜잭션 내 워크스페이스 행이 두 번 잠김(no-op성 중복) | `workspaces.service.ts` | 차단 사유 아님. |
| 21 | concurrency | 동시 중복 DELETE 요청 시 `lockParentAndListTriggerIds`가 부모 `findOne`의 `null`(이미 삭제됨)을 무시 → 감사 로그 중복 기록 가능(데이터 손상 아님, 기존 성격 문제) | `trigger-resource-releaser.service.ts:64-76` | 필요 시 반환값 확인 후 감사 로그 스킵. |
| 22 | testing | `releaseExternalMany`의 혼합 트리거 타입(schedule+webhook) 부분 실패 상호작용 미검증 — CRITICAL #1과 연관, fail-fast 의도 확인 목적 | `trigger-resource-releaser.service.ts:128` | 혼합 타입 부모에서 schedule 실패 시 webhook teardown 미호출 단언 테스트 추가. |
| 23 | testing | `assertWorkspaceDeletable` 이중 검사 사이 역할 변경(다른 결과 반환) 케이스 미검증 — WARNING #2/#4 재현 테스트 부재 | `workspaces.service.ts:544` | `mockResolvedValueOnce` 체인으로 role 변경 케이스 추가. |
| 24 | documentation | "다른 지연 해석은 못 찾으면 no-op" 비교가 두 개의 다른 기존 패턴(캐치 위치가 resolver vs caller)을 뭉뚱그림 — 실사용 영향 없음 | `trigger-resource-release.ts:19` 등 | 선택적, "caller 가 삼키면"으로 표현 정정. |
| 25 | architecture/maintainability | `lockParentAndListTriggerIds`의 if/else 두 분기가 구조 반복(부모 타입 2종) | `trigger-resource-releaser.service.ts:64-76` | 부모 타입 증가 시 공통화 고려, 현재는 불필요. |
| 26 | maintainability | `TriggerParent`를 TypeORM `where`로 암묵적 재사용(컬럼명 일치 전제, 문서화 안 됨) | `trigger-resource-releaser.service.ts:56,78-79` | JSDoc에 계약 명시. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 결함 수정 성격, TOCTOU/sweeper 잔여 리스크는 INFO |
| architecture | LOW | Service Locator·중복 헬퍼·안무 순서 비강제 등 구조적 관찰(WARNING 1 + INFO 4) |
| requirement | LOW | spec 대조 line-level 일치, SPEC-DRIFT 1건은 이미 추적됨 |
| scope | NONE | 27개 파일 전부 단일 의도에 부합, 이탈 없음 |
| side_effect | MEDIUM | 워크스페이스 재검사 실패 시 외부 해제 미롤백(WARNING) |
| maintainability | LOW | 헬퍼 복제·보상 블록 중복·URI 빌더 미재사용(WARNING 3건) |
| testing | LOW | 테스트 스위트 전반 견고, 커버리지 갭 3건(WARNING 1 + INFO 2) |
| documentation | LOW | CHANGELOG 미갱신, 트래킹된 로그 오표기 미정정(WARNING 2건) |
| concurrency | **HIGH** | 배치 schedule job 해제 비원자성(CRITICAL), 외부해제-잠금 시차·락 순서 비대칭(WARNING) |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 대조, 매칭 0건 |

## 발견 없는 에이전트

없음 (scope·user_guide_sync 는 "위반/매칭 없음"을 실질 결론으로 보고 — 별도 분류 유지).

## 권장 조치사항

1. **(CRITICAL 최우선)** `releaseExternalMany`의 schedule job 배치 해제를 원자적/명시적 정책으로 재설계 — `Promise.allSettled`로 실패 목록과 함께 던지거나 best-effort 로그로 전환. 스케줄 2개 이상 부분 실패 뮤테이션 테스트 선행 추가로 갭을 먼저 실증.
2. 워크스페이스 삭제의 "잠금 없는 선검사 → 외부 해제 → 잠금 재검사" 창(WARNING #2/#4)에 대해 최소 로그 가시화, 가능하면 창 축소. `plan` D7 표에 권한 철회 경합을 별도 행으로 명시.
3. `releaseExternalForParent`(스냅샷) vs `lockParentAndListTriggerIds`(잠금 열거) 시차(WARNING #3)로 인한 부모 삭제 도중 신규 트리거의 외부 자원 누락 — 설계상 SoT를 잠금된 열거로 통일하는 근본 해법 검토, 최소 sweeper 트래커에 시나리오 명시.
4. `deleteWorkspace`/`transferOwnership` 락 순서 비대칭(WARNING #5) 후속 트래커 등재 또는 통일.
5. 유지보수성 3건(헬퍼 복제, 보상 블록 중복, URI 빌더 미재사용) — 다음 관련 파일 수정 시 함께 추출.
6. `CHANGELOG.md` Unreleased 항목 추가, `ChatChannelBinderService` 로그 접두 정정(둘 다 이번 PR 관행/트래커 이행 문제).
7. `chat-channel-binder.service.spec.ts`에 `setupChatChannel` 전용 테스트 추가(WARNING #9), 혼합 타입 부분 실패·역할 변경 경쟁창 테스트(INFO #22/#23) 추가.
8. SPEC-DRIFT 항목(#18)은 코드 변경 불요 — `--impl-done` 이후 별도 `project-planner` 턴에서 `2-trigger-list.md §4.3`/`data-flow/10-triggers.md §1.4`/`secret-store.md` status 정합만 갱신.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(자원 정리 로직 배선)이 성능 특성에 미치는 영향 낮음으로 스코프 제외 |
  | dependency | 신규 외부 패키지/버전 변경 없음 |
  | database | 스키마 마이그레이션 없음(기존 FK CASCADE 활용, 신규 컬럼/인덱스 없음) |
  | api_contract | 컨트롤러·DTO·API 응답 스키마 변경 없음(내부 서비스 계층 리팩터) |
