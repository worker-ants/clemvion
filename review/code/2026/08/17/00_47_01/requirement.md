# 요구사항(Requirement) 코드 리뷰

## 검토 방법

`origin/main...HEAD` 누적 diff(6 커밋, 91파일)를 대상으로, 핵심 프로덕션 코드
(`websocket.service.ts`/`.spec.ts`, `executions.service.ts`/`.spec.ts`,
`background-runs.service.ts`/`.spec.ts`, `redact-stored-error.ts`/`.spec.ts`,
`sanitize-error-message.ts`/`.spec.ts`, 관련 DTO)를 프롬프트에 실린 diff와 저장소의
현재 파일을 직접 `Read`로 대조했다. 이 changeset은 이미 3라운드 `/ai-review`
(`23_08_19` WARNING 8→반영, `23_50_03` CRITICAL 1→철회로 해소, `00_23_57` WARNING
1→반영)를 거쳐 CRITICAL 0으로 수렴한 상태이며, 이번은 그 최종 스냅샷에 대한 4번째
독립 검증이다. 관련 spec은 `spec/5-system/14-external-interaction-api.md` §R17,
`spec/5-system/6-websocket-protocol.md` §4.1, `spec/5-system/12-webhook.md` §5.3으로
식별했다.

## 발견사항

- **[INFO]** `inputData`/`outputData` 마스킹 예외·마커보존 로직이 코드·테스트·DTO·spec
  네 층에서 정확히 동일한 근거(`MASKED_INPUT_DATA_REASON`, 12-webhook §5.3)를 가리켜
  일치한다 — 별도 조치 불필요, 양호 사례로 기록.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:83`
    (`MASKED_INPUT_DATA_REASON` 정의), `:720`, `:1028`, `:1093` (호출부 3곳 모두 동일
    상수 참조) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:304`
    / `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:51`
    / `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:55`
    / `spec/5-system/14-external-interaction-api.md:1530-1546` (잔여 ②).
  - 상세: §R17 "적용 범위는 총칭이 아니라 열거다" 표(표면 6·컬럼 2)와
    `ExecutionsService.toResponseExecution` JSDoc의 표가 line-level로 대응한다:
    `findById`(`:748`) · `getChain`(`:639`) · `stop`(`:901`) · `toExecutionDto`(목록,
    `:1029-1031`) · `findById`의 `nodeExecutions[]`(`:713-729`) ·
    `BackgroundRunsService.toNodeExecutionDto`(`:305-307`) 여섯 곳 모두
    `redactStoredDataForResponse`(outputData)/`redactStoredErrorForResponse`(error)를
    통과하고 `inputData`는 여섯 곳 모두 원문 그대로다 — spec 표와 코드 호출부 수·대상
    컬럼이 정확히 일치한다.

- **[INFO]** WS emit 값-패턴 마스킹(`maskWireEnvelope`)이 wire·fanout 양쪽에 걸리고
  `llmCalls` 예외만 살아있다는 spec 캐비엇(`6-websocket-protocol.md` §4.1, 2026-08-16)이
  구현과 일치한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:261`
    (`emitExecutionEvent`의 `maskWireEnvelope` 호출), `:335`(`emitNodeEvent` 동일),
    `:387-394`(`maskWireEnvelope` 정의, `deepRedactSecretsPreserving` +
    `WIRE_PRESERVED_FIELDS`), `:79-81`(`WIRE_PRESERVED_FIELDS`가
    `EXTERNAL_STRIPPED_FIELDS`를 재사용).
  - 상세: spec은 "예외는 `llmCalls` 하나"라 명시하고, 코드는 `WIRE_PRESERVED_FIELDS`를
    `EXTERNAL_STRIPPED_FIELDS`(=`['llmCalls']`)에서 파생시켜 두 목록이 구조적으로
    갈릴 수 없게 했다 — 텍스트 서술과 구현이 동어반복이 아니라 실제로 같은 배열을
    공유하는 형태로 일치.

- **[INFO]** `emitKbEvent`/`emitBackgroundRunEvent`는 이번 diff의 값-패턴 마스킹
  대상에서 빠져 있으나(`sanitizePayloadForWs` 키-이름 마스킹만 적용), 실측 결과
  `executionEventSubject`를 경유하지 않아 외부 fanout 경로가 없다 — RESOLUTION 문서의
  "이 PR이 겨눈 표면이 아니다" 주장과 일치하는 것을 grep으로 재확인했다(신규 결함
  아님, 이미 트래커 등재).
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:449-465`
    (`emitBackgroundRunEvent`, `gateway.broadcastToChannel` 직접 호출·
    `executionEventSubject.next` 없음), `:310-324`(`emitKbEvent` 동일 패턴).
  - 상세: `grep -rl emitBackgroundRunEvent`로 확인한 호출부는
    `background-execution.processor.ts` 하나뿐이고 이 이벤트는 `background:run:<id>`
    채널로만 나간다 — SSE/webhook fanout이 구독하는 `executionEventSubject`와 무관.
  - 제안: 조치 불요(이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에
    등재됨, 별도 확인 완료).

- **[INFO]** `redactStoredDataForResponse`와 `redactStoredErrorForResponse`는 현재
  함수 본문이 완전히 동일(둘 다 `deepRedactSecrets(x)`로 위임)하지만, 이는 의도적
  분리로 문서화돼 있고 두 함수의 존재 이유(§R17이 "컬럼별 관문"을 열거로 못박음)와
  일치한다 — 코드 중복이 아니라 방어 설계로 판단, 별도 지적 없음.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35`,
    `:66-71`.

## 확인했으나 문제 없음 (참고)

- `maskIfPresent`(`executions.service.ts:111-116`)의 non-null 시그니처는 JSDoc이
  "정적 계약(엔티티 non-null)과 런타임 방어(TypeORM undefined 가능성)를 분리한
  의도"라고 명시하며, 실제로 제네릭을 쓰지 않고 구체 타입을 고정해 (RESOLUTION이
  기록한) 과거 빌드 실패 원인을 재발시키지 않는 형태로 남아 있다.
- `deepRedactCore`의 마커 보존(`isMaskedMarker`)은 `CREDENTIAL_KEY_PATTERN`에 매칭되는
  키 값에만 적용되며, 비-credential 키 아래의 `[REDACTED]` 문자열은 애초에
  `SECRET_LEAK_PATTERNS`가 매치하지 않아 통과한다 — "마커를 덮지 않는다"는 서술과
  실제 동작(우회 경로가 없음)이 코드 경로 추적으로 확인된다.
- `spec/5-system/6-websocket-protocol.md`의 `nodeName`→`nodeLabel` 정정과
  `spec/5-system/3-error-handling.md`의 동일 정정은 실제 emit 코드(`nodeLabel: node.label ?? node.type`)와
  일치하며, drift 정정 근거(실측 0건)도 타당하다.
- 테스트(`executions.service.spec.ts` ⑥-b, `background-runs.service.spec.ts` 신규 2건,
  `redact-stored-error.spec.ts`/`sanitize-error-message.spec.ts` 신규 describe)가
  참조 동일성(copy-on-change) · null/undefined 정규화 · 마커 멱등성 · 캐시 비공유라는
  엣지 케이스를 모두 명시적으로 단언하고 있어, 이번 요구사항 검토 관점에서 추가로
  요구할 엣지 케이스 커버리지 갭은 발견하지 못했다.
- TODO/FIXME/HACK/XXX 계열 주석은 diff 추가분 어디에도 없다(`grep` 전수 확인).

## 요약

핵심 코드(`executions.service.ts`, `background-runs.service.ts`,
`websocket.service.ts`, `redact-stored-error.ts`, `sanitize-error-message.ts`)를
직접 열어 spec(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md`
§4.1, `12-webhook.md` §5.3)과 line-level로 대조한 결과, 표면 수(6)·컬럼 수(2, `error`
+`outputData`)·`inputData` 비대상 결정·`llmCalls` wire 예외·마커 보존 규칙 모두
코드-spec-테스트-DTO 네 층에서 일관되게 구현돼 있다. 이 changeset은 이미 3라운드
`/ai-review`를 거쳐 CRITICAL을 모두 해소(특히 `inputData` 재제출 오염 CRITICAL을
소스 추적까지 거쳐 정확히 되돌림)한 상태이고, 이번 독립 검토에서도 새로운
CRITICAL/WARNING급 요구사항 불일치는 발견하지 못했다. 남은 항목(kb/background WS
채널 미마스킹)은 실측으로 범위 밖임이 재확인되는 INFO다.

## 위험도

LOW
