# 부작용(Side Effect) Review

대상: 06-concurrency 잔여 배치 M-3(WS gateway join/leave await+롤백) / M-6(frontend 리스너 이중등록 방어) / m-3(connect active 가드) / m-5(dismiss hysteresis). 코드 파일 6개(backend gateway+spec, frontend ws-client+use-execution-events+각 test) + plan 문서 2개. `review/code/2026/07/03/21_48_56/**` 는 이전 세션이 생성한 리뷰 산출물(신규 파일)이라 본 diff 의 "코드"가 아니므로 부작용 관점 대상에서 제외.

## 발견사항

- **[INFO]** `handleUnsubscribe` 시그니처 변경 (sync → `Promise` 반환)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:150-172` (`async handleUnsubscribe(...): Promise<{...}>`)
  - 상세: `@SubscribeMessage('unsubscribe')` 데코레이터가 붙은 핸들러라 NestJS WS 프레임워크가 반환값(sync 값 또는 Promise)을 동일하게 처리해 ack 로 emit 한다. grep 결과 이 메서드를 직접 호출하는 다른 코드는 없음(프레임워크만 호출) — 시그니처 변경의 실질적 호출자 영향은 없다. wire 계약(`{event:'unsubscribed', data:{success, channel}}`)도 그대로 유지.
  - 제안: 조치 불요. (동일 판단이 이전 세션 `api_contract.md` INFO 항목과 일치 — 재확인 완료.)

- **[INFO]** `handleSubscribe` 반환 분기 추가 — 새 실패 ack 경로 도입
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:124-142`
  - 상세: `client.join(channel)` 이 reject 하면 `clientSubs.delete(channel)` 로 상태를 롤백하고 `{ event: 'subscribed', data: { success: false, error: '...' } }` 를 반환한다. 이는 새 응답 shape 분기이지만 기존 `subscribed` 이벤트의 `{success, channel?, error?}` 필드 구조를 그대로 따르므로 client 파서를 깨뜨리지 않는다(신규 필드 추가 아님, 기존 optional `error` 필드 사용). in-memory adapter 하에서 `client.join()` 은 사실상 동기 완결이라 이 분기가 실제로 타는 경우는 현재 거의 없음 — 회귀 위험 낮음.
  - 제안: 조치 불요.

- **[INFO]** `this.logger.warn` 신규 호출 2곳 — 부수적 로그 출력 부작용
  - 위치: `websocket.gateway.ts` join 실패 시(`handleSubscribe`) / leave 실패 시(`handleUnsubscribe`)
  - 상세: 새로 도입된 로깅 부작용. 외부 시스템 호출은 아니고 NestJS 내장 Logger 사용이라 기존 로깅 인프라와 일관됨. 에러 메시지에 `err.message` 를 그대로 포함하는데, 현재 발생 가능한 에러(in-memory adapter 예외)에 민감정보가 담길 가능성은 낮음. Redis adapter 도입 시 연결 문자열/자격증명이 에러 메시지에 노출될 수 있는지는 이전 세션 리뷰(`security`/`api_contract` INFO)에서 이미 후속 과제로 별도 기록됨 — 본 diff 범위 내 재확인 결과 추가 위험 없음.
  - 제안: 조치 불요(후속 Redis 도입 시점에 재점검 권장, 이미 문서화됨).

- **[INFO]** `handleDisconnect` 의 fire-and-forget `void client.leave(channel)` 은 변경 없음(주석만 추가)
  - 위치: `websocket.gateway.ts:140-148` (`handleDisconnect`)
  - 상세: 코드 동작 자체는 diff 전후 동일 — 방어적/redundant 이유를 설명하는 주석만 추가됐다. `handleSubscribe`/`handleUnsubscribe` 는 이제 await 하는데 `handleDisconnect` 만 여전히 `void` 라는 비대칭이 존재하나, 의도된 설계(socket.io 가 disconnect 시 room 을 auto-leave)로 근거가 명확히 문서화됨. 실질적 부작용 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** frontend `bind()` 헬퍼의 `client.off(event, handler)` 선행 호출 — 기존 리스너 제거라는 부작용 도입
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (bind 헬퍼, ~20곳 `client.on` → `bind` 치환)
  - 상세: 등록 직전 동일 `(event, handler)` 참조를 `off` 하는 것이 새로운 부작용이지만, 핸들러가 `useCallback`/`useRef` 로 안정된 참조이기만 하면 참조 불일치로 인해 "의도치 않은 다른 리스너"를 제거할 위험은 없다(socket.io `off(event, fn)` 는 참조 일치 리스너만 제거). 이 프로젝트의 `WsClient` 는 싱글턴이므로 다른 훅 인스턴스가 동일 `(event, handler)` 조합을 등록했을 가능성도 참조 unique 성 덕에 배제됨. `test.ts` 의 `connectOffCalls.length` 2→4, `resumedOffCalls.length` 1→2 로 검증치가 변경된 것은 이 새 off 부작용에 따른 정당한 카운트 변화 — 테스트가 실제 동작 변화를 반영해 정확히 갱신됨.
  - 제안: 조치 불요. (다만 이 카운트 단언은 `bind()` 내부 구현에 결합돼 있음 — maintainability 관점 별건, side-effect 관점에서는 정상.)

- **[INFO]** `use-execution-events.ts` snapshot effect 에 `setTimeout`/`clearTimeout` 신규 타이머 부작용
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:1178-1188` (dismiss hysteresis)
  - 상세: 새 타이머를 예약하고 cleanup 함수로 `clearTimeout` 을 반환해 React effect 표준 정리 패턴을 따른다. effect 재실행/unmount 시 정리되므로 타이머 누수 위험 없음. `toast.dismiss` 호출이 최대 1초 지연되는 타이밍 변화가 유일한 관찰 가능한 부작용이며 의도된 UX 개선.
  - 제안: 조치 불요.

- **[INFO]** `ws-client.ts` `connect()` 가드 조건 확장 — 기존 호출자 동작 변화 가능성
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:20-27`
  - 상세: `if (socket?.connected)` → `if (socket && (socket.connected || socket.active))`. 조기 반환 조건이 넓어져 기존에는 disconnect+재생성(churn)됐던 "연결 진행 중 재호출" 케이스가 이제 조기 반환된다. `connect()` 의 공개 시그니처(매개변수·반환값)는 불변이나 **동작(behavior)** 이 바뀌는 시그니처 외 변경 — 토큰 갱신 재연결(주석에 명시된 `connect_error` 핸들러 경로)은 `active=false` 상태에서 발생하므로 영향받지 않는다는 근거가 주석과 신규 테스트(`skips connect if socket is active`)로 뒷받침됨. 외부에서 `connect()` 를 직접 호출하는 다른 지점이 있는지 확인 필요.
  - 제안: 조치 불요로 판단하되, `connect()` 의 다른 호출부(로그인 흐름 등)가 "connecting 상태에서 강제 재연결"을 기대하는 케이스가 있는지 1회성으로만 확인 권장(이번 diff 범위 내 grep 상으로는 `ws-client.ts` 자체 재연결 로직과 훅에서만 호출되는 것으로 보임 — 별도 회귀 신호 없음).

## 요약

이번 변경분은 WebSocket 구독/연결 경로에 새 로그 출력, 새 타이머(setTimeout/clearTimeout), 새 리스너 off-then-on 부작용을 국소적으로 추가한 방어적 강화 패치다. 전역 변수나 신규 환경 변수 도입은 없고, 파일시스템 부작용도 plan 문서 갱신(의도된 문서화) 외에는 없다. `handleUnsubscribe` 의 sync→async 시그니처 변경은 프레임워크 전용 호출 경로라 실질적 호출자 영향이 없으며, `connect()` 가드 확장은 공개 시그니처는 유지한 채 동작만 바뀌는 변화로 근거 주석과 회귀 테스트가 동반됐다. frontend `bind()` 의 off-before-on 은 참조 안정성에 의존한 안전한 멱등화이며 테스트가 새 off 카운트를 정확히 반영해 검증한다. 네트워크 호출(join/leave)은 기존에도 있던 것을 fire-and-forget에서 await 로 바꾼 것뿐이라 신규 외부 호출은 아니다. 전반적으로 위험도 높은 부작용은 발견되지 않았고, 모든 항목이 의도되고 문서화된 변경이다.

## 위험도
LOW
