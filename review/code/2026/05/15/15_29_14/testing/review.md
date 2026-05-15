### 발견사항

---

**[CRITICAL] WebSocket 게이트웨이 `background:run:` 채널 인가 — 전용 테스트 케이스 부재**
- 위치: `websocket.gateway.spec.ts`
- 상세: `BackgroundRunsService` mock 주입만 추가됐을 뿐, 새로운 `background:run:` 채널 분기(`channel.startsWith('background:run:')`)에 대한 실제 테스트 케이스가 없다. ① 유효 소유권 → 구독 허용, ② 소유권 불일치 → `success: false` 반환, ③ `verifyBackgroundRunOwnership` throw → `.catch(() => false)` 경로 — 세 케이스 모두 미검증.
- 제안: `kb:` 채널과 동일 패턴으로 세 케이스 추가. `verifyBackgroundRunOwnership`을 `mockRejectedValue(new Error('db error'))`로 override한 테스트로 catch 경로도 커버.

---

**[CRITICAL] `WebsocketService.emitBackgroundRunEvent` — 단위 테스트 없음**
- 위치: `websocket.service.ts` (신규 메서드, 서비스 스펙 파일 미확인)
- 상세: `emitBackgroundRunEvent`는 빈 `backgroundRunId` 조기 반환, payload 살균(`sanitizePayloadForWs`), `background:run:<id>` 채널 라우팅 등 독립적으로 검증할 로직을 포함한다. 현재 processor 스펙에서 mock으로만 호출 여부를 확인하므로 실제 채널명 조립·timestamp 주입·sanitize 동작은 검증되지 않는다.
- 제안: `websocket.service.spec.ts`에 `emitBackgroundRunEvent` 전용 describe 추가. `gateway.broadcastToChannel`을 spy하여 채널명 `background:run:<id>`, eventType, sanitized payload 검증.

---

**[WARNING] `execution-engine.service.ts` — `backgroundRunId` 추출 엣지 케이스 미커버**
- 위치: `execution-engine.service.ts` 추가 블록 (`parentMeta.backgroundRunId` 추출)
- 상세: `execution-engine.service.spec.ts`는 `backgroundRunId: 'bg-run-1'`을 job에 단순 추가할 뿐, 서비스 내부의 추출 로직은 전혀 검증하지 않는다. `parentNodeExecution.outputData`가 null인 경우, `meta`가 없는 경우, `backgroundRunId`가 string이 아닌 타입(number, boolean)인 경우 모두 `''` fallback으로 가야 하지만 테스트로 잠기지 않았다.
- 제안: `scheduleBackgroundBody`/`executeBackgroundSubgraph` 관련 테스트에서 `outputData: null`, `outputData: { meta: { backgroundRunId: 42 } }` 등 케이스 추가.

---

**[WARNING] `result-detail.tsx` — `extractBackgroundRunId` 순수 함수 테스트 없음**
- 위치: `result-detail.tsx` (신규 추가 함수)
- 상세: `output == null`, `typeof output !== 'object'`, `meta` 부재, `backgroundRunId`가 빈 문자열, non-string 타입 등 여러 분기를 갖는 순수 함수임에도 테스트가 없다. UI 렌더링 테스트(`background-run-section.test.tsx`)는 `result-detail.tsx` 통합 경로를 거치지 않으므로 이 함수는 전혀 회귀 보호가 없다.
- 제안: `result-detail.test.tsx`(또는 `utils.test.ts`)에 `extractBackgroundRunId`를 export하거나 동일 파일 내 테스트에서 개별 케이스 검증.

---

**[WARNING] `useBackgroundRun` hook — WebSocket 구독 수명주기 미검증**
- 위치: `use-background-run.ts`, `background-run-section.test.tsx`
- 상세: 컴포넌트 테스트가 WS 클라이언트를 전부 no-op으로 mock해 subscribe/unsubscribe/connect/waitForConnect 호출 경로가 전혀 검증되지 않는다. 특히 `cancelled` 플래그(비동기 setup이 unmount 후 완료될 때 막는 장치)와 `ensureFreshAccessToken` 실패 fallback이 untested.
- 제안: hook 전용 테스트 추가. `ws.subscribe`, `ws.unsubscribe`, `ws.connect`를 jest.fn()으로 만들어 ① subscribe 호출 확인, ② unmount 시 unsubscribe 호출 확인, ③ 이미 connected일 때 connect 미호출 확인.

---

**[WARNING] `BackgroundRunsController` — 에러 전파 테스트 부재**
- 위치: `background-runs.controller.spec.ts`
- 상세: 서비스가 `NotFoundException`과 `BadRequestException`을 throw할 때 컨트롤러가 그대로 전파하는지 검증하는 케이스가 없다. 컨트롤러 자체 로직은 단순 위임이지만, 파라미터 파이프(`ParseUUIDPipe`)가 유효하지 않은 UUID를 받았을 때 400을 발생시키는 것도 e2e 레벨 외에는 커버되지 않는다.
- 제안: `service.getBackgroundRun.mockRejectedValue(new NotFoundException())` 케이스 추가해 throw-through 동작 확인.

---

**[WARNING] `deriveBackgroundRunStatus` — `waiting_for_input` 상태 및 `cancelled` 미검증**
- 위치: `background-runs.service.spec.ts`, `background-runs.service.ts`
- 상세: ① `waitingCount > 0`이면 `'running'` 반환하는 분기가 있으나 집계 mock에서 `waiting > 0` 케이스가 없다. ② `BackgroundRunStatus` 타입에 `'cancelled'`가 선언됐으나 `deriveBackgroundRunStatus`는 이를 절대 반환하지 않는다 — spec §8.2는 `maxDurationMs` 초과 시 cancelled를 언급하지만 구현에 없음. 타입과 구현의 괴리가 테스트로 드러나지 않는다.
- 제안: `waiting > 0` aggregate 케이스 추가. `cancelled` 반환이 의도적으로 미구현이라면 타입에서 제거하거나 TODO 주석 추가 후 테스트로 명시.

---

**[INFO] `background-execution.processor.spec.ts` — 신규 WS 이벤트 커버리지 양호**
- 위치: 파일 전체
- 상세: started+completed 양 이벤트 순서, 실패 시 status=failed+errorMessage, legacy fallback(빈 backgroundRunId → WS 미발행 + execution fallback 알림), 관리자 없을 때 skip 등 주요 분기를 모두 커버하고 있다. mock 설계(makeJob + 부분 override)가 명확하다.

---

**[INFO] `background-runs.service.spec.ts` — 서비스 레이어 커버리지 광범위**
- 위치: 파일 전체 (497 lines)
- 상세: 16+8+2 케이스 기술한 plan 대로 running/completed/failed/pending 상태 전이, IDOR 3케이스, cursor 페이지네이션(hasMore+nextCursor 검증 및 decode), invalid cursor/limit, forkedAt fallback, notification attribution까지 단위 테스트로 커버. QB mock 구조(`buildOwnershipQB`, `buildBgNodeExecQB` 등 역할 분리)가 가독성이 좋다.

---

### 요약

전체적으로 서비스 레이어(`background-runs.service.spec.ts`, `background-execution.processor.spec.ts`)의 테스트 품질은 높고 핵심 비즈니스 경로가 잘 잠겨 있다. 그러나 두 가지 Critical 공백이 존재한다: WebSocket 게이트웨이의 `background:run:` 채널 인가 분기에 전용 테스트가 전혀 없어 IDOR 가드가 회귀 보호 밖에 있고, `WebsocketService.emitBackgroundRunEvent` 자체의 채널 라우팅·sanitize 동작도 단위 테스트가 없다. 프론트엔드 쪽은 `extractBackgroundRunId` 순수 함수와 `useBackgroundRun` WS 구독 수명주기가 테스트 범위 밖이며, `BackgroundRunStatus.cancelled`는 타입에 선언됐으나 서비스가 반환하지 않아 타입-구현 간 괴리가 테스트로 드러나지 않는다. 이 공백들이 보완되면 회귀 잠금 수준은 spec 수용 기준을 충족할 것으로 판단된다.

### 위험도
**HIGH**