# 아키텍처 리뷰 — 트리거 삭제 자원 정리 (trigger-deletion-release, 3라운드)

검증을 위해 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash` 대조만 수행). `git status --short` 확인 결과 세션 시작 시점의 `review/code/2026/09/17/19_40_27/` 외 잔여 변경 없음.

본 라운드는 2라운드(`review/code/2026/09/17/19_14_29/architecture.md`)가 지적한 W2(부모 삭제 트랜잭션 잠금에 `lock_timeout` 없음)가 `RESOLUTION.md`·커밋 `d2184dcf2`에서 실제로 어떻게 처분됐는지 현재 소스를 직접 열어 대조하고, 그 처분 과정에서 새로 생긴 아키텍처 관점 결함이 있는지를 본다. 이번 diff 에 포함된 나머지 파일(`CHANGELOG.md`, `jest.config.ts` 주석, 1·2라운드 리뷰 산출물 자체)은 서술/문서 변경이라 아키텍처 판단 대상이 아니다.

## 2라운드 지적사항 처분 확인 — 문제 없음, 오히려 설계가 개선됐다

실제 파일을 열어 대조한 결과 W2 는 주장대로 고쳐졌고, 고친 방식이 "계약을 문서에만 적는" 이전 방식보다 구조적으로 낫다:

- `trigger-config-lock.ts:63-70` 에 `setLocalLockTimeout(manager, timeoutMs)` 를 독립 함수로 분리하고, `acquireTriggerConfigLock` 도 이 함수를 통해 같은 SQL 경로를 지나도록 리팩터했다(`trigger-config-lock.ts:102`). 값 형태 보장(`toLockTimeoutMs`)이 한 곳에 남아 SQL 인젝션 방지 책임이 분산되지 않는다.
- `TriggerResourceReleasePort.lockParentAndListTriggerIds` 의 "트랜잭션의 첫 호출이어야 한다"는 계약(`trigger-resource-release.ts:152-155`)을, **호출자가 지키게 문서로만 요구하지 않고 구현 자체(`trigger-resource-releaser.service.ts:76`)가 잠그기 직전에 `setLocalLockTimeout` 을 실행**하는 형태로 옮겼다. 즉 "타입 시스템이 강제하지 못하는 순서 계약"이라는 2라운드 이전부터의 INFO 지적(1라운드 architecture.md 안무 순서 항목)의 일부가, 적어도 이 하위 규칙(락 상한)에 한해서는 **포트 구현이 스스로 지키는 방식으로 승격**됐다 — 호출자(`WorkflowsService`/`WorkspacesService`)는 이제 상한을 신경 쓸 필요가 없다.
- `workspaces.service.ts:520-531` 에서 `lockParentAndListTriggerIds` 를 `assertWorkspaceDeletable`(재검사) **앞**으로 옮겼다 — 잠금 순서(워크스페이스 → 멤버십)는 그대로 유지한 채, "부모 행을 먼저 잠근 뒤 연다"는 불변식과 "트랜잭션의 첫 호출"이라는 새 계약을 동시에 만족시킨다. 재배치가 판정 순서(권한→존재→타입)를 건드리지 않았음을 `assertWorkspaceDeletable` 본문(`:564-598`) 대조로 확인했다.
- `workflows.service.ts:263-291` 은 원래도 `lockParentAndListTriggerIds` 가 트랜잭션의 첫 호출이었으므로 재배치가 필요 없었다 — 두 호출부가 이제 정확히 같은 형태(포트 호출이 첫 줄)로 수렴했다.

## 발견사항 (신규 없음 — 재확인만)

- **[INFO]** 2라운드가 지적한 세 항목(삭제 안무 4곳 중복 · `TriggerResourceReleaserService`의 타 도메인 엔티티(`Workflow`/`Workspace`) 직접 import · ModuleRef 서비스 로케이터의 모듈 캡슐화 우회)은 이번 라운드의 코드 변경(`d2184dcf2`) 범위에 포함되지 않았고, RESOLUTION 에 "동작 결함이 아니므로 등재"로 명시적으로 처분돼 `plan/in-progress/trigger-deletion-release.md` 체크리스트(`트래커 항목 1 갱신` · `4-execution-engine.md §4.4` planner 후속)에 등재돼 있음을 확인했다(`plan/in-progress/trigger-deletion-release.md:163,176`). 이번 라운드에서 상태가 바뀌지 않았으므로 새 발견사항으로 세지 않는다 — 다만 다음에 이 영역(트리거/스케줄/워크플로/워크스페이스 삭제 안무)에 다섯 번째 호출부가 생기거나, `TriggerParent` 에 세 번째 부모 타입이 추가되는 시점에는 등재된 조건이 실제로 충족되므로 반드시 트래커 항목을 집행해야 한다.
- **[INFO]** `setLocalLockTimeout` 이 이제 두 개의 서로 다른 호출부(트리거 단건 삭제의 `acquireTriggerConfigLock`, 부모 삭제의 `lockParentAndListTriggerIds`)에서 같은 상수 클래스(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`, 5초)를 공유한다 — 결합 자체는 의도된 것(spec 트리거 목록 §4.4 가 "같은 규칙"이라고 명시)이라 문제는 아니지만, 두 호출부가 트랜잭션 안에서 "첫 호출이어야 한다"는 암묵적 순서 계약을 각자 다른 방식(하나는 옵션 객체를 통해 조건부 호출, 하나는 함수 진입 즉시 무조건 호출)으로 satisfy 하고 있어 계약이 코드 형태로는 통일돼 있지 않다. 위험은 낮다(현재 두 호출부 다 정적으로 위치가 고정돼 있어 순서를 어길 여지가 사실상 없다).
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:63`(`setLocalLockTimeout` 정의), `:95-102`(`acquireTriggerConfigLock` 옵션부 호출), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:76`(`lockParentAndListTriggerIds` 무조건 호출)
  - 제안: 현재 유지 가능. 세 번째 호출부가 생기면 "트랜잭션을 열 때 상한을 강제로 같이 건다"는 형태(예: 트랜잭션 오프너 헬퍼가 콜백 실행 전에 상한을 걸어주는 래퍼)로 승격을 고려.

## 확인된 긍정적 설계 (참고)

- **되돌릴 수 없는 부작용(외부 자원 해제)과 되돌릴 수 있는 부작용(행 삭제)의 경계가 이번 수정으로 더 선명해졌다.** "락 전에 되돌릴 수 없는 정리를 끝낸 경로만 상한을 건다"는 정책(`setLocalLockTimeout` JSDoc)이 트리거·부모 삭제 두 계열에서 동일하게 관철되며, 그 강제 지점이 호출자 재량에서 포트 구현으로 옮겨간 것은 "정책은 한 곳, 배선은 호출자" 구조(`trigger-resource-release.ts` 헤더 주석)를 오히려 더 지킨 방향의 변경이다.
- 순환 의존성 재확인: `SchedulesModule`(`schedules.module.ts:1-17`)은 `TriggersModule` 을 import 하지 않고 `Trigger` 엔티티 클래스만 참조하며, `SecretStoreModule`(`secret-store.module.ts`, `imports: [ConfigModule, TypeOrmModule.forFeature(...)]`)도 `TriggersModule`/`SchedulesModule` 어느 쪽도 참조하지 않는다 — `TriggersModule → SchedulesModule`, `SchedulesModule → SecretStoreModule` 두 간선 모두 역방향 간선이 없어 순환이 새로 생기지 않았다.

## 요약

2라운드가 지적한 유일한 동작 결함(부모 삭제 트랜잭션 잠금에 대기 상한 부재)은 실제 코드 대조 결과 처분대로 고쳐졌으며, 고친 방식이 "락 상한을 트랜잭션 첫 호출로 건다"는 계약을 호출자 관례가 아니라 포트 구현 자체에 내장시켜 이전보다 더 견고하다. 워크스페이스 삭제의 잠금-재검사 순서 재배치도 기존 불변식(워크스페이스→멤버십 잠금 순서, 판정 순서)을 깨지 않았다. 이번 diff 범위에서 새로운 아키텍처 결함은 발견되지 않았다. 1·2라운드에서 이미 식별하고 "등재"로 처분한 구조적 부채(삭제 안무 4곳의 손 중복, `TriggerResourceReleaserService`의 타 도메인 엔티티 직접 참조, `ModuleRef` 서비스 로케이터가 모듈 export 경계를 우회하는 점)는 plan 트래커에 명시적 조건(다섯 번째 호출부 / 세 번째 부모 타입 발생 시)과 함께 등재돼 있어 이번 라운드의 신규 차단 사유가 아니다.

## 위험도

LOW
