# 정식 규약 준수 검토 — spec-integration-error-code-doc-fix

대상: `plan/in-progress/spec-integration-error-code-doc-fix.md` (검토 모드: --spec, 4곳 spec doc-only 수정 계획)

## 발견사항

- **[WARNING]** 변경 4 (`3-send-email.md` line 221) — `pending_install` 추가가 send_email 노드에는 구조적으로 도달 불가능한 원인
  - target 위치: 플랜 "## 변경" 항목 4 — `spec/4-nodes/4-integration/3-send-email.md` (line 221) `connected 가 아님 (expired / error)` → `(expired / error / pending_install)`
  - 위반 규약: `spec/conventions/error-codes.md` Overview — "코드가 SoT — spec 을 코드에 맞춘 정정"(본 플랜 자체의 존재 근거), 및 §1 "코드의 *정의(spec 본문)*가 진실"
  - 상세: `pending_install` 상태는 `IntegrationOAuthService` 의 cafe24-private / makeshop ShopStore install 흐름에서만 설정된다(`integration-oauth.service.ts` 의 `status: 'pending_install'` 대입 지점 전부가 `serviceType: 'cafe24'` 또는 `'makeshop'` 분기). 일반 생성 경로(`integrations.service.ts:642` `create()`)는 이메일(SMTP) 포함 모든 비-OAuth-install 서비스에 대해 `status: 'connected'` 를 즉시 대입하며, `service_type='email'` 의 Integration 이 `pending_install` 이 되는 코드 경로는 존재하지 않는다. 설사 send_email 노드 config 가 cafe24/makeshop pending_install 통합 id 를 가리키더라도 `IntegrationHandlerBase.resolveIntegration()` 은 `serviceType` 불일치 검사를 **status 검사보다 먼저** 수행하므로(`integration-handler-base.ts:65-73`) `INTEGRATION_TYPE_MISMATCH` 로 먼저 실패하고 `pending_install → INTEGRATION_NOT_CONNECTED` 분기에 절대 도달하지 않는다. 같은 표의 인접 행(`INTEGRATION_TYPE_MISMATCH`: "serviceType 이 'email' 이 아님", `INTEGRATION_INCOMPLETE`: SMTP 전용 필드 나열)은 이미 email-노드 한정으로 정밀 서술되어 있어, 이 표는 "공통 목록의 복사"가 아니라 "이 노드에서 실제 도달 가능한 원인"을 서술하는 것이 기존 관례다. `pending_install` 추가는 이 관례를 깨고 도달 불가능한 원인을 등재해, 본 플랜이 고치려는 것과 같은 종류의 spec-코드 불일치를 새로 만든다.
  - 제안: 이 4번째 변경은 `3-send-email.md` 에서 제외하거나(email 노드는 여전히 `expired`/`error` 만), 추가하더라도 "이론상 §4.2 공통 정의에는 포함되나 email 서비스에서는 도달 불가"라는 caveat를 명시. 반면 변경 2(`2-navigation/4-integration.md` §14.1 vocabulary 표)와 변경 3(`0-common.md` §4.2 공통 에러 코드 표)은 여러 서비스에 걸친 **공통/제네릭** 표이므로 `pending_install` 추가가 정확하다 — 이 둘과 변경 4를 동일하게 취급하지 말 것.

- **[WARNING]** 변경 1 (`2-navigation/4-integration.md` line 726) — "노드·AI Agent" 에 단일 에러코드를 동시 귀속시키는 기존 서술을 그대로 답습
  - target 위치: 플랜 "## 변경" 항목 1 — `spec/2-navigation/4-integration.md` §6 line 726
  - 위반 규약: `spec/conventions/error-codes.md` §1 "클라이언트 계약 — 코드의 *정의*(spec 본문)가 진실"
  - 상세: 플랜은 문구를 "이 상태의 Integration 은 노드·AI Agent 에서 사용할 수 없다 (`INTEGRATION_NOT_CONNECTED` — §4.2)"로 유지하며 코드 값만 교체한다. 그러나 같은 문서 §4.6(line 380, 플랜의 Rationale 이 "이미 정확했다"고 직접 인용하는 바로 그 문장)은 두 경로를 구분한다 — **노드**는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패하지만, **AI Agent**는 "MCP bridge 가 미연결 통합의 tool 을 노출하지 않아 호출 자체가 없다"(에러코드 자체가 발행되지 않음). 코드로도 확인됨: `Cafe24McpToolProvider.buildTools()` 는 `IntegrationHandlerBase.resolveIntegration()` 을 호출하지 않고 `getForExecution` 을 직접 호출한 뒤 `pending_install`/`expired`/`error` 상태를 `IntegrationError` throw 없이 `status:'skipped'` 진단 항목으로 조용히 건너뛴다(`cafe24-mcp-tool-provider.ts:167-193`). 즉 AI Agent 경로에는 `INTEGRATION_NOT_CONNECTED` 라는 코드 값이 애초에 등장하지 않는다. 플랜이 §4.6 을 "이미 정확한 근거"로 인용하면서도 §6 교정문에는 그 정밀한 구분을 반영하지 않아, 수정 후에도 "AI Agent 가 INTEGRATION_NOT_CONNECTED 를 낸다"는 오독 소지가 남는다.
  - 제안: §6 문구를 §4.6 의 구분과 일치시킨다 — 예: "…노드·AI Agent 에서 사용할 수 없다 (노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패, AI Agent 는 MCP bridge 가 tool 을 노출하지 않아 호출 자체가 없음 — §4.6 참조)". 최소한 §4.6 을 cross-link.

- **[WARNING]** 변경 1 의 "§4.2" bare 참조가 같은 문서 내 §4.2(로컬 "Overview 탭") 와 혼동될 수 있는 기존 모호성을 정정하지 않음
  - target 위치: 플랜 "## 변경" 항목 1 — `(INTEGRATION_NOT_CONNECTED — §4.2)` 부분
  - 위반 규약: 명시적 정식 규약 문서는 없으나, 같은 파일(`2-navigation/4-integration.md`) 안의 기존 관례(line 1082: `[공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드)`)와 일관성 이탈 — CLAUDE.md "문서 구조 규약"의 cross-reference 명확성 취지
  - 상세: `2-navigation/4-integration.md` 안에서 "§4.2" 라는 bare 표기는 그 문서 자신의 §4.2("4.2 Overview 탭", UI 섹션)를 가리키는 용례로만 쓰인다(line 74, 795, 798, 1202, 1296, 1479 등 전부 로컬 §4.2). line 726 의 "(… — §4.2)" 만 유일하게 실제로는 **다른 파일**(`0-common.md` §4.2 "공통 에러 코드")을 의도한 것으로 보이며, 그 의도된 대상은 문맥(에러 코드 서술)으로 짐작할 수 있을 뿐 명시적 링크가 없다. 같은 문서가 line 1082 에서 동일 대상을 가리킬 때는 `[공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드)` 로 명확히 링크한다 — line 726 은 이 관례를 따르지 않는 유일한 예외다. 본 플랜은 바로 이 문장을 편집하면서도 이 모호성을 그대로 남긴다.
  - 제안: line 726 의 "§4.2" 를 line 1082 와 동일한 명시적 cross-file 링크(`[공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드)`)로 교체.

- **[INFO]** 변경 3·4 의 plan 서술에서 개별 상태값 backtick 래핑 생략
  - target 위치: 플랜 "## 변경" 항목 3, 4
  - 위반 규약: 없음(문서 서식 일관성 참고 사항)
  - 상세: 실제 대상 파일은 상태값을 개별적으로 backtick 처리한다 — `0-common.md:83` `` `expired`, `error` ``, `3-send-email.md:221` `` `expired` / `error` ``. 플랜의 before/after 인용은 이 backtick 을 생략한 축약 표기라 실제 diff 작성 시 신규 토큰 `pending_install` 도 동일하게 backtick 래핑해야 형식이 유지된다(위 WARNING 이 해소된다는 전제하에 3번 항목에 한함).

## 요약

플랜이 명시하는 4개 변경 중 정식 규약(특히 `spec/conventions/error-codes.md` 의 "코드가 SoT, spec 이 그 의미를 정확히 서술" 원칙) 관점에서 절반은 견고하다 — §14.1 노드 실행 엔진 vocabulary 표(변경 2)와 `0-common.md` §4.2 공통 에러 코드 표(변경 3)는 여러 서비스에 공통인 제네릭 서술이라 `pending_install` 추가가 정확하며, 코드(`IntegrationHandlerBase.resolveIntegration`, `integrations.service.ts` testConnection 가드)로 직접 검증됐다. 반면 send_email 노드 전용 표(변경 4)에 동일하게 `pending_install` 을 추가하는 것은 부정확하다 — 이 상태는 email(SMTP) 서비스 타입에는 코드상 도달 불가능하며, 설령 잘못된 참조가 있어도 `resolveIntegration` 의 타입 체크가 상태 체크보다 우선해 다른 코드로 먼저 실패한다. 아울러 변경 1(§6 pending_install 서술)은 코드 값 교정 자체는 맞지만 같은 문서 §4.6 이 이미 정확히 구분해 둔 "노드=즉시 실패 / AI Agent=호출 자체 없음"이라는 구조를 반영하지 않아, 플랜이 스스로 인용한 근거만큼 정밀하지 않다. 명명 규약(UPPER_SNAKE_CASE, 도메인 prefix)·rename 안정성 정책·plan frontmatter(Gate C 리스트 형식 포함)·spec frontmatter(`id`/`status`/`code`) 등 다른 정식 규약 축은 위반 없음.

## 위험도

MEDIUM
