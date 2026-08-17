# Security Review

## 검토 방법

`origin/main` 대비 누적 diff(masking followups, 커밋 `a8b0cbfdd`~`81c9fcd60`)를 대상으로 했다.
이 changeset 은 이미 3라운드 보안 리뷰(`23_08_19`·`23_50_03`·`00_23_57`)를 거쳤고, 이번 라운드의
신규 델타는 마지막 커밋(`81c9fcd60`, chat-channel verbatim 계약 캐비엇 + 게이트 잔여)뿐이며
**코드 변경은 없고 spec/plan 문서·주석 정정뿐**임을 `git show --stat 81c9fcd60` 로 확인했다.
따라서 이번 라운드에서는 (1) 핵심 마스킹 관문(`sanitize-error-message.ts`·`redact-stored-error.ts`·
`websocket.service.ts`·`executions.service.ts`·`background-runs.service.ts`)을 처음부터 직접 열어
독립적으로 재검증하고, (2) 선행 라운드가 INFO 로 남긴 항목들이 이번에도 유효한지 재확인했다.

## 발견사항

- **[INFO]** WS 내부 wire 채널의 `preserveKeys`(`llmCalls`) 예외가 트리 깊이·경로와 무관하게
  **키 이름만으로** 매칭된다 — 선행 라운드(`23_50_03`)가 이미 지적하고 트레이드오프로 수용한
  항목을 독립적으로 재확인했다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactObject` 함수의
    `if (opts.preserveKeys?.has(k))` 분기(`preserveKeys` 체크가 depth·path 인자 없이 키 이름만
    검사) / 호출부 `codebase/backend/src/modules/websocket/websocket.service.ts` `WIRE_PRESERVED_FIELDS`
    선언과 `maskWireEnvelope` 함수.
  - 상세: 워크플로 output/input 은 webhook body·HTTP 노드 응답 등 **외부에서 온 임의 JSON**을
    담을 수 있어, 그 데이터 어딘가에 우연히(혹은 응답을 통제할 수 있는 상류 API/webhook 발신자가
    의도적으로) `llmCalls` 라는 이름의 키가 나타나면 그 하위 트리 전체가 내부 WS wire 채널에서
    값-패턴 마스킹을 건너뛴다. `execution:<id>` 채널 구독 인가(`ExecutionChannelAuthorizer`)는
    role 을 보지 않고 workspace 소유 여부만 확인하므로 viewer 포함 워크스페이스 멤버 전원이
    수신 대상이다. 다만 (a) fanout(외부: SSE·webhook·chat-channel)에서는 `stripExternalOnlyFields`
    가 `llmCalls` 필드를 깊이 무관하게 통째로 제거하므로 외부로는 나가지 않고, (b) 이 diff
    이전에는 wire 전체가 애초에 값-마스킹 없이 원문이었으므로 이 diff 가 **새로 여는** 노출
    표면이 아니라 순노출을 줄이는 방향의 잔여 갭이다. 테스트(`sanitize-error-message.spec.ts`
    "깊이 무관하게 보존한다")가 이 동작을 의도적으로 고정하고 있어 우연이 아니라 설계다.
  - 제안: 조치 불요(기존 인가 경계 내, 순노출 감소 방향). 우선순위를 올리려면 `preserveKeys`
    매칭을 wire envelope 최상위(depth===0)의 `llmCalls` 필드로만 한정하는 안을 검토할 수 있으나,
    이미 두 라운드가 낮은 우선순위로 판정했고 이번 라운드에서 새로 악화된 사실은 없다.

- **[INFO]** `kb:<documentId>` / `background:run:<id>` WS 채널은 이번 changeset 이 도입한 값-패턴
  마스킹(`maskWireEnvelope`)을 거치지 않는다 — `emitKbEvent`/`emitBackgroundRunEvent` 는 여전히
  `sanitizePayloadForWs`(키-이름 매칭)만 적용한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `emitKbEvent`,
    `emitBackgroundRunEvent` 함수 — 둘 다 `maskWireEnvelope`/`toFanoutEnvelope` 를 호출하지 않는다.
  - 상세: `execution:`/`node:` 채널에 wire 마스킹을 새로 건 근거(population parity — 구독 인가가
    role 을 안 보므로 `GET /api/executions/:id` 와 수신 인구가 동일)는 논리적으로 `kb:`/
    `background:run:` 채널의 authorizer 에도 동일하게 적용된다(둘 다 workspace 소유만 검사).
    선행 라운드 RESOLUTION 은 "executionEventSubject 로 fanout 되지 않아 외부 수신자가 없다"는
    이유로 이 두 채널을 범위 밖으로 명시 결정하고 트래커에 등재했다 — 이번 라운드에서 코드
    변경이 없으므로 이 판정은 그대로 유효하다.
  - 제안: 조치 불요(이미 평가·등재·이연됨). 재차 등재하지 않는다.

- **[INFO]** `inputData`(Execution/NodeExecution/BackgroundRun)는 값-패턴 마스킹 대상에서
  의도적으로 제외된다 — 트리거 파라미터 자유 텍스트에 박힌 자격증명(webhook 민감 헤더 제외)은
  내부 REST·WS 스냅샷을 통해 workspace 멤버 전원(viewer 포함)에게 원문으로 노출된다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `MASKED_INPUT_DATA_REASON`
    상수 JSDoc과 그 참조부(`toResponseExecution`·`toExecutionDto`) / `background-runs.service.ts`
    `toNodeExecutionDto` 의 `inputData: row.inputData ?? null`.
  - 상세: 이 결정은 Re-run 모달 프리필(`useOriginalInput` 기본 `false`)이 `inputData` 를 그대로
    재제출한다는 구체적 CRITICAL 회귀(마스킹 시 리터럴 `'***'` 가 새 실행의 실제 입력이 됨)를
    두 독립 게이트(`23_49_05` cross_spec · `23_50_03` side_effect)가 각각 반증한 데 따른 것으로,
    코드(`b05756d9e`)와 캐너리 테스트(`executions.service.spec.ts` ⑧·⑧-b·⑥-b,
    `background-runs.service.spec.ts`)로 고정돼 있다. 순수 보안 관점의 잔존 egress 경로라는
    사실 자체는 기록해 둘 가치가 있으나, 저자도 JSDoc 에 "잔여 갭임을 인정한다"고 명시했고
    후속 조건(프런트 마스킹 마커 감지 가드)까지 함께 트래커에 등재돼 있다.
  - 제안: 조치 불요(설계 의도, 이미 트래커 등재됨).

- **[INFO]** `SECRET_LEAK_PATTERNS` 가 `access_token`/`refresh_token`/`api_key` 등은 잡지만
  단독 `token=` 키워드는 잡지 않는다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS`
    배열(두 번째 패턴, `client[_-]secret|access[_-]token|...` 알터네이션에 단독 `token` 부재).
  - 상세: `redactStoredDataForResponse`/`redactStoredErrorForResponse`/WS 값-마스킹이 모두 이
    패턴 집합을 공유하므로 `token=sk-live-...` 형태로만 노출되는 자격증명은 세 표면 모두에서
    통과한다. 이 PR 이 만든 결함이 아니며, 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 등재됐고 `.spec.ts` 캐너리(잔여 갭 캐너리)가 갭 자체를 명시적으로 고정해 관측 중이다.
  - 제안: 조치 불요(이미 등재·캐너리로 고정). 패턴 확장은 별도 PR 범위.

## 리뷰 대상 코드에서 직접 확인한 사항 (참고, 결함 아님)

- **인젝션**: `background-runs.service.ts`/`executions.service.ts` 의 모든 쿼리는 TypeORM
  QueryBuilder 파라미터 바인딩(`:id`, `:executionId` 등)을 쓴다. 유일한 raw SQL 조각
  (`ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId`)도 값은 바인딩 파라미터이고
  표현식 자체에는 사용자 입력이 섞이지 않는다. `getSortColumn`(정렬 컬럼)은 이 diff 밖의
  기존 allow-list 기반 매핑이라 검토 범위 밖이지만 injection 벡터가 아님을 확인했다. 새 코드
  경로에 커맨드/경로/LDAP 인젝션 벡터는 없다.
- **ReDoS**: `SECRET_LEAK_PATTERNS`·WS `CREDENTIAL_KEY_PATTERN` 모두 중첩 정량자·모호한 교대가
  없는 선형(또는 최악의 경우도 다항) 패턴이다. `deepRedactCore`/`deepRedactObject`/
  `sanitizePayloadForWs` 재귀는 `MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`(=10)로 상한이 있어
  순환 참조가 섞여도 스택 오버플로/무한루프로 이어지지 않는다.
- **프로토타입 오염(CWE-1321)**: `deepRedactObject`(`sanitize-error-message.ts`)·
  `sanitizeInner`(`websocket.service.ts`)는 변경이 필요할 때만 `result = { ...value }` 로
  **원본 객체 전체를 먼저 스프레드**한 뒤 `result[k] = r` 로 대입한다. `value` 가
  `JSON.parse` 로 만들어져 `__proto__` 를 own-property 로 갖는 경우에도, 스프레드가 그 own
  property 를 `result` 로 옮겨 `Object.prototype.__proto__` 접근자를 가리므로 이후 대입이
  실제 프로토타입 체인을 바꾸지 않는다(`strip-external-only-fields.ts` 가 동일 논리를 문서화하고
  추가로 `Object.defineProperty` 이중 방어까지 두고 있음을 대조 확인). 빈 `{}` 로 시작해
  키별로 채워나가는 패턴이 아니므로 이 클래스의 오염 경로는 없다.
- **마스킹 우회/불변식**: `isMaskedMarker`(`MASKED_MARKERS` = `***`/`[REDACTED]`/`[REDACTED_DEPTH]`)
  는 credential-key 값이 이미 마커 문자열과 **정확히 일치**할 때만 재마스킹을 건너뛴다 —
  마커는 시크릿이 아니므로 이 완화가 실제 비밀을 노출로 되돌리는 경로는 없다(unmask 방향
  없음, `redactStoredDataForResponse`/`deepRedactSecretsPreserving` 모두 `deepRedactCore` 를
  공유해 규칙이 한 곳에서만 정의됨).
- **copy-on-change / 원본 불변**: `redactStoredDataForResponse`/`redactStoredErrorForResponse`/
  `deepRedactSecrets*` 계열은 모두 순수 함수로 DB 엔티티·입력 객체를 in-place mutate 하지
  않는다(egress-only, DB-at-rest 는 원문 보존) — `.spec.ts` 캐너리(`입력 객체를 변이하지
  않는다`)로 고정돼 있음을 직접 확인.
- **인가**: `verifyExecutionAccess`(`background-runs.service.ts`)는 소유권 불일치 시 존재
  여부와 무관하게 `NotFoundException` 으로 통일 — ID enumeration 방지가 의도적으로 유지된다.
  `execution:`/`kb:`/`background:run:` 채널 authorizer 는 모두 workspace 소유 여부만 검사하고
  role 게이팅이 없다는 코드 근거(`ExecutionChannelAuthorizer` 류)를 직접 확인했다 — CHANGELOG/
  JSDoc 의 "boundary masking parity" 주장과 일치한다. `BackgroundRunsController` 에 `@Roles`
  데코레이터가 없어 워크스페이스 멤버 전원(viewer 포함)에게 열려 있다는 주석 주장도 일치한다.
- **하드코딩된 시크릿**: 코드·테스트·리뷰 산출물(RESOLUTION.md 등)에 등장하는
  `sk-live-abc123`/`eyJhbGci...`/`postgres://admin:pw@db.internal/prod`/`Bearer sk-live-xyz` 류는
  전부 마스킹 로직을 검증하기 위한 합성 fixture 값이며, 실제 발급된 자격증명이 아니다.
- **암호화/평문 전송**: 이번 diff 는 응답 직전 egress 마스킹(REST 응답·WS emit)에 국한되며
  해시/암호화 알고리즘이나 전송 계층을 건드리지 않는다. 새로 도입된 안전하지 않은 암호화
  방식은 없다.
- **에러 처리**: 마스킹 관문 자체가 "에러 메시지에 자격증명이 노출되는" 클래스를 닫는 작업이고,
  새로 추가된 예외 처리(`NotFoundException`/`ForbiddenException` 등)는 코드/메시지만 담아
  스택트레이스나 내부 경로를 노출하지 않는다.
- **의존성**: 이번 diff 는 신규 외부 패키지를 추가하지 않는다.

## 요약

3라운드에 걸쳐 이미 깊게 검토된 changeset(WS emit 값-패턴 마스킹 wire+fanout, 내부 REST
`outputData` 마스킹 6표면, `inputData` 마스킹 CRITICAL 철회, 마커-멱등성 보장)을 소스 파일
(`sanitize-error-message.ts`·`redact-stored-error.ts`·`websocket.service.ts`·
`executions.service.ts`·`background-runs.service.ts`)에서 직접 열어 독립 재검증했다. 이번
라운드의 유일한 신규 델타(마지막 커밋)는 spec/plan 문서·주석 정정뿐이라 공격 표면에 변화가
없다. SQL/커맨드/경로 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 프로토타입
오염, ReDoS 관점에서 신규 결함은 발견되지 않았다. 남은 항목(`llmCalls` preserveKeys 의 깊이 무관
매칭, `kb:`/`background:run:` 채널 미마스킹, `inputData` 마스킹 제외, bare `token=` 패턴 부재)은
모두 선행 라운드가 이미 평가·문서화·트래커 등재를 마친 알려진 트레이드오프이며, 이번 재검증에서도
익스플로잇 가능한 새 경로는 확인되지 않았다.

## 위험도

LOW
