### 발견사항

---

**[WARNING] 예외 메시지 직접 노출 (에러 정보 누수)**
- 위치: `background-execution.processor.ts:75` — `emitRunCompleted`, `dispatchFailureNotification`
- 상세: `err instanceof Error ? err.message : String(err)` 로 얻은 raw exception message 가 인앱 알림 본문(`${message}`)과 WS 페이로드(`{ errorMessage: message }`)에 그대로 포함됩니다. DB 에러, 내부 경로, 설정값 등이 `Error.message` 에 포함되면 워크스페이스 admin 에게 노출됩니다. `sanitizePayloadForWs` 는 credential-like 필드명(password, apiKey 등)을 마스킹하지만 `errorMessage` 키 자체는 마스킹 대상에 없습니다.
- 제안: 에러 메시지를 사용자 노출 전 최대 길이(예: 256자) 로 truncate하고, DB 관련 에러(`QueryFailedError` 등)는 generic 메시지로 치환하는 sanitizer 계층을 추가하세요. `sanitizePayloadForWs` 가 `errorMessage` 필드도 처리하도록 확장하는 방안도 고려하세요.

---

**[WARNING] WebSocket 채널 구독 시 backgroundRunId UUID 형식 미검증**
- 위치: `websocket.gateway.ts:159` — `channel.slice('background:run:'.length)`
- 상세: `background:run:` 이후 문자열을 그대로 `verifyBackgroundRunOwnership(backgroundRunId, workspaceId)` 에 전달합니다. UUID 형식 검증 없이 임의 문자열(매우 긴 문자열, 특수문자 포함 등)이 DB 쿼리로 넘어갑니다. TypeORM 파라미터 바인딩 덕분에 SQL 인젝션은 차단되지만, 불필요한 DB 쿼리가 발생하고 `verifyBackgroundRunOwnership` 의 `if (!backgroundRunId)` 가드가 빈 문자열만 처리하므로 비정상 입력에 취약합니다.
- 제안:
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const backgroundRunId = channel.slice('background:run:'.length);
  if (!UUID_RE.test(backgroundRunId)) {
    return { event: 'subscribed', data: { success: false, error: 'Invalid channel id' } };
  }
  ```

---

**[INFO] Cursor 토큰 서명 없음 (무결성 미검증)**
- 위치: `background-runs.service.ts:154` — `decodeCursor` / `encodeCursor`
- 상세: Cursor는 `{s: startedAt, i: nodeExecutionId}` 를 base64 인코딩한 opaque 토큰이지만 HMAC 서명이 없습니다. 인가된 사용자가 직접 base64 를 디코딩·조작해 임의 `startedAt`/`id` 로 페이지네이션을 조작할 수 있습니다. `executionId` + `parentNodeExecutionId` 범위 내에서만 동작하므로 접근 범위를 벗어나지는 않지만, 페이지 순서를 임의로 건너뛰거나 역방향 탐색이 가능합니다.
- 제안: 현재 구조상 인가된 사용자가 이미 모든 페이지에 접근 가능하므로 즉각적 보안 위협은 낮습니다. 서버 비밀키로 HMAC-SHA256 서명을 추가하면 조작 방지가 가능합니다.

---

**[INFO] 프론트엔드 console.warn 운영 환경 노출**
- 위치: `use-background-run.ts:82` — `console.warn("[useBackgroundRun] subscribe rejected:", ack)`
- 상세: WS 구독 거부 시 ack 객체 전체가 브라우저 콘솔에 출력됩니다. 서버의 에러 응답 구조나 채널 정보가 브라우저 개발자 도구에 노출될 수 있습니다.
- 제안: 운영 빌드에서는 로그 레벨을 제어하거나 `process.env.NODE_ENV === 'development'` 조건부 출력으로 제한하세요.

---

**[INFO] 이중 404 에러코드로 인한 실행 존재 여부 추론 가능**
- 위치: `background-runs.service.ts` — `verifyExecutionAccess` (`EXECUTION_NOT_FOUND`) vs `findBackgroundNodeExecution` (`BACKGROUND_RUN_NOT_FOUND`)
- 상세: 두 에러코드가 다르므로, 공격자가 `BACKGROUND_RUN_NOT_FOUND` 응답을 보면 `executionId` 가 해당 워크스페이스에 존재함을 추론 가능합니다. 다만 `executionId` 는 UUID이므로 열거 공격의 실효성은 매우 낮습니다.
- 제안: 위험도가 낮으므로 현재 구현 수용 가능. 강화가 필요하다면 두 에러코드를 통일하세요.

---

### 요약

전반적으로 보안 설계가 견고합니다. `ParseUUIDPipe` 를 통한 입력 검증, TypeORM 파라미터 바인딩으로 SQL 인젝션 차단, IDOR 방지를 위한 워크스페이스 소유권 검증(404 통일), WS 채널 구독 시 `verifyBackgroundRunOwnership` + `.catch(() => false)` 의 deny-on-error 패턴, `sanitizePayloadForWs` 적용 등 핵심 보안 요소가 모두 갖춰져 있습니다. 주요 개선 포인트는 **내부 예외 메시지가 알림/WS 이벤트에 raw로 전달되는 부분**과 **WebSocket 채널에서 추출한 ID의 UUID 형식 미검증** 두 가지입니다. 나머지는 정보성 수준의 개선 사항입니다.

### 위험도

**LOW**