# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** `clearExpiryTimers` 추출(Extract Method) 시 JSDoc 소유권이 원래 메서드에서 이관되지 않아, 서로 다른 두 심볼의 문서가 뒤섞였다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:147-188` (`expiryTimers` 필드 및 `clearExpiryTimers`/`armExpiryTimers` 사이)
  - 상세: 이번 diff 는 `clearExpiryTimers` 헬퍼를 새로 추출해 `armExpiryTimers` 바로 앞에 삽입했는데, 그 삽입 지점에 원래 있던 JSDoc 블록 두 곳을 새 심볼에 맞게 정리하지 않았다.
    1. `expiryTimers` 필드(147-156줄): 옛 JSDoc(147-150줄, "소켓별 만료 타이머… `handleDisconnect` 에서 둘 다 해제한다")을 지우지 않은 채 새 JSDoc(151-156줄, "타이머 **쌍**… optional 이 아니다")을 바로 위에 추가했다. 두 블록이 내용상 상당 부분 겹치는 채로 나란히 남아 중복 문서가 됐다.
    2. `armExpiryTimers`/`clearExpiryTimers`(162-188줄): 원래 `armExpiryTimers` 를 설명하던 큰 JSDoc 블록(162-176줄 — §1.2 근거, revoke 카브아웃 범위, `exp` 부재 처리 등 `armExpiryTimers` 본문 로직에 대한 설명)이 새로 삽입된 `clearExpiryTimers` 메서드 **바로 위**로 밀려났고, 그 아래 `clearExpiryTimers` 자신의 새 JSDoc(177-181줄)이 또 붙었다. 결과적으로 `armExpiryTimers`(190줄)는 자신의 로직을 설명하던 헤더 JSDoc 을 완전히 잃었고(본문 내 `//` 인라인 주석만 남음), 반대로 `clearExpiryTimers`(단순 타이머 쌍 해제 헬퍼)는 자신과 무관한 "소켓 수명을 토큰 수명에 종속시킨다"는 상위 설계 rationale 을 문서로 갖게 됐다.
    - 실측: 실제 소스(`Read` 로 직접 확인, prompt 조립본이 아님)에서 147-188줄이 그대로 이 상태임을 확인했다.
    - 도구 관점에서도 문제다 — VSCode hover/TypeDoc 은 통상 심볼에 **가장 인접한** JSDoc 블록만 그 심볼의 문서로 인식한다. `armExpiryTimers` 는 인접 JSDoc 이 없어 hover 시 아무 설명도 뜨지 않고, `clearExpiryTimers` 는 자신과 무관한 내용(162-176줄)이 바로 위에 남아 소스를 위에서 아래로 읽는 사람을 오도한다.
    - 이 PR 이 표방하는 목표(plan 상 "이월 INFO 5건을 한 번에 닫는다" — 유지보수 부채 정리)와 정확히 반대 방향의 부수효과다. 이 저장소는 JSDoc rationale 을 설계 근거의 1차 저장소로 쓰는 관례가 강한데, 그 근거가 엉뚱한 심볼에 붙으면 다음 리팩터링에서 "이 설명이 왜 여기 있지"라는 혼란과 함께 삭제·오독될 위험이 있다.
  - 제안: `armExpiryTimers` 위의 큰 JSDoc(162-176줄)을 제자리(`armExpiryTimers` 바로 위, 190줄)로 되돌리고, `clearExpiryTimers` 는 자신의 새 JSDoc(177-181줄)만 갖도록 재배치한다. `expiryTimers` 필드는 옛 JSDoc(147-150줄)을 삭제하고 새 JSDoc(151-156줄)만 남긴다(두 설명을 합쳐도 좋다).

## 그 외 확인한 항목 (문제 없음, 참고용)

- **DRY / 응집도**: `clearExpiryTimers` 추출 자체는 좋은 리팩터다. 종전에는 `armExpiryTimers` 진입부(신규 추가된 선제 clear)와 `handleDisconnect` 두 곳에 "타이머 쌍 clear + Map 삭제" 절차가 각각 인라인될 뻔했는데, 단일 헬퍼로 모아 두 소비처가 갈릴 위험을 없앴다.
- **타입 설계**: `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` → `{ notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }` 로 non-optional 화한 것은 "illegal state를 표현 불가능하게 만든다"는 원칙에 부합한다. 실제로 `handleDisconnect` 의 `if (timers.notice) …`/`if (timers.cutoff) …` 방어 분기(도달 불가능했던 죽은 코드)가 제거됐다.
- **모듈 경계 / 순환 의존 방지**: `MSG_AUTH_TOKEN_EXPIRING` 을 `websocket-events.types.ts`(모듈 헤더가 스스로 "의존성 0" 을 명시하는 순환-회피 전용 모듈)에 추가한 것은 그 모듈이 이미 `enum`(런타임 값)을 export 하던 기존 패턴과 일관되고, 새 import 를 전혀 추가하지 않아 그 모듈이 지키던 "0 dependency" 불변식을 깨지 않는다. `websocket.gateway.ts`/`websocket.gateway.spec.ts` 양쪽이 이 상수를 참조해 wire 문구의 단일 SoT 를 확보한 것도 구조적으로 타당하다.
- **국소 상수 vs 공유 상수의 비일관성 여부**: 같은 파일에 `MSG_NOT_AUTHENTICATED`/`MSG_NOT_AUTHORIZED_EXECUTION` 은 `websocket.gateway.ts` 로컬에 남아 있고 `MSG_AUTH_TOKEN_EXPIRING` 만 별도 types 모듈로 승격됐는데, 전자는 "subscribe 경로와 커플링을 막기 위해 의도적으로 공유하지 않는다"는 명시적 주석이 있고 소비처가 gateway.ts 하나뿐인 반면, 후자는 gateway.ts + spec.ts(테스트) 두 소비처가 있어 승격 기준이 다르다. 불일치가 아니라 각기 다른 근거에 따른 의도적 배치로 판단된다.
- **순환 참조**: 이번 diff 로 새로 추가된 import 는 `websocket.gateway.spec.ts` → `websocket-events.types.ts`(테스트 파일, 프로덕션 그래프 밖) 와 `websocket.gateway.ts` 의 기존 import 문에 `MSG_AUTH_TOKEN_EXPIRING` 심볼 하나 추가뿐이다. 새 순환 경로는 생기지 않는다.
- **레이어 책임**: 변경 전체가 WS 게이트웨이(프레젠테이션/전송 레이어) 내부 타이머 관리 정리에 그치며, 비즈니스 로직이나 데이터 레이어로의 침범은 없다.
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 변경은 체크리스트 갱신(문서)이며 아키텍처 영향 없음.

## 요약

이번 변경은 이월된 5건의 INFO(문구 상수화, 타이머 쌍 non-optional 화, 선제 clear, `.unref()`, `clearExpiryTimers` 추출)를 한 번에 정리하는 마무리성 리팩터로, SOLID·DRY·타입 안전성 관점에서 대체로 견고하다 — 특히 optional 필드를 non-optional 로 좁혀 도달 불가능한 방어 분기를 제거한 것과, 순환 의존 회피용 0-dependency 모듈의 기존 관례를 그대로 따라 상수를 배치한 점이 좋다. 다만 `clearExpiryTimers` 를 추출하는 과정에서 JSDoc 두 블록이 원래 심볼과 다른 심볼 위에 남아, `armExpiryTimers`(핵심 로직)가 헤더 설명을 잃고 `clearExpiryTimers`(단순 헬퍼)가 무관한 설계 rationale 을 떠안는 문서 오배치가 발생했다. 런타임 동작에는 영향이 없으나 이 저장소가 JSDoc rationale 을 설계 근거의 1차 저장소로 쓰는 관례가 강한 만큼, 다음 유지보수자를 오도할 수 있어 병합 전 정정이 바람직하다.

## 위험도

LOW
