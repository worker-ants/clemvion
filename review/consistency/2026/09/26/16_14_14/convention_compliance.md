# 정식 규약 준수 검토 — `spec/3-workflow-editor/4-ai-assistant.md`

검토 모드: `--impl-prep` (scope: `spec/3-workflow-editor/4-ai-assistant.md` 번들 — `5-system/2-api-convention.md` · `conventions/swagger.md`(예산 초과로 본문 생략) · `spec/conventions/**` 포함)

## 발견사항

### [WARNING] `status: implemented` 인데 본문에 명시적 미구현 항목이 3건 — `spec-impl-evidence.md` §3 라이프사이클 위반

- target 위치: frontmatter (`status: implemented`, `pending_plans:` 없음) vs 본문 §7 "(계획) 미구현 에러코드"(`ASSISTANT_LLM_CONFIG_INVALID`·`ASSISTANT_STREAMING_UNSUPPORTED`), §10 "동시 활성 세션 … **(계획)** 워크플로우당 활성 스트리밍 1건 제한 … 아직 미구현", §12.2 "**(계획)** … `ASSISTANT_WORKFLOW_RUNNING` 에러로 거부하는 가드는 아직 미구현"
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `status` 라이프사이클 — `implemented` = "모든 약속 구현 완료", `pending_plans` 없음. `partial` = "일부 구현됨", `pending_plans` **의무**(≥1 항목)
- 상세: 본 spec 은 스스로 최소 3개 표면을 "정의했으나 코드에 없음"이라고 명시하면서도 frontmatter 는 `status: implemented` + `pending_plans:` 미기재를 유지한다. 라이프사이클 표의 값 정의를 문자 그대로 적용하면 이 문서는 `partial` 이어야 하고 `pending_plans:` 로 그 갭을 추적할 plan 을 걸어야 한다. 기존 build-time 가드 4종(`spec-frontmatter.test.ts` 등)은 "`partial` 인데 `pending_plans` 없음"만 잡지, "`implemented` 인데 본문이 미구현을 자백"하는 역방향은 검출하지 않는다 — 즉 이 drift 는 어떤 자동 가드에도 걸리지 않는 채로 남는다. 이 컨벤션 문서 자체가 이런 *spec 약속 vs 구현 부재* 갭(텔레그램 chat-channel UI 영구 누락 사례)을 막기 위해 만들어졌다는 점에서, 정확히 그 취지에 반하는 사례다.
- 제안: `status: partial` 로 낮추고 `pending_plans:` 에 위 3개 갭을 추적하는 plan 경로를 등재하거나, 이미 구현이 끝났다면 "(계획)" 문구를 제거하고 실제 코드를 반영해 본문을 갱신한다. 이번 작업(`assistant-e2e-contract-gaps`, `spec_impact: none`)의 스코프는 아니므로 별도 후속으로 반영 권장.

### [WARNING] Workflow Assistant 도메인 에러 코드가 중앙 에러 카탈로그에 미등재

- target 위치: §7 "에러 처리" 표 (`ASSISTANT_NO_LLM_CONFIG`·`ASSISTANT_TOO_MANY_TOOL_CALLS`·`ASSISTANT_STREAM_FAILED`·`LLM_RATE_LIMIT`·`LLM_TIMEOUT`·`ASSISTANT_TOOL_FAILED`·`ASSISTANT_SESSION_NOT_FOUND`·`ASSISTANT_SESSION_NOT_YOURS` 등)
- 위반 규약: `spec/5-system/2-api-convention.md` §5.3 "어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다" · `spec/5-system/3-error-handling.md` Overview("에러 코드 분류 체계 … §1")
- 상세: `3-error-handling.md` §1 은 도메인별 에러 코드를 "공용 카탈로그 가시성"을 위해 하위 절(§1.5 WS commands, §1.6 EIA REST, §1.7 Webhook, §1.8 KB/Graph RAG, §1.9 워크스페이스 멤버 추가, §1.10 트리거 endpointPath, §1.11 트리거 AuthConfig, §1.12 Chat Channel bot token)로 전부 등재해 두었는데, 같은 패턴의 도메인 모듈인 Workflow AI Assistant 만 `grep -n "Assistant" 3-error-handling.md` 결과 0건으로 등재 항목이 없다. 명명(`UPPER_SNAKE_CASE`, `ASSISTANT_` prefix)은 `error-codes.md` 규약을 잘 따르고 있으나 카탈로그 등재라는 별도 요구사항이 빠져 있다.
- 제안: `3-error-handling.md` §1 에 "§1.13 Workflow Assistant 에러 코드 (도메인 spec 참조)" 절을 추가해 이 8개 코드를 등재하고 본 spec §7 로 cross-reference 한다 (다른 도메인 절과 동일 패턴).

### [WARNING] SSE `event: error` 페이로드가 REST 에러 봉투 규약과 형태가 다른데 그 예외를 명시하지 않음

- target 위치: §5.3 예시 `event: error\ndata: {"code": "LLM_RATE_LIMIT", "message": "..."}`
- 위반 규약: `spec/5-system/2-api-convention.md` §5.3 표준 에러 봉투 `{ error: { code, message, requestId, details? } }` (특히 `requestId`: "모든 에러 응답에 항상 포함되는 추적용 UUID")
- 상세: 이 페이로드는 `error: {...}` 로 감싸지 않고 `requestId` 도 없는 flat `{code, message}` 형태다. `spec/5-system/14-external-interaction-api.md` §5.2 는 동일한 SSE 상황에서 "SSE 스트림 프레임은 인터셉터를 거치지 않아 봉투가 없다"는 예외를 **명시적으로** 적어 두는데, 본 spec 은 같은 예외를 취하면서도 그 근거를 적지 않는다. 규약 위반이라기보다 "문서 구조" 상 완결성 갭 — 다음 사람이 REST 봉투 규칙이 그대로 적용된다고 오인하거나, 반대로 이 사례를 근거로 SSE 예외를 임의 확장할 위험이 있다.
- 제안: EIA §5.2 처럼 "SSE 프레임은 `TransformInterceptor`/`GlobalExceptionFilter` 를 거치지 않아 REST 에러 봉투(§5.3)를 따르지 않는다"는 한 문장을 §5.3 또는 §7 에 추가.

### [WARNING] 도구 호출 배지 영문 하드코딩이 i18n Principle 1 을 우회하며 스코프 예외로 등재되지 않음

- target 위치: §13 상단 "배지 라벨 관례" 각주 — "도구 호출 배지(§3.2)는 현재 영문 고정 문자열을 사용한다(`tool-call-badge.tsx`의 `summarize()`). … `useTranslation` 연결이 필요하나 MVP 스코프 밖이다"
- 위반 규약: `spec/conventions/i18n-userguide.md` Principle 1 — "프론트엔드 컴포넌트 안의 사용자 가시 문자열은 **반드시** dict 키를 통해 `translate()`/`t()` 호출로 노출". 같은 문서 서두는 "`convention-compliance-checker` 가 본 문서를 자동 inheritance 하여 spec 작성·구현 착수 직전 위반을 검출한다"고 명시해 본 검토 항목에 직접 해당됨을 밝히고 있다
- 상세: Principle 1 의 금지 예시는 한국어 리터럴 위주이지만 원칙 문장 자체("사용자 가시 문자열은 반드시 dict 키 경유")는 언어를 한정하지 않고, "영문 fallback … 문자열도 동일하게 dict 경유를 우선한다"고 명시한다. 배지 라벨은 dict 를 전혀 거치지 않는 순수 하드코딩이다. `codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 가드는 이름 그대로 **한국어** 하드코딩만 잡으므로 이 영문 하드코딩은 어떤 자동 가드에도 걸리지 않는다. §적용 범위(Scope) 절에는 웹챗 위젯 chrome 같은 명시적 예외 항목은 있어도 workflow-assistant 배지에 대한 예외는 등재돼 있지 않다.
- 제안: (a) i18n-userguide.md §적용 범위에 "tool-call 배지 라벨(영문 고정, MVP)" 를 명시적 예외로 등재하거나, (b) `assistant.explore*`/`assistant.opAdded` 류 키를 실제로 배지 렌더에 연결해 갭을 닫는 후속 plan 을 `pending_plans:` 로 건다. 현재처럼 spec 각주에만 적어 두면 규약 문서와 실제 예외 목록이 어긋난 상태로 남는다.

### [INFO] `/api/workflow-assistant/sessions` 형태가 api-convention.md §2.2 명명 표에 없는 카테고리

- target 위치: §6 REST API 표, §5.1 엔드포인트
- 위반 규약: 없음 (참고 사항) — `spec/5-system/2-api-convention.md` §2.2
- 상세: `{feature-namespace}/{resource}` 2단계 최상위 경로는 `dashboard`·`marketplace`·`statistics`·`notifications` 등 이 저장소 전반에 이미 널리 쓰이는 패턴이라 위반은 아니지만, §2.2 명명 표는 이 카테고리를 별도 행으로 정의하지 않아 매번 개별 판단에 의존한다.
- 제안: §2.2 에 "feature-namespace + resource" 행을 정식으로 추가하면 향후 유사 검토에서 판단 비용이 준다 (규약 갱신 성격의 제안).

## 요약

`spec/3-workflow-editor/4-ai-assistant.md` 는 명명 규약(`UPPER_SNAKE_CASE` 에러 코드, kebab-case URL, camelCase/snake_case 도구 인자 구분을 명시적으로 문서화)과 §5.4 null/키-생략 표현, PATCH tri-state 예외 등 최근 정식화된 API 규약을 대체로 정확히 따르고 있으며, `UpdateAssistantSessionDto.llmConfigId` 는 api-convention.md 자체가 인용하는 모범 선례이기도 하다. 다만 (1) frontmatter `status: implemented` 가 본문이 스스로 인정하는 3개 미구현 항목과 모순되어 `spec-impl-evidence.md` 라이프사이클 규약을 벗어나 있고, (2) Assistant 도메인 에러 코드 8종이 중앙 에러 카탈로그(`3-error-handling.md §1`)에 등재되지 않았으며, (3) SSE 에러 이벤트가 REST 에러 봉투와 다른데 그 예외 근거를 적지 않고, (4) 도구 호출 배지의 영문 하드코딩이 i18n Principle 1 을 우회하면서 정식 예외로 등재되지 않았다. 네 항목 모두 기존 자동 가드의 사각지대에 있어 (Korean-only ratchet, partial-only 가드 등) 사람이 짚지 않으면 조용히 굳어질 성격의 drift 다. CRITICAL 급 wire-breaking 위반은 발견되지 않았다.

## 위험도

MEDIUM
