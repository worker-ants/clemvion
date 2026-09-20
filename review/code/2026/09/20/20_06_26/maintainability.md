# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 같은 함수 안에서 동일 식별자 `parent` 가 서로 다른 두 의미(파라미터 객체 vs 반환 상태 문자열)로 쓰인다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109` (`lockParentAndListTriggerIds`) — 함수 파라미터 `parent: TriggerParent`(81/83행)와 반환 객체 필드 `parent: parentRow ? 'present' : 'absent'`(105-108행)
  - 상세: 파라미터 `parent` 는 `{ workflowId }` / `{ workspaceId }` 형태의 "어느 부모를 지울지" 를 가리키는 객체이고, 반환 필드 `parent` 는 "잠글 때 그 행이 있었는가" 를 나타내는 `'present' | 'absent'` 상태 문자열이다. 같은 함수 스코프 안에 이름은 같고 타입·의미가 전혀 다른 두 값이 공존해, `return { parent: ... }` 를 훑어볼 때 순간적으로 입력 `parent` 와 혼동될 여지가 있다. `LockedParentTriggers` 인터페이스의 JSDoc 이 바로 위에서 의미를 설명해 두어 실제 오독 위험은 낮지만(호출부에서도 `locked.parent`/`locked.triggerIds` 로 명시 접근), 같은 이름 재사용은 이 저장소가 다른 곳에서 지켜온 "이름 있는 상태로 명시 비교" 원칙(같은 PR 의 JSDoc 이 스스로 강조하는 원칙)과 결이 어긋난다.
  - 제안: 반환 필드명을 `parent` 대신 `parentPresence` 또는 `parentStatus` 등으로 바꿔 파라미터 `parent` 와 시각적으로 구분되게 한다. 다만 이미 세 개 호출부(`trigger-resource-releaser.service.spec.ts`, `workflows.service.ts`, `workspaces.service.ts`)와 인터페이스 정의를 함께 바꿔야 하므로, 지금 당장 필수는 아니고 다음에 이 헬퍼를 만질 때 함께 정리해도 무방하다.

- **[INFO]** "동시 삭제로 인한 정상적 부재"를 다루는 방식이 형제 삭제 경로 두 곳에서 비대칭이다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:280-293`(신규: `NotFoundException` 을 명시적으로 분리해 "수동 정리 필요" 오경보 로그를 억제) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:522-523,541-550`(기존: `assertWorkspaceDeletable` 의 재검사가 사라진 워크스페이스를 거부해도 `.catch()` 가 무조건 "정리 필요" error 로그를 남긴다 — `assertWorkspaceDeletable` 자체가 부재 시 `NotFoundException({code:'WORKSPACE_NOT_FOUND'})` 를 던지므로(같은 파일 588-593행) 동시 삭제로 진 쪽이 겪는 정상적인 404 도 이 catch 를 통과한다)
  - 상세: 이번 PR 은 정확히 같은 개념적 결함(잠금 뒤 부모 부재를 호출자가 못 받아 두 번째 요청이 성공한 것처럼 처리됨)을 트리거 헬퍼 한 곳에서 고치면서, 워크플로 삭제 쪽에는 "부재는 실패가 아니다" 라는 판단을 반영해 오경보 로그까지 억제하는 반면, 워크스페이스 삭제 쪽은 새로 추가한 주석(522-523행)에서 "판정이 한 곳(`assertWorkspaceDeletable`)에 남는다" 고만 적고, 그 판정이 여전히 기존의 무조건 error 로그(541-550행, `WorkspacesService.deleteWorkspace: ... 수동 정리가 필요할 수 있다` 류 메시지)를 통과한다는 사실은 언급하지 않는다. 결과적으로 동일 계열의 "동시 삭제 두 번째 요청" 상황에서 워크플로는 조용히 404, 워크스페이스는 (기능은 맞아도) 운영자에게 거짓 경보성 error 로그를 남긴다 — 로그를 보는 사람 입장에서 두 삭제 경로가 같은 문제를 다르게 취급한다고 오해하기 쉽다. 이 catch 블록 자체는 이번 diff 가 건드린 줄이 아니라 기존 동작이므로 이번 PR 의 결함은 아니지만, 이번 PR 이 "부모 부재는 실패가 아니다" 라는 새 원칙을 한쪽에만 적용해 비대칭을 더 뚜렷하게 만들었다.
  - 제안: 급하지 않음(차단 사유 아님). 다음에 `deleteWorkspace` 를 만질 때 `assertWorkspaceDeletable` 이 던진 `NotFoundException`/`ForbiddenException` 을 `workflows.service.ts` 와 같은 방식으로 분리해 오경보 로그를 줄이는 편이 일관적이다. `plan/in-progress/dup-delete-audit.md` 가 이미 언급하는 "네 자리 공용 형태" 후속 설계(트랜잭션→실패 로그→재던짐 공용화) 항목에서 함께 정리하면 자연스럽다.

- **[INFO]** 동일한 "잠금→헬퍼 호출→트랜잭션 catch(로그)→커밋 뒤 비밀 정리" 4단계 패턴이 `WorkflowsService.remove`·`WorkspacesService.deleteWorkspace` 두 곳에서 반복된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-312`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-555`
  - 상세: 이 중복은 이번 PR 이 새로 만든 것이 아니라 기존 구조이고, `plan/in-progress/dup-delete-audit.md` §"이 PR 이 하지 않는 것"·plan_coherence 체커의 WARNING #2 가 이미 "같은 헬퍼를 겨냥한 별도 트래커의 공용 형태 설계 항목"으로 추적 중임을 명시하고 있다. 새로 지적할 필요는 없고, 향후 그 설계가 착수될 때 위 두 INFO 항목(로그 억제 비대칭 포함)도 함께 반영하면 된다.
  - 제안: 조치 불요 — 이미 추적됨.

## 요약

전반적으로 코드 품질이 높다. `LockedParentTriggers` 라는 이름 있는 상태 타입으로 "부모 부재"와 "트리거 0개"를 명시적으로 분리한 설계는 이 저장소가 반복해 밟았던 "truthiness 로 부재를 오판하는" 결함 패턴을 정확히 피했고, 각 파일의 JSDoc·주석이 "왜 이렇게 했는가"·"왜 이렇게 하지 않았는가"까지 촘촘히 남아 있어 가독성이 좋다. 함수 길이·중첩 깊이·순환 복잡도는 모두 적정 범위이며, 신규 유닛 테스트(부재/존재+0개 두 fixture로 두 사실을 가름)와 e2e 동시성 테스트(자체 락으로 경합을 결정론적으로 재현)도 판별력이 있다. 유일하게 지적할 점은 헬퍼 함수 하나에서 파라미터와 반환 필드가 같은 이름 `parent` 를 다른 의미로 재사용하는 사소한 네이밍 충돌(WARNING)과, 이번 PR 이 "부모 부재는 실패가 아니다" 라는 원칙을 워크플로 삭제 경로에만 적용해 워크스페이스 삭제 경로와의 로그 처리 비대칭을 남긴 점(INFO, 기존 동작이며 이미 추적 중인 후속 설계 항목에서 함께 정리 가능)이다. 둘 다 병합을 막을 사안은 아니다.

## 위험도
LOW
