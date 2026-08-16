# Security Review

## 발견사항

- **[INFO]** WS 내부 wire 채널은 `llmCalls` 서브트리를 값-패턴 마스킹에서 완전히 제외한다 — 수신 인구가 workspace 멤버 전원(viewer 포함)임에도.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:380` (`maskWireEnvelope`), `WIRE_PRESERVED_FIELDS` 정의는 같은 파일 `:75`
  - 상세: `maskWireEnvelope`(신규)가 `deepRedactSecretsPreserving(wireEnvelope, WIRE_PRESERVED_FIELDS)` 를 호출하고 `WIRE_PRESERVED_FIELDS = new Set(EXTERNAL_STRIPPED_FIELDS)` = `['llmCalls']` 이다. JSDoc(`:361-369`)이 스스로 실측한 바에 따르면 `execution:<id>` 채널 구독 인가는 `ExecutionChannelAuthorizer.verifyOwnership(executionId, workspaceId)` 만 확인하고 role 을 보지 않는다 — 즉 `GET /api/executions/:id` 와 동일하게 viewer 포함 워크스페이스 멤버 전원이 수신 가능하다. 이 PR 은 그 인구에 대해 wire 의 대부분 필드를 값-패턴 마스킹으로 새로 닫았지만, `llmCalls` 서브트리(에디터 원문 LLM 요청/응답 — 시스템 프롬프트, 도구 호출 인자 등)는 자유 텍스트 안에 박힌 자격증명(`Bearer …`, URI 자격증명 등)이 있어도 그대로 나간다. `sanitizePayloadForWs` 의 키-이름 마스킹은 여전히 적용되므로 `api_key` 같은 credential-키 필드는 `[REDACTED]` 로 가려지지만, 값-패턴(자유 텍스트에 섞인 토큰)은 `llmCalls` 안에서는 전혀 걸러지지 않는다.
  - 판단: 이는 이번 diff 가 새로 만든 회귀가 아니라(이 필드는 이전에도 wire 에서 완전히 원문이었고, 이 PR 은 오히려 다른 모든 필드를 새로 마스킹해 노출 표면을 줄였다) 문서화된 의도적 trade-off(WS §Rationale "값-레벨 마스킹은 에디터 디버깅 가치를 훼손")다. 다만 "내부=신뢰된 콘솔" 이라는 전제가 viewer role 까지 포함한다는 점은 코드 자체가 실측으로 반증하고 있으므로, 위협 모델이 "workspace viewer 는 신뢰 경계 안" 이 아니게 되면 이 예외가 가장 먼저 재검토 대상이 되어야 한다. 별도 조치 불요 — 참고용 기록.
  - 제안: 없음(설계상 수용된 리스크). 위협 모델 변경 시(예: viewer role 을 저-신뢰로 재분류) `llmCalls` 도 fanout 과 동일하게 값-마스킹 대상으로 재검토.

- **[INFO]** 마커 보존(`isMaskedMarker`)은 정확한 문자열 일치로만 판단해 마스킹을 건너뛴다 — 이론상 자격증명 값이 우연히 마커 문자열과 정확히 같으면 재마스킹되지 않는다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:117-125` (`MASKED_MARKERS`, `isMaskedMarker`), 소비 지점은 같은 파일 `:249-251`
  - 상세: `deepRedactObject` 는 credential-key 로 매칭된 값이 `'***'` · `'[REDACTED]'` · `'[REDACTED_DEPTH]'` 중 하나와 **정확히 같으면** 그대로 통과시킨다. 마커 문자열 자체는 정보가 없으므로(우연히 실제 시크릿 값이 이 세 문자열 중 하나와 정확히 일치하는 경우가 아니면) 실질적 노출은 발생하지 않는다 — 그런 값 자체가 이미 아무 정보도 담지 않는다. 부분 문자열 일치가 아니라 완전 일치이므로 마스킹된 접두/접미만 있는 값(예: `[REDACTED]abc`)은 여전히 `***` 로 덮인다.
  - 판단: 실질적 익스플로잇 경로 없음(마스킹 우회로 이어지는 값 자체가 시크릿이 아니다). 설계 의도(단방향 안전: 절대 unmask 하지 않고 이미 마스킹된 값만 보존)와 일치. 코드/캐너리 테스트로 고정돼 있음.
  - 제안: 없음. 기록용.

- **[INFO]** `GET /api/executions/:id` 계열 읽기 표면은 `@Roles` 게이트 없이 워크스페이스 멤버 전원(viewer 포함)에게 열려 있다는 전제가 이번 마스킹 확장의 근거로 반복 인용된다 — 신규 도입이 아니라 기존 인가 모델의 재확인이다.
  - 위치: 근거는 코드가 아니라 `plan/complete/eia-internal-rest-error-masking.md:42`, `plan/in-progress/eia-fanout-and-internal-data-masking.md` 전반에 실측으로 기록됨(`executions.controller.ts:63` 인용)
  - 상세: 이 PR 자체는 인가 모델을 바꾸지 않고 그 모델을 전제로 egress 마스킹을 넓힌다. 인가 자체(왜 viewer 가 `error`/`inputData`/`outputData` 를 읽을 수 있는가)는 이번 diff 범위 밖이며 기존 spec(§R-5, §R17)이 이미 "role 게이팅이 아니라 boundary masking parity 로 방어" 라는 정책을 명시하고 있다.
  - 제안: 없음 — 범위 밖. 참고용.

## 검토 방법

전체 파일 컨텍스트가 프롬프트에 실리지 않은 파일(대부분)은 `Read` 로 직접 원본을 열어 확인했다:
`codebase/backend/src/modules/websocket/websocket.service.ts`(전체),
`codebase/backend/src/modules/executions/executions.service.ts`(`toResponseExecution`/`stop`/`stopInternal`/`getChain`/`toExecutionDto`/`findById`/캐시 write 순서 포함),
`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`(`toNodeExecutionDto`),
`codebase/backend/src/shared/utils/strip-external-only-fields.ts`(`EXTERNAL_STRIPPED_FIELDS`).
`sanitize-error-message.ts` · `redact-stored-error.ts` 는 diff 에 전체 컨텍스트가 포함돼 있어 그대로 검토했다.

핵심 확인 사항:
- 문서(JSDoc)가 주장하는 "6개 읽기 표면이 전부 `toResponseExecution`/`toExecutionDto` 두 관문 중 하나를 지난다"는 서술을 `grep` 으로 호출부를 추적해 확인 — 우회 경로 없음.
- `findById` 의 LRU 스냅샷 캐시(`writeSnapshotCache`)가 마스킹 **이후** 값을 쓰는지 확인 — 맞음(캐시 우회로 인한 원문 노출 없음).
- WS `maskWireEnvelope`(값-마스킹) → `toFanoutEnvelope`(strip + routing 첨부, 재마스킹 없음) 순서를 확인 — `attachRoutingContext` 가 붙이는 `[REDACTED]` 마커가 재마스킹으로 `***` 로 덮이지 않음을 코드로 확인.
- `deepRedactSecrets`(캐시 사용) vs `deepRedactSecretsPreserving`(캐시 미사용) 이 별도 캐시 오염 없이 분리돼 있음을 리팩터 diff 로 확인.
- SQL/커맨드 인젝션·경로 탐색·하드코딩된 실제 시크릿·안전하지 않은 암호화 프리미티브 신설 없음 — 이번 변경은 순수 egress 마스킹 계층 추가/확장이며 신규 외부 입력 처리 경로나 신규 쿼리 빌더 사용이 없다.
- 테스트 픽스처의 `sk-live-abc123`, `postgres://admin:pw@db.internal/prod`, `Bearer eyJhbGci…` 등은 전부 명백한 가짜 값(마스킹 검증용)이며 실제 시크릿 노출이 아니다.

## 요약

이번 변경은 `Execution`/`NodeExecution`/`BackgroundRun` 읽기 응답과 WS emit(wire+fanout) 양쪽에 걸쳐 "자유 텍스트 값 안에 박힌 자격증명" 을 잡는 값-패턴 마스킹 계층(`redactStoredDataForResponse`, `deepRedactSecretsPreserving`, `maskWireEnvelope`)을 신설·확장하고, 기존 마스킹 마커(`[REDACTED]`/`[REDACTED_DEPTH]`)를 재마스킹으로 덮지 않는 멱등성 보장을 추가한다. 코드를 직접 열어 대조한 결과 문서(JSDoc·plan)가 주장하는 "모든 읽기 표면이 단일 관문을 통과한다"는 구조적 보장이 실제로 성립하며, 캐시 쓰기 순서·마스킹 순서(마스킹→캐시, 값마스킹→strip, 재마스킹 금지)에도 우회 경로가 없다. 새로운 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은 암호화는 발견되지 않았다. `llmCalls` 를 wire 값-마스킹에서 제외한 것과 마커의 정확 문자열 일치 검사는 둘 다 검토했으나 실질적 익스플로잇 경로가 없는 문서화된 설계상 trade-off로 판단해 INFO 로만 기록한다.

## 위험도

NONE
