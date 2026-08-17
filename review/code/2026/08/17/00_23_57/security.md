# Security Review

## 발견사항

- **[INFO]** `kb:<documentId>` / `background:run:<id>` WS 채널은 이번 PR 이 도입한 값-패턴 마스킹(`maskWireEnvelope`)을 거치지 않는다 — `emitKbEvent`/`emitBackgroundRunEvent` 는 여전히 `sanitizePayloadForWs`(키-이름 매칭)만 적용한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `emitKbEvent`(함수), `emitBackgroundRunEvent`(함수) — 두 함수 모두 `maskWireEnvelope`/`toFanoutEnvelope` 를 호출하지 않는다.
  - 상세: 이번 PR 은 `execution:<id>` wire 채널에 값-마스킹을 새로 건 근거로 "구독 인가가 `verifyOwnership(executionId, workspaceId)` 만 보고 role 을 받지 않아 수신 인구가 `GET /api/executions/:id` 와 동일(viewer 포함 워크스페이스 멤버 전원)"이라는 **population-parity** 논리를 댔다(`websocket.service.ts` `maskWireEnvelope` JSDoc). `kb:`/`background:run:` 채널의 authorizer(`KbChannelAuthorizer`/`BackgroundRunChannelAuthorizer`)도 동일하게 workspace 소유 여부만 보고 role 을 받지 않아 **같은 population-parity 논리가 그대로 적용된다**. `RESOLUTION.md`(`review/code/2026/08/16/23_08_19/RESOLUTION.md` Testing INFO 14)는 이 두 채널을 "executionEventSubject 로 fanout 되지 않아 외부 수신자가 없다"는 이유로 범위 밖으로 결정했는데, 그 근거는 *외부* 노출에는 맞지만 이번 PR 이 wire 마스킹을 정당화한 *내부(워크스페이스 viewer)* 노출 근거와는 정면으로 배치된다 — `graph-extraction.service.ts`/`embedding.service.ts` 가 LLM 추출 실패 시 upstream 에러 텍스트를 `emitKbEvent` payload 에 실을 수 있어, 자유 텍스트 자격증명이 값-마스킹 없이 workspace viewer 에게 도달할 이론적 경로가 남아 있다.
  - 제안: 새 결함은 아니며(이 PR 이 만들지 않았고 이미 한 차례 평가·이연됨) 이번 diff 를 막을 이유는 아니다. 다만 "population parity" 논리를 재사용해 `maskWireEnvelope` 를 `emitKbEvent`/`emitBackgroundRunEvent` 에도 적용하는 후속 작업을 트래커에 근거(population-parity, "no external fanout"이 내부 viewer 노출까지 면제하지는 않는다는 점)와 함께 등재하는 것을 권장한다.

- **[INFO]** `inputData`(Execution/NodeExecution/BackgroundRun)는 이번 PR 에서도 값-패턴 마스킹 대상에서 의도적으로 제외된다 — 트리거 파라미터 자유 텍스트에 박힌 자격증명(webhook 민감 헤더 제외)은 `GET /executions/:id` 등 내부 REST·WS 스냅샷을 통해 workspace 멤버 전원(viewer 포함)에게 원문으로 계속 노출된다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:83` (`MASKED_INPUT_DATA_REASON` 상수 JSDoc) / `redactStoredDataForResponse` 미호출 지점(`toResponseExecution`, `toExecutionDto`, `background-runs.service.ts` 의 `inputData: row.inputData ?? null`).
  - 상세: 이 결정은 Re-run 모달 프리필(`useOriginalInput` 기본 `false`)이 `inputData` 를 그대로 재제출하는 구체적 회귀(마스킹 시 리터럴 `'***'` 가 새 실행의 실제 입력이 됨)를 근거로 한 **잘 문서화된 트레이드오프**이고, 두 독립 게이트(`23_49_05` cross_spec · `23_50_03` side_effect)가 CRITICAL 로 반증까지 마친 결정이라 이번 PR 의 결함이 아니다. 다만 순수 보안 관점에서는 잔존 egress 경로(자격증명이 포함된 trigger 파라미터가 마스킹 없이 워크스페이스 viewer 에게 노출)라는 사실 자체는 기록해 둘 가치가 있다 — 저자도 "잔여 갭임을 인정한다"고 JSDoc 에 명시했다.
  - 제안: 조치 불필요(설계 의도, 이미 트래커에 등재됨 — "프런트가 마스킹 마커를 감지해 재입력을 강제하는 가드가 선행되면 그때 이 컬럼도 닫는다").

- **[INFO]** `SECRET_LEAK_PATTERNS` 는 `access_token`/`refresh_token`/`id_token`/`api_key` 키워드는 잡지만 bare `token=` 키워드는 잡지 않는다 — 이번 라운드 테스트 작성 중 fixture 로 실증됐다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:33` (`SECRET_LEAK_PATTERNS` 배열, 두 번째 패턴)
  - 상세: `redactStoredDataForResponse`/`redactStoredErrorForResponse`/WS 값-마스킹이 모두 이 패턴 집합을 공유하므로, `token=sk-live-...` 형태로만 노출되는 자격증명은 세 표면 모두에서 통과한다. `RESOLUTION.md` 가 이미 별건으로 확인해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재했고, `.spec.ts` 캐너리(`잔여 갭 캐너리`)가 이 갭을 명시적으로 고정해 두었다 — 조용한 갭이 아니라 관측되고 있는 갭이다.
  - 제안: 조치 불필요(이미 등재·캐너리로 고정됨). 패턴 확장은 별도 PR 범위.

## 리뷰 대상 코드에서 확인한 사항 (참고, 결함 아님)

- 값-마스킹 정규식(`SECRET_LEAK_PATTERNS`, WS `CREDENTIAL_KEY_PATTERN`)은 모두 중첩 정량자·모호한 교대가 없는 선형 패턴이라 ReDoS 위험이 없다. `deepRedactCore`/`deepRedactObject` 의 재귀는 `MAX_REDACT_DEPTH=10` 로 상한이 있어 순환 참조가 섞여도 스택 오버플로/무한루프로 이어지지 않는다.
- `redactStoredDataForResponse`/`redactStoredErrorForResponse`/`deepRedactSecrets` 계열은 모두 copy-on-change 로 원본 엔티티를 변이하지 않는다(egress-only, DB 원문 보존) — `.spec.ts` 캐너리(`입력 객체를 변이하지 않는다`)로 고정.
- 마커 멱등성(`[REDACTED]`/`[REDACTED_DEPTH]`/`***`) 처리가 `MASKED_MARKERS` 단일 상수 집합으로 통일되어, webhook ingestion 마커(12-webhook §5.3 계약)를 재마스킹해 표면마다 다른 값으로 보이게 만드는 회귀를 캐너리 테스트로 방지한다.
- `execution:`/`kb:`/`background:run:` 채널 authorizer 는 모두 `isValidUuid` 선검증 후 workspace 소유 여부만 검사(`verifyOwnership`/`verifyDocumentOwnership`)하며 role 게이팅이 없다는 코드 근거를 직접 확인했다 — CHANGELOG/JSDoc 의 "boundary masking parity" 주장과 일치한다.
- `BackgroundRunsController` 에 `@Roles` 데코레이터가 없다는 diff 주석 주장을 컨트롤러 파일에서 직접 확인했다 — 워크스페이스 멤버 전원(viewer 포함) 노출 인구 주장이 정확하다.
- 하드코딩된 실제 시크릿·인증서는 발견되지 않았다. 테스트 fixture 의 `sk-live-abc123`/`eyJhbGci...LEAKED`/`postgres://admin:pw@...` 등은 전부 명백한 합성 예시값이다.
- SQL/커맨드/경로 인젝션, 인증 우회, 안전하지 않은 해시/암호화 알고리즘, 평문 전송 관련 신규 취약점은 발견되지 않았다 — 이번 diff 는 응답 직전 egress 마스킹 로직·테스트·문서에 국한된다.

## 요약

이번 PR 은 이전 라운드(#1177~#1179)가 종결 `Execution.error` 만 닫고 남긴 갭 — WS emit 의 자유 텍스트 값(비-종결 execution 이벤트·node 이벤트·내부 wire 채널)과 내부 REST 여섯 표면의 `outputData` — 을 값-패턴 마스킹으로 닫는다. 마스킹 함수(`redactStoredDataForResponse`, `deepRedactSecretsPreserving`)는 기존 `redactStoredErrorForResponse`/`deepRedactSecrets` 프리미티브를 그대로 재사용하고, 정규식은 ReDoS 안전하며 재귀는 깊이 상한으로 유계다. `inputData` 를 의도적으로 마스킹 대상에서 제외한 결정은 Re-run 재제출 오염이라는 구체적 CRITICAL 회귀를 두 독립 게이트가 반증한 데 따른 것으로 근거가 탄탄하고, webhook 마커 보존·copy-on-change·원본 불변 등 인접 계약도 캐너리 테스트로 고정되어 있다. 유일하게 짚을 점은 `kb:`/`background:run:` WS 채널이 이번에 새로 마스킹된 `execution:`/`node:` 채널과 **같은 근거(population parity)** 로도 값-마스킹이 안 걸려 있다는 논리적 비대칭인데, 이는 이번 diff 가 만든 결함이 아니라 이미 한 차례 평가·이연된 기존 갭이며 외부 fanout 경로가 없어 노출 범위가 제한적이다. 새로 도입된 인젝션·인증우회·하드코딩 시크릿·안전하지 않은 암호화 관련 취약점은 발견되지 않았다.

## 위험도
LOW
