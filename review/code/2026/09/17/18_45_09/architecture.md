# 아키텍처 리뷰 — 트리거 삭제 자원 정리 (trigger-deletion-release)

검증을 위해 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash` 대조만 수행). `git status --short` 로 확인한 잔여 변경 없음.

## 발견사항

- **[WARNING]** Service Locator 로 모듈 경계·DI 그래프를 우회한다 — `WorkflowsService`·`WorkspacesService` 의 진짜 의존성이 생성자 시그니처에 드러나지 않는다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:300-305`(`triggerResourceReleaser()`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:593-598`(동일 메서드)
  - 상세: 두 서비스 모두 `TriggerResourceReleasePort` 를 생성자 주입이 아니라 `this.moduleRef.get(TRIGGER_RESOURCE_RELEASER, { strict: false })` 로 매 호출마다 해석한다. `strict:false` 는 Nest 의 모듈 캡슐화(`exports`)를 건너뛰고 전역 컨테이너를 뒤져 provider 를 찾는 동작이라 — 실제로 `TriggersModule` 은 `TriggerResourceReleaserService`/`TRIGGER_RESOURCE_RELEASER` 를 `exports` 에 넣지 않았는데도(module 정의 확인: `exports: [TriggersService]` 뿐) 정상 동작한다. 즉 이 provider 는 module 시스템이 보장하는 "명시적으로 export 한 것만 쓸 수 있다" 는 경계 밖에서 발견된다. 순환 참조를 피하기 위한 의도적 선택(코드 JSDoc·plan 모두에 근거 명시)이고 실패 시 던지도록 강화한 점도 확인했지만, 이 패턴이 늘어나면 "이 서비스가 실제로 무엇에 의존하는가" 를 타입·생성자만 보고 알 수 없는 클래스가 늘어난다.
  - 제안: 현재 범위(순환 회피 1곳)에서는 문서화가 잘 되어 있어 수용 가능하나, 같은 방식을 다른 provider 로 확장하기 전에 Nest 의 `forwardRef` 없는 순환 회피 표준 관용구로 이 저장소 conventions 문서에 등재하는 것을 권한다.

- **[INFO]** 같은 lazy-resolution 헬퍼가 두 파일에 축약 없이 중복
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:292-305`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:588-598`
  - 상세: `triggerResourceReleaser()` private 메서드가 JSDoc 문구까지 거의 동일하게 두 서비스에 각각 존재한다. 이 메서드가 담고 있는 정책(다른 지연 해석과 달리 **못 찾으면 삼키지 않고 던진다**)은 저장소 전체 규칙과 다른 예외적 동작이라, 두 사본 중 하나만 고치고 다른 하나를 놓치는 drift 위험이 있다.
  - 제안: 작은 공유 헬퍼(`resolveTriggerResourceReleaser(moduleRef: ModuleRef): TriggerResourceReleasePort`)로 추출해 `trigger-resource-release.ts` 등 공용 위치에 두면, throw 정책 변경이 한 곳으로 수렴한다.

- **[INFO]** `TriggerResourceReleasePort` 가 TypeORM `EntityManager` 를 시그니처에 노출해 포트가 완전히 영속성-불가지적이지 않다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:132-135`(`lockParentAndListTriggerIds(manager: EntityManager, parent: TriggerParent)`)
  - 상세: 이 포트는 애초에 "호출자가 `triggers/` 내부 구현 클래스를 파일 수준에서도 import 하지 않게" 하려고 도입됐다(같은 파일 JSDoc). 그런데 트랜잭션을 호출자(`WorkflowsService`/`WorkspacesService`)가 열고 그 `manager` 를 포트에 되돌려주는 구조라, 포트 자체는 TypeORM 트랜잭션 관리자 타입에 결합된다. 저장소 전체가 TypeORM 으로 통일돼 있어 실질적 위험은 낮지만, "구현 클래스는 숨기되 ORM 타입은 숨기지 못하는" 절반의 추상화라는 점은 남는다.
  - 제안: 현 상태 유지 가능. 다만 이 포트를 다른 영속성 계층(예: 별도 마이크로서비스)으로 옮길 계획이 생기면 `EntityManager` 대신 트랜잭션 컨텍스트를 추상화하는 별도 타입이 필요하다는 점을 관련 spec/convention 에 남겨두면 좋다.

- **[INFO]** 삭제 안무(choreography)의 순서가 타입 시스템이 아니라 관례+단위테스트로만 강제된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-283`(`remove()`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-538`(`deleteWorkspace()`)
  - 상세: 두 메서드 모두 `releaseExternalForParent()`(트랜잭션 밖) → `manager.transaction(...)` 안에서 `lockParentAndListTriggerIds()` → **호출자가 직접** `manager.remove(parent)`(또는 `wsRepo.remove`) 호출 → 커밋 → `releaseSecretsAfterCommit()` 순서를 지켜야 불변식(잠금 후 연 트리거만 비밀 정리 대상)이 성립한다. 이 "부모 행 삭제" 단계는 포트의 책임이 아니라 트랜잭션 콜백 중간에 호출자가 끼워 넣는 임의 코드이므로, 포트의 타입 시그니처만 봐서는 올바른 순서를 강제할 수 없다 — 실제로 plan 의 뮤턴트 목록(M8·M9)도 "열거를 트랜잭션 밖으로", "잠금 전에 열거" 같은 순서 뒤집기를 오직 단위 테스트로만 잡는다고 명시한다.
  - 제안: 현재로선 두 호출부뿐이라 테스트로 충분히 방어되고 있다(리뷰에서 뮤턴트 표 확인). 호출부가 셋 이상으로 늘어나면 `releaser.deleteParentWithCleanup(parent, (manager, workspace) => manager.remove(workspace))` 형태의 템플릿 메서드로 승격해, "잠금→열거→콜백→커밋→비밀정리" 순서 자체를 포트가 소유하도록 하는 편이 안전하다.

- **[INFO]** `TriggerResourceReleaserService.releaseExternalMany` 가 트리거 타입별 분기를 인라인으로 하드코딩 — 개방-폐쇄 원칙에 약간의 긴장
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:128-147`
  - 상세: `scheduleTriggerIds = triggers.filter(t => t.type === 'schedule')` 로 스케줄 전용 해제(BullMQ)를 이 한 메서드 안에서 처리하고, 그 아래 루프에서 모든 트리거에 대해 chat-channel teardown + listener unregister 를 호출한다. 현재는 trigger 타입이 소수(webhook/schedule/manual 등)로 고정돼 있어 문제가 되지 않지만, 새 트리거 타입이 자신만의 외부 자원(예: 별도 큐, 별도 registry)을 갖게 되면 이 메서드를 계속 수정해야 한다 — 타입별 해제 전략을 다형적으로 등록하는 구조(전략 목록)가 아니다.
  - 제안: 현재 스코프에서는 조기 추상화가 오히려 손해이므로 유지 가능. 트리거 타입이 3~4개를 넘어서는 시점에 "타입 → 해제 전략" 맵/레지스트리로 리팩터링을 고려할 만하다는 점만 기록해 둔다.

## 확인된 긍정적 설계 (참고)

- **순환 의존성 회피가 실측으로 성립한다.** `WorkflowsModule`/`WorkspacesModule` 이 `TriggersModule` 을 import 하지 않고 `ModuleRef` 지연 해석으로 대체한 근거를 실제 module 파일 3개(`triggers.module.ts`, `schedules.module.ts`, `workflows.module.ts`)를 직접 읽어 대조했다 — `TriggersModule → SchedulesModule → ExecutionEngineModule`(schedules.module.ts 확인) 이고 `ExecutionEngineModule` 은 이미 `WorkflowsModule` 과 `forwardRef` 순환 중(workflows.module.ts 확인)이라, `WorkflowsModule → TriggersModule` 을 더하면 실제로 새 순환이 닫힌다. 새 `forwardRef` 를 추가하는 대신 토큰 기반 지연 해석 + Port 인터페이스로 해결한 것은 이 코드베이스가 이미 `forwardRef` 순환을 의도적으로 제거해 온 방향(plan 이 인용한 `#676`)과 일관된다.
- **정책과 배선의 분리가 깨끗하다.** `trigger-resource-release.ts` (순수 함수 + `TriggerResourceReleasePort` 타입)와 `TriggerResourceReleaserService`(Nest DI 배선)의 분리는 정책 로직을 프레임워크에서 독립시켜 두 계층 모두 독자적으로 단위 테스트 가능하게 만든다. `SchedulesService.remove()` 가 순환 때문에 서비스 대신 순수 함수(`deleteTriggerSecretsAfterCommit`)를 직접 부르는 우회로도 결국 **같은 함수**를 재사용하므로 정책 중복은 없다(호출 경로만 둘, 로직은 하나).
- **SRP 개선.** `TriggersService.remove()` 에서 `ChannelListenerRegistry`·schedule 조회·chat-channel teardown 로직이 전부 제거되고 `resourceReleaser.releaseExternal(trigger)` 한 줄로 위임됐다(실제 파일에서 `ChannelListenerRegistry` import·주입이 완전히 사라진 것을 grep 으로 확인). 트리거 CRUD 서비스가 외부 자원 해제 오케스트레이션 책임을 잃은 것은 바람직한 방향이다.
- **인터페이스 분리가 적절하다.** `TriggerResourceReleasePort` 는 워크플로/워크스페이스 삭제가 실제로 쓰는 3개 메서드만 노출하고(`releaseExternal` 단일 트리거 버전, `undoAbsentWrite` 쓰기 보상 등은 포트에 없음), 구현 클래스는 그 이상을 제공하되 호출자는 타입 수준에서 그 이상을 볼 수 없다.

## 요약

이번 변경은 "트리거 행을 없애는 네 경로가 자원을 정리한다"는 정책을 순수 함수(`trigger-resource-release.ts`)로 단일화하고, Nest 모듈 순환을 토큰+`ModuleRef` 지연 해석으로 우회하는 Port/Adapter 구조로 잘 조직했다. 순환 회피 근거는 실제 module 파일을 대조해 사실임을 확인했고, `TriggersService` 의 책임이 줄어드는 등 SRP·응집도 측면에서 개선이다. 다만 `ModuleRef.get(..., {strict:false})` 라는 Service Locator 는 두 서비스(`WorkflowsService`/`WorkspacesService`)의 진짜 의존성을 생성자 밖으로 숨기고 Nest 의 export 캡슐화를 우회하며, 그 해석 헬퍼가 두 파일에 그대로 복제돼 있다. 또한 삭제 안무의 정확한 순서(외부 해제 → 잠금 → 열거 → 부모 삭제 → 커밋 → 비밀 정리)는 타입이 아니라 관례와 단위 테스트로만 강제된다 — 현재 호출부가 둘뿐이라 위험은 낮지만 셋 이상으로 늘어나면 템플릿 메서드로 승격을 고려할 만하다. 전부 CRITICAL 은 아니며, 순환 회피라는 정당한 이유가 있는 트레이드오프에 대한 관측 기록에 가깝다.

## 위험도

LOW
