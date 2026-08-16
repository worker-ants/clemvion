# Security Review

## 발견사항

- **[INFO]** WS 내부 wire 채널의 `llmCalls` 예외(`preserveKeys`)가 트리 깊이와 무관하게, 그 이름의 키가 나타나는 **모든 자리**에 적용된다 — 정확히는 "에디터 디버그 필드"만이 아니라 임의 위치의 동명 키까지 원문 보존한다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:248` (`if (opts.preserveKeys?.has(k))` — depth 인자 없이 키 이름만으로 판단), 호출부 `codebase/backend/src/modules/websocket/websocket.service.ts:79`(`WIRE_PRESERVED_FIELDS`)·`:387`(`maskWireEnvelope`)
  - 상세: `deepRedactObject` 의 `preserveKeys` 체크는 순회 중 어느 depth 에서든 키 이름이 집합에 있으면 그 하위 트리 전체를 마스킹하지 않는다(테스트 `sanitize-error-message.spec.ts` "깊이 무관하게 보존한다"가 의도적으로 이 동작을 고정한다). 워크플로 output/입력 데이터는 외부 응답(webhook body, HTTP 노드 응답 등)을 담을 수 있어 임의 키 이름을 가질 수 있다 — 만약 그 데이터 어딘가에 `llmCalls` 라는 이름의 키가 우연히(혹은 공격자가 응답을 조작해 의도적으로) 존재하면, 그 하위 트리는 내부 WS wire 채널에서 값-패턴 마스킹을 건너뛴다. 다만 이 채널은 fanout(외부)에서는 `stripExternalOnlyFields` 가 `llmCalls` 필드를 통째로 제거하므로 외부로는 나가지 않고, wire 수신 인구(워크스페이스 멤버 전원, viewer 포함)는 이 diff 이전에도 전체 payload 를 원문으로 받고 있었으므로 이 diff 가 새로 여는 노출 표면은 아니다(순노출 감소 방향).
  - 제안: 조치 불요(설계상 trade-off, 기존 인가 경계 내). 다만 `preserveKeys` 매칭을 "wire envelope 최상위의 `llmCalls` 필드"로만 한정(예: depth === 0 에서만 검사)하면 우연한 동명 키로 인한 의도치 않은 보존 범위 확대를 막을 수 있다 — 우선순위 낮음, 캐너리 테스트가 이미 이 동작을 의도적으로 고정하고 있으므로 변경 시 그 테스트도 함께 재검토 필요.

- **[INFO]** `execution:<id>` WS 채널 구독 인가가 role 을 검사하지 않아, 새로 마스킹을 건 wire/fanout 의 수신 인구가 `GET /api/executions/:id` 와 동일(workspace 멤버 전원, viewer 포함)하다 — 이 diff 가 만든 것이 아니라 기존 인가 모델의 재확인이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:372`(JSDoc 인용) 및 `codebase/backend/src/modules/executions/execution-channel-authorizer.ts`(`verifyOwnership(executionId, workspaceId)`, 이번 diff 범위 밖)
  - 상세: 이 PR 자체는 인가 모델을 바꾸지 않고 오히려 그 넓은 수신 인구를 전제로 값-패턴 egress 마스킹을 wire 단계까지 새로 넓혀 노출을 줄인다(순효과는 방어 강화). 인가 자체(왜 viewer 가 `error`/`inputData`/`outputData`/emit payload 를 읽을 수 있는가)는 EIA §R17/§R-5 가 이미 "role 게이팅이 아니라 boundary masking parity" 로 방어한다고 명시한 기존 정책이다.
  - 제안: 없음 — 범위 밖. 참고용 기록.

- **[INFO]** 마커 보존(`isMaskedMarker`)이 정확한 문자열 완전일치로만 판단해 재마스킹을 건너뛴다 — 이론상 실제 값이 마커 문자열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 우연히 정확히 같으면 그 값도 "이미 마스킹됨"으로 오인돼 통과한다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:117-132`(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`), 소비 지점 `:257-258`
  - 상세: 통과하려면 credential-key 값이 정확히 `'***'`, `'[REDACTED]'`, `'[REDACTED_DEPTH]'` 중 하나여야 하는데, 그 자체로 정보가 없는 리터럴이라(진짜 시크릿이 우연히 이 세 문자열 중 하나와 완전히 같을 확률은 사실상 0) 실질적 익스플로잇 경로는 없다. 부분 문자열 포함이 아니라 완전 일치이므로 `[REDACTED]abc` 같은 값은 여전히 `***` 로 덮인다.
  - 제안: 없음. 설계 의도(단방향 안전 — 절대 unmask 하지 않고 이미 마스킹된 값만 보존)와 일치하며 캐너리 테스트로 고정돼 있다.

- **[INFO]** `SECRET_LEAK_PATTERNS`(값-패턴 마스킹의 정본 정규식 목록)에 bare `token=` 키워드가 없다 — `access_token`/`refresh_token`/`id_token`/`api_key` 는 있지만 `token` 단독은 없어, OAuth 쿼리스트링/응답에 흔한 `token=sk-live-...` 형태가 값-마스킹을 통과할 수 있다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:37`(`SECRET_LEAK_PATTERNS[1]` — 키워드 alternation에 `token` 단독 없음)
  - 상세: 이번 diff 가 만든 결함이 아니다(기존 패턴 자산). 개발자가 이번 라운드에서 무수정 프로브(테스트 fixture 를 `token=sk-live-abc123` 으로 썼다가 마스킹되지 않는 것을 관측)로 실측 확인해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(`- [ ] SECRET_LEAK_PATTERNS 가 bare token= 을 안 잡는다`)에 이미 등재해 뒀다.
  - 제안: 없음 — 이미 트래커에 등재됨, 별건으로 처리 예정(패턴 확장은 `deepRedactSecrets` 의 모든 소비자에 영향을 주는 blast radius 라 캐너리 회귀 검증과 함께 별도 라운드로 미루는 것이 합리적).

- **[INFO]** `background-runs.service.ts`/`executions.service.ts` 의 읽기 표면(6곳)이 여전히 `@Roles` 게이트 없이 워크스페이스 멤버 전원에게 열려 있다 — 이번 diff 는 이 인가 모델을 전제로 egress 마스킹만 넓힌다(인가 변경 없음).
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:300-306`(`toNodeExecutionDto` 주석이 스스로 명시)
  - 상세: 인가 자체는 이번 diff 범위 밖이고 EIA §R17 이 "boundary masking parity" 정책으로 이미 다룬다. 참고용.
  - 제안: 없음.

## 검토 방법

`git diff origin/main` (`f5351e9c2`..`e5a63abff`) 로 실제 변경 파일을 확인하고, 프롬프트에서 생략된 파일(`websocket.service.ts`·`sanitize-error-message.ts`·`executions.service.ts`)은 `Read`/`Bash git diff`로 직접 원본을 열어 대조했다. 핵심 확인 사항:

- 값-마스킹 정규식(`SECRET_LEAK_PATTERNS`) 6개 전부 중첩 정량자가 없는 선형 패턴 — ReDoS 형태 아님(`(?<=...)`/`(?=...)` lookaround 도 폭이 유계).
- `deepRedactSecrets`/`deepRedactSecretsPreserving`/`redactStoredDataForResponse`/`maskWireEnvelope` 모두 copy-on-change 를 지켜 입력을 변이하지 않음.
- `executions.service.ts`의 `toResponseExecution`/`toExecutionDto`/`findById` nodeExecutions[] map, `background-runs.service.ts`의 `toNodeExecutionDto` — 6개 읽기 표면 전부에 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 가 실제로 걸려 있음을 호출부 추적으로 확인, 우회 경로 없음.
- 마스킹 순서(값마스킹 → strip → routing 첨부) 확인 — `attachRoutingContext` 가 붙이는 `[REDACTED]` 마커가 재마스킹으로 덮이지 않음(`isMaskedMarker` 멱등성).
- 신규 SQL/커맨드/경로 인젝션 벡터, 신규 쿼리 빌더, 신규 외부 입력 처리 경로 없음 — 이번 변경은 순수 egress 마스킹 계층 추가/확장.
- 테스트 픽스처의 `sk-live-abc123`/`postgres://admin:pw@db.internal/prod`/`Bearer eyJhbGci…` 등은 전부 마스킹 검증용 가짜 값이며 실제 시크릿 노출 아님.
- 하드코딩된 실제 자격증명·API 키·인증서 없음.
- 인증/인가 로직 자체의 변경 없음 — 기존 workspace-ownership 기반 모델(`ExecutionChannelAuthorizer.verifyOwnership`, `@Roles` 부재)이 그대로 전제되고, 이번 diff 는 그 넓은 수신 인구에 대한 egress 마스킹만 강화한다(순효과는 노출 축소).

## 요약

이번 변경(`origin/main`..`e5a63abff`)은 `Execution.error` 마스킹(선행 PR #1177/#1179)의 자매 컬럼(`inputData`/`outputData`, 6개 읽기 표면)과 WS emit(wire+fanout, node/비종결 이벤트 포함) 양쪽에 걸쳐 "자유 텍스트 값 안에 박힌 자격증명"을 잡는 값-패턴 마스킹 계층을 신설·확장하고, 기존 마스킹 마커(`[REDACTED]`/`[REDACTED_DEPTH]`)를 재마스킹으로 덮지 않는 멱등성 보장을 추가하는 순수 egress 하드닝 작업이다. 코드를 직접 열어 대조한 결과 문서(JSDoc·plan)가 주장하는 "모든 읽기/emit 표면이 단일 관문을 통과한다"는 구조적 보장이 실제로 성립하고, 캐시 쓰기 순서·마스킹 순서에 우회 경로가 없다. 신규 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은 암호화·평문 전송 확대는 발견되지 않았다. `llmCalls` preserveKeys 의 depth-무관 매칭, 마커 완전일치 검사, `viewer` 포함 넓은 wire 수신 인구, `token=` 단독 패턴 부재 등은 모두 검토했으나 이 diff 가 새로 만든 결함이 아니거나(기존 인가 모델·기존 패턴 자산) 문서화된 의도적 trade-off이며 실질적 익스플로잇 경로가 없어 INFO 로만 기록한다.

## 위험도

NONE
