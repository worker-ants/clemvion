# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 일시**: 2026-05-25

---

## 발견사항

### **[WARNING]** 내부 단면 참조 번호 불일치 — CCH-CV-04, CCH-SE-01

- **target 위치**: `spec/5-system/15-chat-channel.md` 라인 70 (CCH-CV-04), 라인 88 (CCH-SE-01)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` 의 단일 진실 원칙 및 문서 내 자기-참조 정합성 요구
- **상세**:
  - CCH-CV-04 (라인 70): `§3.4.3 의 Redis ChannelConversation 레코드` 로 참조하고 있으나, 해당 섹션의 실제 번호는 `### 4.3 ChannelConversation (in-memory + Redis cache)` (라인 272). `§3.4.3` 은 문서에 존재하지 않는 번호다.
  - CCH-SE-01 (라인 88): `[§3.4.2](#342-trigger-테이블-신규-컬럼)` 앵커를 사용하고 있으나, 실제 섹션 헤딩은 `### 4.2 Trigger 테이블 신규 컬럼` (라인 255). 이 헤딩이 생성하는 Markdown 앵커는 `#42-trigger-테이블-신규-컬럼` 이지 `#342-trigger-테이블-신규-컬럼` 이 아니다. 앵커가 구 섹션 번호(`§3.4.2`)에서 비롯된 stale 값으로 남아 있어 링크가 실제로 깨진다.
- **제안**:
  - CCH-CV-04: `§3.4.3` → `§4.3` 으로 수정
  - CCH-SE-01: `[§3.4.2](#342-trigger-테이블-신규-컬럼)` → `[§4.2](#42-trigger-테이블-신규-컬럼)` 으로 수정 (텍스트·앵커 동시 수정)

---

### **[WARNING]** 주요 본문 섹션 번호 시작점 불일치 — 섹션 ## 1., ## 2. 결락

- **target 위치**: `spec/5-system/15-chat-channel.md` 라인 118 (`## 3. 처리 흐름` 이 첫 번호 붙은 본문 섹션)
- **위반 규약**: CLAUDE.md §"문서 구조 규약" — Overview / 본문 / Rationale 3섹션. 본문 섹션 번호는 `## 1.` 에서 시작하는 것이 같은 영역 내 다른 spec 문서(예: `spec/5-system/12-webhook.md`) 의 확립된 패턴
- **상세**: `## Overview (제품 정의)` 다음 첫 번호 붙은 본문 섹션이 `## 3. 처리 흐름` 으로 `## 1.`, `## 2.` 가 없다. Overview 내부 소제목 (`### 1. 개요`, `### 2. 사용 시나리오`, `### 3. 요구사항`) 의 번호가 본문 섹션 번호와 겹쳐 보여 `§3` 이 어느 계층을 가리키는지 독자가 혼동할 수 있다. `spec/5-system/14-external-interaction-api.md` 도 같은 패턴이지만 이는 두 문서 모두 같은 결함을 공유한다는 의미이지 규약 준수를 담보하지 않는다. 인접한 `12-webhook.md` 는 `## 1.` 부터 시작하여 번호 오버랩이 없다.
- **제안**: Overview 내 요구사항 소제목을 본문 섹션으로 독립시켜 `## 1. 개요·사용 시나리오`, `## 2. 요구사항 (CCH-* prefix)` 등을 만들거나, Overview 내 번호를 제거하고 본문 번호를 `## 1.` 부터 시작하도록 재배치한다. 14-external-interaction-api.md 와의 패턴 통일이 필요하다면 해당 문서도 함께 조정 필요. 단독으로 본 문서만 수정해도 자기-일관성은 개선된다.

---

### **[INFO]** secret URI 표기에 셸 brace expansion 사용 — CCH-SE-03

- **target 위치**: `spec/5-system/15-chat-channel.md` 라인 90 (CCH-SE-03 요구사항 셀)
- **위반 규약**: `spec/conventions/secret-store.md §1 URI Scheme` — `secret://<scope>/<resourceId>/<name>` 단일 경로 형식
- **상세**: CCH-SE-03 의 인라인 예시로 `` `secret://triggers/{triggerId}/{bot-token,inbound-signing}` `` 를 사용하고 있는데, `{bot-token,inbound-signing}` 는 셸 brace expansion 표기이며 유효한 URI 형식이 아니다. 실제 URI 는 두 개의 별도 경로(`secret://triggers/{triggerId}/bot-token` 과 `secret://triggers/{triggerId}/inbound-signing`)이며, 이는 동일 문서 라인 204–205 의 JSONC 블록에서 올바르게 명시하고 있다. CCH-SE-03 의 brace expansion 표기는 규약 §1 에서 정의한 scheme 과 형식상 맞지 않아 독자가 혼동할 수 있다.
- **제안**: CCH-SE-03 의 예시를 `` `secret://triggers/{triggerId}/bot-token` · `` `secret://triggers/{triggerId}/inbound-signing` `` (두 URI 병기) 또는 plain 산문으로 교체한다.

---

### **[INFO]** Swagger §1-5 writeOnly / readOnly 의무 cross-reference 누락

- **target 위치**: `spec/5-system/15-chat-channel.md` §4.1 (라인 198–234), §5.4.2 (라인 382–391)
- **위반 규약**: `spec/conventions/swagger.md §1-5` — "의무: secret store 입력 plaintext (`botToken`, `inboundSigningPlaintext`) 필드는 항상 `writeOnly: true` 동반. 서버 derived field (`hasBotToken` 등) 는 응답 DTO 한정으로 `readOnly: true` 동반"
- **상세**: 본 spec 은 `botToken` 과 `inboundSigningPlaintext` 를 "입력 전용" 으로, `hasBotToken` 을 derived 응답 필드로 정확히 정의하고 있다. 그러나 실제 DTO 구현 시 반드시 지켜야 하는 `swagger.md §1-5` 의 `writeOnly: true` / `readOnly: true` 어노테이션 의무를 spec 본문이 명시적으로 인용하지 않는다. 구현자가 해당 의무를 놓칠 경우 Swagger UI 에서 secret plaintext 가 response schema 에 노출될 수 있다. 동일 패턴의 다른 필드(`botToken` 은 swagger.md §1-5 의 `example` 필드로도 명시됨)와 비교할 때 명시도가 낮다.
- **제안**: §4.1 의 JSONC 블록 직후 또는 §5.4.2 끝에 "구현 의무: `botToken` / `inboundSigningPlaintext` DTO 필드에 `@ApiProperty({ writeOnly: true })`; `hasBotToken` 응답 DTO 필드에 `@ApiProperty({ readOnly: true })` — [Convention swagger.md §1-5](../conventions/swagger.md#1-5-writeonly--readonly--보안-민감--응답-sanitize-필드-2026-05-24) 참조" 한 줄을 추가한다. 규약 자체를 갱신할 필요는 없으며 spec-to-convention cross-link 추가가 충분하다.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 frontmatter (`id`, `status: partial`, `code:`, `pending_plans:`) 를 `spec-impl-evidence.md` 규약에 정확히 따르고 있으며 모든 `pending_plans` 경로가 `plan/in-progress/` 에 실존한다. 문서 구조도 Overview / 본문 / Rationale 3섹션 기본 틀을 갖추고 있고, Rationale ID (`R-CC-N` prefix) 컨벤션도 2026-05-23 선언 이후 신규 항목은 일관되게 지켜지고 있다. 다만 본문 섹션 번호가 `## 1.`이 아닌 `## 3.`에서 시작해 Overview 내부 소제목과 번호 공간이 겹치고(WARNING), CCH-CV-04 및 CCH-SE-01 의 내부 앵커 참조가 구 섹션 번호(`§3.4.2`, `§3.4.3`)를 가리켜 현재 문서 구조와 불일치하는(WARNING) 두 가지 문제가 구현 착수 전 해소되어야 한다. 특히 CCH-SE-01 의 `#342-trigger-테이블-신규-컬럼` 앵커는 실제로 broken link 다. 추가로 secret URI 표기 형식 불일치(INFO)와 Swagger writeOnly/readOnly 의무 cross-reference 누락(INFO) 이 있으나 구현 차단 수준은 아니다.

---

## 위험도

**MEDIUM**

> CCH-SE-01 의 broken anchor link(#342-trigger-테이블-신규-컬럼)는 구현 착수 시 개발자가 잘못된 섹션을 참고할 수 있는 직접적인 정보 오류다. 나머지 발견사항은 형식·표기 개선 수준이다.
