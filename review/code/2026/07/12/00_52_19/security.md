# 보안(Security) 리뷰 — kb-websocket-emit-compile-guard

## 대상

- `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`
- `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` (JSDoc 주석 추가만)
- `plan/in-progress/kb-websocket-emit-compile-guard.md` (신규 plan 문서)

변경 요지: private `emitEvent(documentId, event, payload)` 헬퍼의 `event` 파라미터를
`string` (+ 호출부 `as Parameters<...>[1]` 캐스트) 에서 `KbEventType` (권위 union, 11종)
직접 타입으로 좁힘. 런타임 로직·이벤트 payload·channel 명명 규약·DB 쿼리·에러 처리는
전혀 변경되지 않음. 순수 컴파일타임 타입 강제 강화이며 `websocket.service.ts` 는 JSDoc
한 문단 추가 외 코드 변경 없음.

## 발견사항

발견된 취약점 없음.

- **[INFO]** 순수 컴파일타임 강화 — 긍정적 방어심층화
  - 위치: `embedding.service.ts` / `graph-extraction.service.ts` `emitEvent()`
  - 상세: 기존에는 `event: string` 을 받아 호출부에서 `as Parameters<typeof emitKbEvent>[1]`
    로 강제 캐스팅했기 때문에, 향후 리팩터링 실수로 `KbEventType` union 밖의 임의 문자열
    (예: PR #891 에서 드리프트가 있었던 `document:graph_error`)을 emit 하도록 코드가
    바뀌어도 tsc 가 이를 잡지 못하고 런타임에 그대로 WS 채널로 나갔을 것. 이번 변경은
    `event` 파라미터 타입을 `KbEventType` 로 직접 좁혀 `as` 캐스트를 제거함으로써, union 밖
    이벤트명을 build-time 에 차단한다. 이 헬퍼는 `documentId`, `event`, `payload` 를
    그대로 `websocketService.emitKbEvent()` 에 전달할 뿐이고, `emitKbEvent` 내부는
    `sanitizePayloadForWs()` 로 credential-like 키를 여전히 redact 하며 channel 이름은
    `kb:${documentId}` 로 고정 — 변경 전후로 인증/인가·redaction·SQL 파라미터 바인딩 등
    기존 보안 통제는 그대로 유지된다. 사용자 입력이 `event` 파라미터 값에 직접 영향을
    주는 경로는 없음 (호출부 리터럴만 전달).
  - 제안: 없음 (변경 자체가 방어심층화 개선). 향후 union 에 새 이벤트를 추가할 때
    `emitKbEvent`/`emitEvent` 호출부 타입체크가 자동으로 강제되므로 별도 조치 불필요.

- **[INFO]** SQL 인젝션 / LLM 출력 새니타이징 — 영향 없음 (diff 범위 밖, 기존 통제 유지 확인)
  - 위치: `graph-extraction.service.ts` `persistExtraction()` (전체 파일 컨텍스트 확인용, diff 대상 아님)
  - 상세: 리뷰 대상 diff 자체는 건드리지 않지만, 전체 컨텍스트 확인 결과 entity/relation
    INSERT 는 파라미터 바인딩(`$1, $2, ...`)을 사용하고, LLM 출력은 `SAFE_TEXT_REGEX`
    화이트리스트 + 길이 cap(`MAX_NAME_LEN` 등)으로 사전 검증 후 저장 — 별도 조치 불필요.
    본 리뷰 세션에서 이 로직 자체는 변경되지 않았으므로 회귀 없음만 확인.
  - 제안: 없음.

- **[INFO]** WS payload credential redaction — 영향 없음 (diff 범위 밖)
  - 위치: `websocket.service.ts` `sanitizePayloadForWs` / `CREDENTIAL_KEY_PATTERN`
  - 상세: 이번 diff 는 `KbEventType` JSDoc 주석 추가만이며 `sanitizePayloadForWs`,
    `stripExternalOnlyFields`, `attachRoutingContext` 등 기존 보안 통제 로직은 원문 그대로.
  - 제안: 없음.

## 하드코딩 시크릿 / 인증·인가 / 입력 검증 / 암호화 / 에러 노출 / 의존성

해당 diff 는 위 항목에 영향을 주는 코드 변경이 전혀 없음 (타입 시그니처 좁히기 +
캐스트 제거 + 주석/plan 문서). `sanitizeLlmErrorMessage` / `capErrorMessage` 를 통한
에러 메시지 노출 방지, `isValidDocumentId` 게이트, 인증된 WS 채널 라우팅 등 기존
통제는 diff 전후로 동일하게 유지된다. `plan/in-progress/kb-websocket-emit-compile-guard.md`
는 작업 추적 문서로 시크릿·민감정보 없음.

## 요약

이번 변경은 `EmbeddingService`/`GraphExtractionService` 의 KB WebSocket 이벤트 emit
헬퍼에서 런타임 `as` 타입 캐스트를 제거하고 `KbEventType` union 을 컴파일타임에
직접 강제하는 순수 타입 안전성 강화다. 이벤트 payload 생성·channel 명명·DB 접근·
credential redaction 등 기존 런타임 로직과 보안 통제는 전혀 변경되지 않았고, 새로운
사용자 입력 경로나 공격 표면도 도입되지 않았다. 오히려 union 밖 이벤트명이 향후
실수로 emit 되는 것을 build 단계에서 차단하는 방어심층화 개선으로 평가된다. 보안
관점에서 우려되는 발견사항은 없다.

## 위험도

NONE
