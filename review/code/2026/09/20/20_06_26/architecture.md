# 아키텍처 리뷰 — 동시 중복 DELETE 감사 (dup-delete-audit)

## 발견사항

- **[WARNING]** `WorkspacesService.deleteWorkspace` 는 워크플로 쪽과 같은 "부모 부재" 신호를 받고도, 그 처리를 위임한 `assertWorkspaceDeletable` 이 실제로는 **403(OWNER_REQUIRED)** 을 던지고, 바깥 `.catch` 는 그 케이스를 다른 진짜 실패와 구분 없이 **거짓 ERROR 로그**로 남긴다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:519-527`(신규 주석 — "판정이 한 곳에 남는다"), `:567-601`(`assertWorkspaceDeletable`, 특히 `:578-593` 판정 순서: 멤버십 → 존재), `:541-549`(`.catch` — `NotFoundException` 을 특별 취급하지 않음)
  - 상세: 이 PR 은 같은 헬퍼(`lockParentAndListTriggerIds`)를 쓰는 `WorkflowsService.remove()` 에서 "동시 삭제로 행이 이미 사라진 경우는 반쯤 삭제된 상태가 아니다 … 이 경우까지 실으면 거짓 경보가 된다" 는 이유로 `NotFoundException` 을 `.catch` 에서 특별 분기시켜 error 로그를 억제했다(`workflows.service.ts:289-301`). 그런데 워크스페이스 삭제는 새로 추가한 주석에서 "부모 부재는 여기서 따로 보지 않는다 — 바로 아래 잠금 재검사가 사라진 워크스페이스를 거부하므로 판정이 **한 곳에 남는다**" 라고 말하지만, 실제로 동시 삭제 경합이 나면:
    1. 먼저 커밋한 요청이 워크스페이스·멤버·초대 행을 **모두** 지운다(`:536-538`).
    2. 진 쪽 트랜잭션의 `assertWorkspaceDeletable` 은 `workspace` 도 `myMembership` 도 둘 다 못 찾는데, 판정 순서가 **멤버십(권한) 을 존재보다 먼저** 검사하도록 문서로 고정돼 있다(`:565-566` "판정 순서(권한 → 존재 → 타입)는 그와 별개로 유지한다"). 그래서 `!myMembership` 이 먼저 걸려 `ForbiddenException({code:'OWNER_REQUIRED'})` 이 던져진다 — 실제로는 그 사용자가 방금 전까지 owner 였고 리소스가 사라진 것뿐인데, 응답은 "권한 없음" 이 된다. 트리거의 "두 번째 요청은 404" 대칭(spec §4.4)과 어긋난다.
    3. 이 예외는 `:541` 의 `.catch` 로 올라가고, 거기엔 `NotFoundException` 을 걸러내는 워크플로식 분기가 없어 무조건 `this.logger.error("… 워크스페이스는 남았지만 트리거는 발화하지 않을 수 있다(비밀은 남아 있다)")` 를 찍는다. 그런데 이 경합에서는 워크스페이스가 "남은" 게 아니라 **다른 요청이 이미 완전히, 정상적으로 지운 것**이다 — 바로 이 PR 이 워크플로 경로에서 "거짓 경보" 라고 부르며 고친 것과 같은 종류의 오탐이 워크스페이스 경로엔 그대로 남는다.
  - 이 자체는 이 PR 이 새로 만든 회귀는 아니다(`assertWorkspaceDeletable` 의 판정 순서·`.catch` 의 무조건 로그는 기존 코드다). 다만 이 PR 이 정확히 이 결함 클래스(동시 삭제 경합 시 오판정·거짓 로그)를 표적으로 잡았고, 새로 추가한 주석이 "판정이 한 곳에 남는다" 고 **정합성을 보장하는 것처럼** 서술하면서도 실제로는 상태 코드(403 vs 404)와 로그 신뢰성 양쪽에서 워크플로 쪽 수정과 대칭을 이루지 못한다는 점에서, 두 "쌍둥이" 서비스 메서드 간 계약 일관성이 깨져 있다. plan 문서(`plan/in-progress/dup-delete-audit.md` §B)도 "동작 변화 없음" 이라고만 적어 이 비대칭을 인지하지 못한 채 넘어갔다.
  - 제안: (a) `deleteWorkspace` 의 `.catch` 에서 워크플로와 동일하게 `NotFoundException`(및 이번 경합에서 나올 수 있는 `ForbiddenException({code:'OWNER_REQUIRED'})`) 를 구분해 에러 로그를 억제하거나, (b) `lockParentAndListTriggerIds` 가 이미 돌려주는 `parent: 'absent'` 를 워크플로처럼 이 자리에서 직접 검사해 `NotFoundException` 으로 즉시 끝내(트리거 §4.4 와 동일한 404 대칭 확보), `assertWorkspaceDeletable` 의 권한-우선 순서에 그 판정을 떠넘기지 않는 편이 더 명확하다. 최소한 plan 문서에 "워크스페이스 경로는 워크플로와 달리 403 으로 응답하고 거짓 ERROR 로그가 남을 수 있다" 는 사실을 한계로 기록해야 다음 사람이 "판정이 한 곳에 남는다" 는 주석만 보고 안전하다고 오판하지 않는다.

- **[INFO]** `RESOURCE_NOT_FOUND` / `'Workflow not found'` 리터럴이 `WorkflowsService` 안에서 두 번(최초 조회 실패 시, 그리고 이번에 추가된 잠금 뒤 부재 분기) 그대로 중복된다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:166-177`(`findById`), `:280-285`(신규 분기)
  - 상세: 같은 `code`·`message` 쌍이 한 파일 안에 두 곳으로 늘었다. 지금은 사소하지만, 두 자리 중 하나만 바뀌고 다른 하나를 놓치는 drift 가 생기기 쉬운 형태다(이 저장소가 이미 여러 번 겪은 "복사된 리터럴 한 곳만 갱신" 패턴).
  - 제안: `private workflowNotFound(): never { throw new NotFoundException({...}); }` 류의 private 헬퍼로 묶으면 이후 코드 리뷰가 이 두 자리를 따로 추적하지 않아도 된다. 급하지 않음.

- **[INFO]** (설계는 양호) `TriggerResourceReleasePort.lockParentAndListTriggerIds` 의 반환 타입을 `Promise<string[]>` 에서 `Promise<LockedParentTriggers>`(`{ parent: 'present' | 'absent'; triggerIds: string[] }`)로 바꾼 것은 "부재" 와 "0개" 를 truthiness 로 섞이지 않게 이름 있는 상태로 분리한 정석적인 판별 유니온이며, 두 호출부(`WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`) 와 두 spec 파일이 모두 함께 갱신됐다. 포트가 `EntityManager`/락 모드를 이미 JSDoc 에 노출하고 있어 "Locked" 라는 영속성 계층 개념이 포트 이름에 섞여도 기존 설계 궤적과 일치한다 — 새로운 추상화 누수가 아니다. `resolveTriggerResourceReleaser` 를 통한 `ModuleRef.get(TOKEN, { strict: false })` 지연 해석(순환 의존 회피, `#676` 선례)도 이번 diff 로 훼손되지 않았다.

## 요약

핵심 변경(`LockedParentTriggers` 도입, `WorkflowsService.remove()` 의 404 분기, e2e 로 경합을 결정적으로 재현)은 SOLID·의존성 역전·순환 회피 측면에서 견고하다 — 포트가 이미 버리던 값을 그대로 돌려주는 최소 변경으로 감사 중복을 닫았고, 판별 유니온으로 "부재"와 "0개"를 명시적으로 갈랐으며, 두 호출부와 테스트가 함께 갱신됐다. 다만 이 PR 이 표적으로 삼은 결함 클래스(동시 삭제 경합 시 오판정·거짓 운영 로그)가 쌍둥이 경로인 `WorkspacesService.deleteWorkspace` 에는 대칭적으로 닫히지 않는다 — 그쪽은 기존의 "권한 → 존재" 판정 순서 때문에 진 쪽 요청이 404 대신 403(OWNER_REQUIRED)을 받고, `.catch` 가 그 경합을 진짜 실패와 구분 없이 "수동 정리가 필요하다"는 거짓 ERROR 로그로 남긴다. 이번에 추가된 주석("판정이 한 곳에 남는다")은 이 비대칭을 감춘 채 정합성을 보장하는 것처럼 읽혀, 다음 사람이 두 경로가 완전히 대칭이라고 오판할 위험이 있다. 그 외엔 레이어 책임·모듈 경계·순환 의존 문제가 없고, 사소한 리터럴 중복(INFO) 정도만 남는다.

## 위험도

MEDIUM
