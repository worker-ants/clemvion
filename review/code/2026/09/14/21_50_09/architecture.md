# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 같은 `Trigger.config` 자원에 대해 세 번째 쓰기 관용구가 추가되어, 이제 세 가지 서로 다른 락/쓰기 형태가 공존한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588-637`(창 1 — 인라인 `acquireTriggerConfigLock` + 재조회 + `m.save(Trigger, target)`), `codebase/backend/src/modules/triggers/triggers.service.ts:977-991`(삭제 — 인라인 `acquireTriggerConfigLock(..., { timeoutMs })` + `m.remove(trigger)`), `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-173`(`rewriteTriggerConfigLocked` — 창 2·3·4가 공유하는 컬럼-한정 update)
  - 상세: 이번 라운드에서 삭제 경로에 대기 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)까지 포함한 세 번째 인라인 관용구가 추가됐다. 세 형태가 서로 다른 이유(엔티티 전체 저장 계약 보존/INSERT 방지/삭제 후 무한 대기 방지)는 코드 주석과 `trigger-config-lock.ts`의 JSDoc 표(창별 삭제-경합 노출 방식)에 상세히 문서화돼 있어 "숨은 결함"은 아니다. 다만 `acquireTriggerConfigLock`이라는 공유 프리미티브 위에 호출부마다 손으로 트랜잭션·재조회·쓰기를 다시 조립하는 형태가 하나 더 늘어난 것이므로, 다음에 이 락을 잡는 자리가 생기면(예: 다른 엔티티의 config 필드) 넷 중 어느 관용구를 따라야 할지 판단 비용이 커진다.
  - 제안: 지금 배치를 막을 사유는 아니다. 다만 이전 라운드 architecture.md가 이미 제안한 `rewriteTriggerConfigLocked<T>(manager, entityClass, id, action)` 형태의 제네릭화를 후속 착수 시점에 검토할 때, `remove()`의 "재조회 없이 삭제 + 상한" 변형도 같은 프리미티브의 한 분기로 흡수할 수 있는지 함께 설계하면 네 번째 변형이 또 생기는 것을 막을 수 있다.

- **[INFO]** `rewriteTriggerConfigLocked`가 여전히 `Trigger` 엔티티에 하드코딩돼 있다 (이전 라운드 지적, 이번 라운드에도 변경 없음)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:151`(`m.findOne(Trigger, ...)`), `:170`(`m.update(Trigger, ...)`)
  - 상세: `review/code/2026/09/14/18_17_44/architecture.md` INFO#1과 동일한 관찰이 이번 라운드에도 그대로 유효하다. plan(`plan/in-progress/trigger-config-lost-update.md` §D)이 같은 패턴이 필요한 다른 엔티티(hooks/schedules 등 10곳)를 후속으로 등재해 뒀으므로, 지금 범위를 넓히라는 뜻은 아니다. 재확인 차원의 기록.
  - 제안: 조치 불요(추적됨). 후속 착수 시 제네릭화 검토.

- **[WARNING]** production 코드가 트랜잭션 경로를 새로 타면, 그 사실을 모르는 다른 spec 파일의 Trigger repository mock이 런타임 크래시로만 드러난다 — 컴파일 타임에 보장되지 않는 암묵적 계약
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:34-47`(docblock이 이 결합을 스스로 서술)
  - 상세: `withTransactionMock`의 JSDoc이 명시하듯, `Trigger` repository를 mock하는 파일이 저장소 전체에 **6개** 있고 이번 PR로 트랜잭션 경로(`update()`/`remove()`)를 실제로 타는 것은 그중 **2개**뿐이다. 나머지 4개(`auth-configs`·`external-interaction`·`hooks`·`schedules`)는 "지금은 안전하지만 그 경로를 호출하게 되는 순간 `Cannot read properties of undefined (reading 'transaction')`로 깨진다"고 스스로 적어 두었다. 즉 production 쪽의 내부 구현 세부사항(`triggerRepository.manager.transaction(...)`을 쓰는지 여부)이 코드 어디에도 선언되지 않은 채 6개 파일에 흩어진 손-작성 mock들과 암묵적으로 결합돼 있고, 이 결합이 깨졌다는 신호는 타입 오류가 아니라 "그 스펙 파일을 실행했을 때 나는 예외 메시지"뿐이다. 실제로 이번 PR 자체가 창 1이 트랜잭션을 타게 되면서 `triggers.web-chat.spec.ts`가 그렇게 깨졌던 사례를 인용하고 있다 — 같은 계약 위반이 아직 손대지 않은 4개 파일 중 하나에서 다음에 재발할 수 있는 구조다.
  - 제안: 지금 배치를 막을 사유는 아니되, 6개 파일 전체가 공용 팩토리(`withTransactionMock` 또는 그 상위의 표준 Trigger repo mock 빌더)를 기본으로 쓰도록 통일하면 이 결합이 "실행해야 드러나는 것"에서 "만들 때부터 존재하는 것"으로 바뀐다. 최소한 나머지 4개 파일에도 예방적으로 `withTransactionMock`을 적용해 두면 다음에 그 경로들이 트랜잭션을 타게 될 때 이 클래스의 회귀가 재발하지 않는다.

- **[INFO]** 정적 분석 가드(`endpoint-path-conflict-wrap-guard.ts`)가 production의 트랜잭션 콜백 중첩 구조를 한 단계 더 따라가도록 확장됐다 — 향후 중첩이 한 단계 더 늘면 같은 확장이 다시 필요하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:108-121`(`isWrappedByConflictCatch`의 `ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)` 분기)
  - 상세: `TriggersService.update()`의 저장이 `manager.transaction(async (m) => ...)` 콜백 안으로 들어가면서, 종전에 `ts.isStatement(cur)`에서 멈추던 AST 탐색이 그 경계를 넘지 못해 "래핑이 있는데 없다"로 오판했다(fail-safe 방향의 오탐이었지만, 방향이 반대였다면 fail-open 오탐이 될 수 있는 구조). 이번 수정으로 "함수형 노드의 부모가 호출식이면 콜백이므로 계속 올라간다"는 한 단계를 추가해 대응했다. 이 가드는 AST 기반이라 방식 자체는 적절하지만(정규식이 아니라 파서를 쓴 선택은 옳다), 지금의 탐색 종료 조건은 "콜백 한 겹"을 전제로 하드코딩돼 있어, 향후 리트라이 래퍼나 이중 트랜잭션 등으로 중첩이 한 겹 더 늘면 같은 클래스의 오탐이 다시 재발할 수 있다.
  - 제안: 지금 배치를 막을 사유는 아니다(fixture로 이 경계 조건 자체가 테스트되고 있음을 `endpoint-path-save.fixture.ts`에서 확인했다). 다만 이 가드의 콜백-경계 판정 로직에 "몇 겹까지 지원하는가"를 JSDoc에 명시해 두면, 다음에 중첩이 늘어날 때 이 파일도 함께 봐야 한다는 신호가 더 빨리 전달된다.

## 요약

이번 라운드는 이전 라운드(`review/code/2026/09/14/18_17_44`)가 LOW로 평가한 lost-update 수정 위에 (1) 삭제 경로도 같은 advisory lock으로 직렬화하고(대기 상한 포함), (2) 인입 웹훅 hot path의 `save(trigger)` 전체 저장을 `touchLastTriggeredAt`이라는 단일 컬럼-한정 update로 통합하고, (3) `chatChannel.inboundSigningRef` 추출 로직을 `extractInboundSigningRef` 순수 함수로 뽑아 3곳의 중복 인라인 캐스트를 제거한 것이 핵심이다. 세 변경 모두 기존에 확립된 경계(순수 함수 vs DI 클래스, 외부 호출을 락 밖에 두는 제약, 컬럼-한정 갱신)를 그대로 따르고 있어 구조적 일관성이 유지된다. `HooksService.touchLastTriggeredAt`으로의 추출은 두 호출부의 복제된 회귀 위험을 정확히 제거한 좋은 SRP/DRY 사례이고, `extractInboundSigningRef` 추출도 같은 이유로 긍정적이다. 다만 `Trigger.config` 쓰기에 대한 락/재조회 관용구가 이제 세 가지(창 1 인라인 save, 창 2~4 공유 헬퍼, 삭제 인라인 remove)로 늘었고, 이는 각각 문서화된 이유가 있지만 다음 확장 시 판단 비용을 키운다. 더 실질적인 관찰은 트랜잭션 경로 확장이 6개 중 4개 Trigger-repo-mock 스펙 파일에 대해서는 아직 반영되지 않은 암묵적 계약으로 남아 있다는 점과, 이 계약 위반이 타입 체크가 아니라 런타임 크래시로만 드러난다는 점이다. 이들은 모두 차단 사유가 아닌 INFO/WARNING 수준의 후속 개선 여지다.

## 위험도

LOW
