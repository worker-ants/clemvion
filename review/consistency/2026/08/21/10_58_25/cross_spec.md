# Cross-Spec 일관성 검토 — masked-marker-shared-package.md

## 검토 방법

target plan(`plan/in-progress/masked-marker-shared-package.md`)이 `spec_impact` 로 지목한
`spec/5-system/14-external-interaction-api.md` 를 전문 열람하고, 마스킹 마커 관련 서술이 등장하는
모든 spec 문서(`sanitize-error-message`/`masked-markers.ts`/`MASKED_MARKERS`/`R17`/
`MAX_SANITIZE_DEPTH` grep, 8개 spec 파일에서 교차 인용 확인)와, target 이 인용한 실제 코드
(`sanitize-error-message.ts` · `masked-markers.ts` · `websocket.service.ts` · `sanitize-response-headers.util.ts`
· `workflow-assistant/tools/redact.ts` · `masked-reject-callers-guard.ts` · `codebase/packages/*/package.json`)를
대조했다.

## 발견사항

- **[WARNING]** "미러 소멸 캐너리" 스코프 미정의가 spec 이 이미 잠근 "독립 유지" 결정과 충돌할 수 있다
  - target 위치: `## 작업` 체크리스트 — `- [ ] 미러 소멸 캐너리 — 패키지 밖에 마커 리터럴이 재등장하면 RED`
  - 충돌 대상:
    - `spec/5-system/14-external-interaction-api.md` "**잔여 ③** (범위 밖 유지)" 절 (workflow-assistant `maskSensitiveFields`/`redact.ts` — "값-패턴 마스킹을 **단순 합성하면 안 된다**" 로 명시적으로 통합을 금지)
    - `spec/5-system/12-webhook.md` §5.3 (민감 헤더 마스킹, `sanitize-response-headers.util.ts` 가 별도 SoT)
    - 선례 가드 `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (AST 기반 + 명시적 `ALLOWED_DIRECT_CALLERS` 화이트리스트 — webhook/schedule 카브아웃을 이미 다른 이유로 등록)
  - 상세: 리터럴 `'[REDACTED]'` 는 이관 대상인 `KEY_MASK_MARKER`(`sanitize-error-message.ts`) 외에도 코드베이스에 **독립적으로 하드코딩된 동일 문자열이 최소 3곳** 있다 — `sanitize-response-headers.util.ts:25` (`const REDACTED = '[REDACTED]'`, spec 12-webhook §5.3 이 SoT), `workflow-assistant/tools/redact.ts:11` (동일 상수, spec 14-external-interaction-api.md 잔여③이 "AI Assistant spec 이 SoT, 값-패턴 마스킹과 합성 금지"로 명시), `http-request.handler.ts:84` (URL redaction, 무관 메커니즘). 이들은 spec 이 각각 **"다른 불변식"** 이라고 이미 결정한 독립 메커니즘이며, target 문서 자체도 §"`MAX_SANITIZE_DEPTH`는 건드리지 않는다"에서 같은 원칙("공유 프리미티브를 넓히면 무관한 경로가 오염된다")을 세 번째로 반복하고 있다 — 그런데 그 원칙을 `MAX_SANITIZE_DEPTH` 상수에는 명시 적용하면서, **캐너리가 스캔할 "마커 리터럴"의 정의**(exported 심볼 재선언만 볼지, 문자열 값 자체를 grep 할지)는 적어두지 않았다. 문자열 값 기준으로 구현되면 위 세 파일에서 즉시 오탐 RED 가 나거나, 반대로 개발자가 그것을 "고쳐야 할 미러"로 오인해 spec 이 이미 잠근 잔여③ 분리 결정을 되돌릴 위험이 있다.
  - 제안: target 문서에 캐너리 스코프를 명시한다 — "패키지가 export 하는 심볼(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`)의 **재선언**(예: `const KEY_MASK_MARKER = ...` 형태의 새 로컬 정의)만 감지하고, 이미 spec 이 독립을 명시한 `sanitize-response-headers.util.ts`·`workflow-assistant/tools/redact.ts`·`http-request.handler.ts` 는 대상에서 제외한다"는 식으로 화이트리스트를 이 plan 문서 또는 캐너리 구현 자체에 남긴다. 이 저장소의 선례 가드(`masked-reject-callers-guard.ts`)가 이미 AST + 명시적 allowlist 패턴을 쓰고 있으므로 그 패턴을 재사용하면 자연스럽게 스코프가 좁혀진다.

## 확인했지만 문제 없음 (근거 남김)

- **spec R17 정정 대상 텍스트**: `14-external-interaction-api.md:1624` "마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다" — 실측 확인, target 이 인용한 위치·문구가 정확하다. 이 문장이 §R17 을 인용하는 다른 7개 spec 파일(2-api-convention·11-mcp-client·12-webhook·13-replay-rerun·15-chat-channel·3-error-handling·6-websocket-protocol·7-channel-web-chat/3-auth-session)로는 전파되지 않았다 — 그 문서들은 모두 "§R17" 을 근거 인용으로만 참조하고 SoT 서술 자체를 반복하지 않으므로, target 이 계획한 **단일 지점 정정으로 충분**하다.
- **요구사항 ID 충돌 없음**: `R17` 은 8개 spec 파일에서 전부 동일한 `14-external-interaction-api.md#R17` 절을 가리키는 교차 참조이고, 다른 의미로 재사용된 곳이 없다.
- **깊이 상수 실측 일치**: target 의 표(`deepRedactSecrets: depth>=10`, `frontend scanner: 0..10`, `sanitizePayloadForWs: depth>10→깊이 11`)가 실제 코드(`MAX_REDACT_DEPTH=10`·`MAX_MARKER_SCAN_DEPTH=10`·`MAX_SANITIZE_DEPTH=10`+`depth > MAX_SANITIZE_DEPTH`)와 정확히 일치한다. `websocket.service.ts` 는 이미 `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 를 `sanitize-error-message.ts` 에서 import 하고 `MAX_SANITIZE_DEPTH` 만 로컬로 유지하고 있어, target 의 "깊이 상수만 분리 유지" 결정이 기존 코드 구조와 일치한다.
- **패키지명 충돌 없음**: `@workflow/masked-markers` 는 기존 7개 `codebase/packages/*` (`ai-end-reason`·`chat-channel-validation`·`expression-engine`·`graph-warning-rules`·`node-summary`·`sdk`·`web-chat`) 어느 것과도 겹치지 않고 `@workflow/*` 스코프 규약을 따른다.
- **선례 인용 정확성**: `@workflow/ai-end-reason` package.json 의 description 인용 문구가 실제 파일과 정확히 일치한다(날조 아님).
- **`git log -S "MASKED_MARKERS"` 재확인**: 추출이 과거에 제안·기각된 이력은 없다 — 전부 마스킹 *버그 수정* 커밋이고 "추출 vs 계약테스트" 결정 자체를 다룬 커밋은 없다. target 의 "기각 이력 없음" 주장과 부합한다.
- **layer 규약 비충돌**: `spec/conventions/frontend-layering.md` 는 `codebase/frontend/src/**` 내부 디렉터리 간 의존만 규율하고 workspace 패키지(`codebase/packages/**`) import 는 규율 대상 밖이라, 패키지 추출이 이 규약과 부딪히지 않는다.
- **channel-web-chat 미영향**: `codebase/channel-web-chat/src` 어디에도 마스킹 마커 관련 코드가 없어 target 의 "등록 표면 8곳"(backend/frontend 한정)이 정확하다 — 세 번째 런타임을 누락한 게 아니다.
- **RBAC·상태 전이·데이터 모델**: target 은 인가 규칙·엔티티 상태 머신·DB 필드를 정의하지 않는 순수 리팩터라 해당 관점의 충돌 표면 자체가 없다.

## 요약

target plan 은 `sanitize-error-message.ts`/`masked-markers.ts` 관련 spec 서술(R17, 라인 1624)·깊이 상수 실측·다른 7개 spec 의 §R17 교차 참조를 정확히 확인한 뒤 정정 범위를 옳게 좁혔고, 요구사항 ID·API 계약·RBAC·상태 전이·데이터 모델 차원에서는 기존 spec 과 충돌하지 않는다. 다만 "미러 소멸 캐너리" 작업 항목이 스캔 대상(심볼 vs 리터럴 문자열)을 명시하지 않아, 구현 단계에서 spec 이 이미 독립 메커니즘으로 확정한 두 곳(`14-external-interaction-api.md` 잔여③의 workflow-assistant redact, `12-webhook.md §5.3` 의 헤더 마스킹)과 충돌할 위험이 있다 — CRITICAL 은 아니지만 착수 전 스코프를 문서에 명시할 필요가 있다.

## 위험도

LOW
