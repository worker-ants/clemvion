# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] `firstMessage` 필드 제거 — 클라이언트 측 breaking change(서버 API 무변경)
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` payload 타입 변경 (line 38-40)
- 상세: `startConversation` 의 payload 타입에서 `firstMessage?: string` 필드가 제거됐다. 이 함수는 내부 클라이언트 클래스(`EiaClient`)의 메서드로 위젯 SPA 전용이며, 외부 API 서버의 스키마를 변경하지 않는다. 서버 쪽 `POST /api/hooks/:endpointPath` 엔드포인트는 여전히 `firstMessage` 를 수신할 수 있는 상태이고, 위젯 클라이언트만 그것을 더 이상 동봉하지 않는 변경이다. 따라서 서버-클라이언트 간 API 계약 상 하위 호환성 파손은 없다(서버가 필드를 요구하지 않고, 없어도 정상 처리하는 선택적 필드였음).
- 제안: 만약 이 위젯 외에 다른 클라이언트(BYO-UI M2 등)도 `EiaClient` 를 공유하고 있고 `firstMessage` 를 사용했다면 영향이 있다. 현재 코드 범위에서는 위젯 내부 전용이므로 문제 없음. 외부 SDK 노출 여부를 확인하는 것을 권장한다.

### [INFO] `startConversation` payload의 open index signature 유지 — 미래 확장성 보존
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` line 40
- 상세: `{ profile?: Record<string, unknown>; [k: string]: unknown }` 형태로 index signature 를 유지해 추후 필드 추가 시 서버 스키마 수정 없이 전달 가능하다. 하위 호환 관점에서 긍정적인 설계다.
- 제안: 이상 없음.

### [INFO] `newChat` 에서 새 execution 즉시 시작 — 경쟁 조건(race) 주의
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat` callback (line 1466-1473)
- 상세: `newChat` 이 `closeStream()` → `clearSession()` → `sessionRef.current = null` → `startedRef.current = false` → `dispatch(NEW_CHAT)` → `void start()` 순서로 실행된다. `start()` 는 비동기이므로 UI 상태가 `panel`(NEW_CHAT 으로 전환)이 된 직후 즉시 `POST /api/hooks/:path` 가 발행된다. 이 자체는 의도된 eager 동작이나, 극히 드문 경우 `start()` 실패 시 `startedRef.current = false` 로 재설정되어 재open 시 다시 새 execution 이 시작될 수 있다. API 계약 위반은 아니지만, 실패 후 상태가 `booting` 에 머무를 가능성을 확인해야 한다(현재 `dispatch(ERROR)` 가 `ended` 로 전환하므로 안전해 보임).
- 제안: 이상 없음(현 구현 충분). 추후 `newChat` 이 실패 시 `panel` 상태로 롤백하는 처리를 추가하면 더 견고해진다.

### [INFO] SSE 토큰 전달 — 쿼리 파라미터 방식 유지(변경 없음)
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` — `openStream` (line 178)
- 상세: SSE는 `EventSource` 의 헤더 미지원 제약으로 `?token=` 쿼리 파라미터를 사용한다. 이번 변경과 무관하나 API 계약 관점에서 현행 유지가 EIA §8.3 과 일치함을 확인했다.
- 제안: 이상 없음.

### [INFO] 에러 응답 처리 — 410 Gone 전용 분기 유지(변경 없음)
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` — `interact` (line 130)
- 상세: `interact` 가 `410` 을 별도 분기로 처리하는 패턴은 이번 변경과 무관하게 유지된다. API 에러 응답 형식 일관성 측면에서 적절하다.
- 제안: 이상 없음.

### [INFO] 응답 봉투(`{ data }`) 언랩 — 기존 패턴 유지(변경 없음)
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` — `unwrapEnvelope` (line 80-85)
- 상세: `startConversation`, `getStatus`, `refreshToken` 모두 `unwrapEnvelope` 를 통해 `{ data: ... }` 봉투를 해제한다. 이번 변경 범위에서 이 패턴은 건드리지 않았고, 서버 응답 스키마 준수가 유지된다.
- 제안: 이상 없음.

## 요약

이번 변경의 핵심 API 계약 영향은 위젯 클라이언트가 `POST /api/hooks/:endpointPath` 호출 시 `firstMessage` 필드를 더 이상 동봉하지 않는 것이다. 서버 엔드포인트는 해당 필드가 선택적(optional)이었으므로 서버-클라이언트 간 breaking change는 없다. `EiaClient` 는 내부 전용 클라이언트 클래스로 공개 API 표면이 아니며, 응답 봉투 언랩 패턴·Bearer 토큰 인증·SSE 쿼리 토큰·에러 HTTP 상태 코드 처리 등 기존 API 계약은 모두 준수되고 있다. 나머지 변경(상태기계·컴포넌트·테스트·스펙 문서)은 API 호출 경로와 무관한 클라이언트 내부 상태 및 문서 업데이트다. 전반적으로 API 계약 준수 수준은 양호하며 위험 요소가 없다.

## 위험도

NONE
