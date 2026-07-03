### 발견사항

- **[INFO]** join 롤백 ack 테스트가 `error` 메시지 문자열을 검증하지 않음 — 파일 내 다른 모든 ack 실패 테스트와 관례 불일치
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:243-256` (`'join 실패 → 구독 롤백...'`)
  - 상세: 같은 파일의 다른 실패 ack 테스트(예: `:201`, `:225`, `:290`, `:727` 등)는 모두 `expect(result.data.error).toBe('...')` 로 정확한 메시지를 단언하는데, 신규 테스트는 `success:false` 와 `subs.has(channel) === false` 만 검증하고 `result.data.error === 'Subscription failed — please retry'` 는 검증하지 않는다. 향후 에러 메시지가 실수로 바뀌어도 이 테스트는 통과한다.
  - 제안: `expect(result.data.error).toBe('Subscription failed — please retry');` 추가.

- **[INFO]** `this.logger.warn` 호출 자체는 두 신규 경로(join 실패·leave 실패) 모두 테스트에서 미검증
  - 위치: `websocket.gateway.spec.ts` join-rollback 테스트(:243), leave-reject 테스트(:76-90, diff 기준)
  - 상세: 구현(`websocket.gateway.ts:270-276`, `:349-356`)은 실패 시 `logger.warn` 을 호출하는데, 이 관측 가능한 부작용(운영 시 Redis adapter 실패 진단에 쓰일 로그)이 테스트에서 spy 되지 않는다. 로직 결과(success/subs)는 이미 잘 커버되므로 우선순위는 낮음.
  - 제안: 필요 시 `jest.spyOn(gateway['logger'], 'warn')` 으로 최소 1회 호출만 스모크 검증. 필수는 아님.

- **[INFO]** join 롤백 테스트에 MAX_SUBSCRIPTIONS tentative-add 롤백 경로와의 상호작용 테스트 없음
  - 위치: `websocket.gateway.ts:237-263`(tentative-add + 사후 한도 검사) vs `:264-281`(join await + 롤백)
  - 상세: 두 롤백 메커니즘(한도 초과 롤백, join 실패 롤백)이 순차로 같은 `clientSubs.add/delete` 를 다루는데, "join 실패 후 재시도로 재구독 성공" 같은 연속 시나리오(롤백이 `clientSubs.size` 를 온전히 원복해 다음 구독 시도에 지장 없는지)는 테스트되지 않는다. 현재 단일 호출 검증만으로도 회귀 방지 목적은 충족하나, 두 메커니즘이 얽히는 경로는 커버리지 갭이다.
  - 제안: 선택사항. "join 실패 후 같은 채널 재구독 시 정상 성공" 케이스를 추가하면 롤백 완전성을 더 강하게 보증.

- **[INFO]** hysteresis 테스트가 `try/finally` 로 fake timer 를 개별 격리하나, 인접 `describe` 블록은 `beforeEach`/`afterEach` 패턴 사용 — 스타일 불일치
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:170-198` vs `:2123-2129`
  - 상세: 기능적으로는 문제 없음(try/finally 가 실패 시에도 `vi.useRealTimers()` 를 보장해 격리는 안전). 다만 동일 파일 내 유사 목적의 두 블록이 서로 다른 fake-timer 관리 패턴을 쓰는 것은 가독성 측면에서 사소한 비일관.
  - 제안: 조치 불요. 후속 정리 시 통일 고려.

- **[INFO]** `off-before-on` cleanup count 단언(`connectOffCalls.length===4`, `resumedOffCalls.length===2`)이 `bind()` 구현 세부(off 호출 횟수)에 결합 — SUMMARY 에서 이미 지적됨
  - 위치: `use-execution-events.test.ts:264-273`(diff 상 라인)
  - 상세: RESOLUTION.md 에도 기록된 기존 INFO. 구현이 dedup 전략을 바꾸면(off 호출 자체가 없어지는 등) 이 테스트가 깨지는데, 이는 정상적인 회귀 감지 목적에 부합하므로 굳이 완화할 필요는 낮다. 다만 "off 최소 1회 + 최종 리스너 미잔존" 형태로 의도(behavior) 중심 단언으로 바꾸면 구현 결합도가 낮아진다.
  - 제안: 선택사항, 낮은 우선순위.

### 커버리지 평가 (변경 대비)

- `handleSubscribe` join await+롤백: 정상 경로(기존 테스트, join resolve) + 실패 경로(신규) 모두 커버. 롤백이 `clientSubs` Set 만 정리하고 반환값도 검증하므로 핵심 계약은 충분히 검증됨.
- `handleUnsubscribe` async 전환: 정상 경로(기존, 수정되어 `await` 대응) + leave-reject best-effort 경로(신규, RESOLUTION.md 상 WARNING 조치로 추가됨) 모두 커버. 대칭성 확보됨.
- `handleDisconnect` 의 fire-and-forget `void client.leave()` 유지분: 코드 변경은 주석 추가뿐이라 회귀 위험 낮음, 기존 `handleDisconnect` 테스트(`:706` 부근, join/leave mock 없이 단순 스모크)로 충분.
- frontend `bind()` 이중 등록 방어: 등록 시 off-ref-equality 테스트(신규) + 기존 cleanup 카운트 테스트 갱신, 둘 다 검증됨. StrictMode 이중 mount 자체를 시뮬레이션하는 테스트는 없으나(즉 실제로 `renderHook` 을 두 번 연속 호출해 두 번째 mount 시 리스너가 여전히 1개인지 확인하는 시나리오는 없음), off-ref-equality 단언이 그 계약을 간접적으로 보증한다.
- frontend `dismiss hysteresis`: 지연 전/후 상태 모두 검증, cleanup(`clearTimeout`) 자체를 직접 검증하는 테스트는 없음 — "effect 재실행 시(snapshot 재수신 안 됨) 타이머 취소되어 dismiss 미발생" 시나리오는 커버되지 않음(구현 주석엔 명시되어 있으나 테스트 부재). 경미한 갭.
- `ws-client.ts` `active` 가드: `connected=false, active=true` 시 churn 없음(신규) + 기존 `connected=true` 스킵, `disconnected` 재연결 케이스 모두 회귀 없이 유지.

### 요약
이번 배치(M-3/M-6/m-3/m-5)는 각 변경 지점마다 성공·실패(또는 방어 대상) 양쪽 경로에 대응하는 단위 테스트를 신설·보강했고, RESOLUTION.md 기록대로 기존 리뷰에서 지적된 `handleUnsubscribe` leave-reject 누락도 FIXED 로 채워 대칭성을 확보했다. 신규 테스트들은 mock 이 실제 socket.io 인터페이스(`join`/`leave`/`active` 등)의 관측 가능한 동작만 다루고 있어 mock 과 실제 동작의 괴리는 작다. 다만 join 실패 ack 의 에러 메시지 문자열 미검증, `logger.warn` 부작용 미검증, dismiss hysteresis 의 "재취소" 분기 미검증 등 사소한 커버리지 갭이 남아 있으며 모두 INFO 수준으로 즉시 조치가 필요한 정도는 아니다. 테스트 격리는 각 파일에서 `beforeEach`(백엔드 `getSubscriptions().set` 재설정, 프런트 `mockSocket` 재생성)로 잘 유지되고 있고, hysteresis 테스트의 `try/finally` fake-timer 패턴도 실패 시에도 안전하게 복원되어 다음 테스트에 영향을 주지 않는다.

### 위험도
LOW
