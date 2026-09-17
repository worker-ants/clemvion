# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `acquireTriggerConfigLock` 의 `timeoutMs` 검증 실패 시 동작이 "조용한 오염된 SQL" 에서 "동기 throw" 로 바뀜 — 콜러 영향은 현재 0건, 방어적 변경
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `toLockTimeoutMs()` (46번째 줄 부근), 호출부 `acquireTriggerConfigLock()` 88번째 줄
  - 상세: `Number.isFinite` 검사를 통과 못 하면 `Error` 를 던지도록 바뀌었다(이전엔 `Math.trunc(NaN)` → `'NaNms'` 가 그대로 SQL 에 실렸다). 이 함수는 `Pick<EntityManager, 'query'>` 만 받는 내부 헬퍼이고 트랜잭션 콜백 안에서 호출되므로, throw 되면 그 트랜잭션 전체가 롤백되고 advisory lock 시도 자체가 나가지 않는다(테스트로 확인: "아무 SQL 도 나가지 않았다"). 실제 콜러 3곳(`triggers.service.ts:634,1038`, `schedules.service.ts:315`)을 확인한 결과 전부 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5000, 유한값)만 넘기므로 이 throw 경로는 현재 프로덕션에서 도달 불가능하다. 두 삭제 경로(`TriggersService.remove()`, `SchedulesService.remove()`)모두 트랜잭션을 `.catch((err) => { this.logger.error(...); throw err; })` 로 감싸고 있어, 만약 미래에 이 경로가 도달하더라도 unhandled rejection 없이 로그를 남기고 정상적으로 전파된다.
  - 제안: 현재 구조로 충분. 다만 `Error` 가 일반 `Error` 클래스라 이 저장소의 도메인 예외 계층(`RESOURCE_NOT_FOUND` 류)과는 다른 카테고리로 전파된다는 점만 인지해 두면 된다(로그·재throw 패턴이라 사용자 응답 형태에는 영향 없음).

- **[INFO]** `rewriteTriggerConfigLocked` 의 새 `affected === 0 → false` 신호를 호출부 6곳 중 2곳이 여전히 읽지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:876`(notification secret rotation, `await rewriteTriggerConfigLocked(...)` 반환값 미저장) · `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:310`(degraded fallback, 반환값 미저장)
  - 상세: 이번 diff 로 `rewriteTriggerConfigLocked` 가 "재읽기 후 UPDATE 가 0행에 매치" 되는 경우도 `false` 를 정확히 보고하게 됐지만(트리거 config 락 헬퍼 자체의 계약 수정은 정확함), 이 신호를 실제로 검사해 404 등으로 승격하는 곳은 `rotateBotToken`·`revokePerTriggerToken` 류(`if (!wrote) throw ...`) 뿐이다. 위 두 호출부는 diff 이전부터 반환값을 버리고 있었고(이번 PR 이 새로 만든 문제는 아님), 기존에도 `!fresh`(재읽기 시점에 이미 삭제) 케이스에서 같은 방식으로 조용히 무시되고 있었다. 이번 fix 가 감지 범위를 넓혔을 뿐 소비 쪽 비대칭은 그대로 남는다 — 트리거가 그 사이 삭제됐는데 notification secret 회전/채널 degraded 마킹이 "성공"으로 조용히 지나갈 수 있다는 뜻이다.
  - 제안: 이 PR 의 스코프(§4 항목, `affected` 판정 추가) 밖의 기존 갭이므로 이번 diff 를 막을 사유는 아니다. 다만 트래커에 "wrote 미검사 호출부 2곳" 을 후속 항목으로 남겨 두는 것을 권장 — 지금 고치지 않으면 같은 클래스의 결함이 다음에도 "셋 중 둘만 잠근다" 식으로 재발할 수 있다.

- **[INFO]** 공유 테스트 더블 `trigger-transaction-mock.ts` 의 `manager.update` 기본 반환값이 `undefined` → `{ affected: 1 }` 로 바뀌어 3개 spec 파일에 동시에 영향
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` `update: jest.fn(async (...) => { ... return result ?? { affected: 1 }; })` (128~147번째 줄 부근)
  - 상세: 이 헬퍼는 `triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·`schedules.service.spec.ts` 세 파일이 공유한다(grep 으로 확인). 기본값 변경은 프로덕션이 `result.affected` 를 읽게 된 데 따른 필수 수정이고(주석·plan 문서에 명시), `run-test-all.sh` 4단계 전체 PASS 로 검증됐다고 기록돼 있다. 다만 "공유 fixture 의 기본 반환값 변경이 여러 파일에 동시에 blast radius 를 만든다" 는 이 파일 자체의 JSDoc 이 과거 유사 사고(6개 provider 파일 중 3개만 이관)를 이미 경고하고 있는 패턴이라, 이번에도 세 파일 전부가 실제로 재검증됐는지가 핵심이다 — 이번 diff 에 포함된 유일한 신규 테스트(`trigger-config-lock.spec.ts`)는 이 헬퍼를 쓰지 않고 자체 `makeManager` 를 쓰므로 이 변경의 직접 수혜자가 아니며, 실질 검증은 unit 14개 통과 기록에 의존한다.
  - 제안: 별도 조치 불요 — 이미 ALL PASS 로 기록됨. 다만 향후 이 파일을 또 고칠 때는 "3개 파일 전부 재실행" 을 재확인 항목으로 유지할 것(이 파일 JSDoc 이 스스로 그 규율을 요구하고 있음).

- **[INFO]** `rewriteTriggerConfigLocked` 신규 0-affected 분기에서도 `merge` 콜백과 `UPDATE` 문 자체는 이미 실행된 뒤에 `false` 를 반환한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `rewriteTriggerConfigLocked()` 내 `const result = await m.update(...)` 문(218번째 줄 부근)
  - 상세: 같은 함수의 기존 `!fresh` 분기는 "쓰지 않을 거면 계산(merge)도 하지 않는다" 는 명시적 계약을 갖고 있다(콜백이 로깅·카운터 등 부작용을 가질 수 있어서). 이번에 새로 추가된 "재읽기 후 UPDATE 가 0행" 분기는 구조상 그 계약을 못 지킨다 — affected 수를 알려면 이미 `merge()` 를 호출하고 `UPDATE` 문을 DB 에 보낸 뒤여야 하기 때문이다. 결과적으로 `merge` 콜백에 부작용이 있다면, 트리거가 그 사이 삭제된 이번 새 race 케이스에서는 그 부작용이 (쓰기가 최종적으로 무효화됨에도) 한 번 실행된다. 이는 이번 diff 가 만든 필연적 트레이드오프이지 회피 가능한 결함은 아니다(affected 여부를 UPDATE 전에 알 방법이 없음).
  - 제안: 조치 불요. 다만 함수 JSDoc 의 "쓰지 않을 거면 계산도 하지 않는다" 문구가 `!fresh` 분기에만 해당하고 새 0-affected 분기에는 적용되지 않는다는 점을 한 줄 명시해두면, 다음 사람이 두 분기를 같은 계약으로 오인하는 것을 막을 수 있다.

- **[정보/비-결함]** 이번 diff 는 전역 변수·환경 변수·네트워크 호출·공개 API 시그니처를 건드리지 않는다
  - 위치: 전체 리뷰 대상(`trigger-config-lock.ts`·`triggers.service.ts`·`trigger-transaction-mock.ts`)
  - 상세: `findByIdForUpdate` → `findByIdForPatchValidation` 는 `private` 메서드 rename 이고 호출부는 같은 클래스 내부 1곳뿐이며(grep 확인, 잔존 참조는 JSDoc 서술뿐), 외부 스파이·문자열 매칭 테스트도 없다. `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked` 는 export 된 함수지만 시그니처(파라미터·반환 타입)는 변경되지 않았다 — 내부 동작(검증 강화, affected 판정)만 좁아졌다. 파일시스템 쓰기는 코드 변경분에는 없고, `plan/**`·`review/**` 신규 마크다운/JSON 은 이 프로젝트 컨벤션이 요구하는 정상 산출물이다.

## 요약

이번 PR 은 트리거 config 락 헬퍼의 방어 심도(입력 검증)와 계약 정확성(`affected` 판정)을 좁히는 변경이며, 두 신규 동작 분기(타임아웃 유효성 실패 시 throw, UPDATE 0행 시 false) 모두 실제 콜러를 전수 확인한 결과 현재 프로덕션 경로에서 안전하게 흡수된다 — 타임아웃 throw 는 도달 불가능한 방어 코드이고, `affected===0` 판정은 삭제 경로를 감지해 `.catch` 로 로깅·재throw 되는 기존 트랜잭션 실패 처리에 자연스럽게 편입된다. 다만 `rewriteTriggerConfigLocked` 의 새 신호를 실제로 소비하지 않는 호출부 2곳(notification secret rotation, chat-channel degraded fallback)이 남아 있어 "락으로 감지는 하지만 응답에는 반영 안 됨" 이라는 비대칭이 이어지고, 공유 테스트 더블(`trigger-transaction-mock.ts`)의 기본값 변경은 3개 spec 파일에 동시에 영향을 주는 구조라 향후 유지보수 시 재검증 규율이 필요하다. 두 사항 모두 이번 diff 가 새로 만든 결함이 아니라 기존 갭의 연장이거나 구조적으로 불가피한 트레이드오프이므로 차단 사유는 아니다.

## 위험도

LOW
