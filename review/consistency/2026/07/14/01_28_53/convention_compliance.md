# 정식 규약 준수 검토 — spec/5-system/4-execution-engine.md

## 방법론 노트

payload 의 "정식 규약 모음" 섹션은 `audit-actions.md` 전문 + `cafe24-api-catalog/_overview.md` + `cafe24-api-catalog/application.md` + `cafe24-api-catalog/application/apps.md`(중간 truncate) 만 포함하고 있었다. 이는 본 target(`execution-engine.md`)·diff(execution-engine / interaction / hooks / chat-channel i18n)와 **직접 관련이 없는 규약**이며, 실제로 필요한 `spec/conventions/error-codes.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/i18n-userguide.md` 는 payload 에 전혀 포함되지 않았다 (cafe24-api-catalog 하위 222개 field-level 문서를 알파벳/재귀 순으로 먼저 인라인하다 token 예산을 소진해, 정작 필요한 문서 앞에서 잘린 것으로 추정). 이 결함이 재발하면 checker 가 실제로 필요한 규약을 못 보고 놓칠 위험이 있어 별도로 지적한다 (아래 요약 참조). 본 검토는 payload 의도된 목록 대신 `spec/conventions/` 를 직접 열람해 관련 규약(`error-codes.md`, `chat-channel-adapter.md`, `i18n-userguide.md`)을 확인하고 대조했다.

## 검토 대상 변경 요약

- **F-1** (`execution-engine.service.ts` / `interaction.service.ts`): `resolveWaitingNodeExecutionId` 에 `expectedNodeId?` optional 파라미터 추가 — 외부 EIA `/interact` 진입점만 `dto.nodeId` 를 전달, `in_process_trusted`(chat-channel)는 면제.
- **F-2** (`hooks.service.ts` / `language-hint-defaults.ts`): `STATE_MISMATCH` 삼킴 시 `languageHints.surfaceMismatch` best-effort 안내 발송 (`sendSurfaceMismatchNotice`).
- 대응 spec 갱신: `spec/5-system/4-execution-engine.md §7.5.1`(nodeId 불일치 행 + 진입점별 커버리지 표), `spec/5-system/15-chat-channel.md §4.1.1`(surfaceMismatch 키 표), `spec/4-nodes/7-trigger/providers/telegram.md §5.8`, `spec/conventions/chat-channel-adapter.md`(각주 카운트 제거).

## 발견사항

없음 — target 문서(`spec/5-system/4-execution-engine.md`) 의 이번 변경분에서 정식 규약 위반을 발견하지 못했다. 아래는 확인한 근거.

### 1. 명명 규약
- `expectedNodeId`(파라미터), `resolveSurfaceMismatchMessage`/`SURFACE_MISMATCH_DEFAULTS`(함수/상수)는 동일 파일의 기존 `resolveSessionExpiredMessage`/`SESSION_EXPIRED_DEFAULTS`, `resolveFormOpenLabel`/`FORM_OPEN_LABEL_DEFAULTS` 패턴을 그대로 따른다.
- `surfaceMismatch` languageHints 키는 기존 `formOpenLabel`/`sessionExpired` 와 동일 camelCase — `chat-channel-adapter.md` §2.3(`languageHints` lookup 규약)과 정합.
- 신규 에러 코드를 만들지 않고 기존 `InvalidExecutionStateError`(`INVALID_EXECUTION_STATE`/`STATE_MISMATCH`/`INVALID_STATE` 3-layer 매핑)를 재사용 — `spec/conventions/error-codes.md §1`("구현 세부를 이름에 박지 않는다")·§2("rename 대신 신설, 의미가 실제로 갈라질 때만") 원칙과 정확히 일치한다. `execution-engine.md §Rationale "왜 신규 코드를 만들지 않는가"` 가 이 근거를 명시적으로 기술하고 있어 규약 인지 하에 결정된 것으로 보인다.

### 2. 출력 포맷 규약
- `§7.5.1` 표에 새로 추가된 "nodeId 불일치" 행은 기존 행들과 동일 컬럼 구조(케이스/응답 코드/원인)를 유지한다.
- 진입점별 커버리지 표(신규)도 기존 표 스타일(파이프 테이블, `>` 인용 블록 안에 배치)과 일관된다.
- `INVALID_EXECUTION_STATE`→EIA `STATE_MISMATCH` 매핑은 `14-external-interaction-api.md` §5.1 (이미 사전에 "다른 nodeId" 를 STATE_MISMATCH 사유로 명시)과 대조했을 때 정합 — 코드가 이미 spec 이 약속한 사양을 뒤늦게 구현한 케이스로, spec 쪽 신규 계약이 아니다.
- `resolveWaitingNodeExecutionId` 의 실제 DB 쿼리(`execution_id + status='waiting_for_input'`, node_id 미필터)를 직접 확인했고, 이번에 수정된 "매칭 row 0건" 행 설명("...거나 nodeId 미일치" 문구 제거)이 실제 쿼리 동작과 일치한다.

### 3. 문서 구조 규약
- `spec/5-system/4-execution-engine.md` 는 frontmatter(`id`/`status`/`code`)·`## Overview`·본문·`## Rationale` 3섹션 구조를 그대로 유지한다. 이번 diff 는 본문(§7.5.1)만 갱신했고 구조를 깨지 않았다.
- 관련 자매 문서(`15-chat-channel.md`, `telegram.md`)도 동일 세션에서 함께 갱신되어 spec 간 cross-reference(`[실행 엔진 §7.5.1](4-execution-engine.md#751-...)`)가 살아있다.

### 4. API 문서 규약(swagger 등)
- 이번 diff 는 controller/DTO 데코레이터 변경이 없다(`InteractDto.nodeId` 는 기존 필드 재사용). `swagger.md` 관련 위반 없음.

### 5. i18n / 유저 가이드 규약 (`spec/conventions/i18n-userguide.md`, 참고 목적 — target 은 아니나 같은 diff 에 포함)
- `dict/ko/triggers.ts` · `dict/en/triggers.ts` 의 `languageHintsHelp` 갱신은 양쪽 로케일 동시 커밋 — Principle 2(ko/en parity) 준수.
- `telegram.mdx`(canonical) · `telegram.en.mdx`(sibling) 양쪽에 §7.4 섹션 추가 — Principle 5 준수.
- 신규 user-guide 절 본문에 `spec/` 경로·`CCH-XX-NN` 내부 anchor id·로드맵성 문구가 없음 — Principle 6-B 준수.

## 참고 (INFO, target 외부 — 부수 변경)

- **[INFO] `spec/conventions/chat-channel-adapter.md` 각주 카운트 제거**
  - 위치: `spec/conventions/chat-channel-adapter.md` (`languageHints?` 필드 JSDoc 주석, `@see` 라인)
  - 상세: `@see spec/5-system/15-chat-channel.md §4.1.1 (KO/EN default 12 문구 표)` → `(KO/EN default 문구 표)` 로 숫자만 제거. `surfaceMismatch` 추가로 카운트가 stale 해지는 걸 막았으나, 정확한 신규 카운트로 갱신하는 대신 숫자를 아예 삭제해 이후 재차 stale 해질 여지를 원천 차단한 것으로 보인다.
  - 제안: 규약 위반은 아님(오히려 향후 drift 예방). 원한다면 실제 키 개수로 갱신해도 무방하나 필수 아님.

## 요약

target 문서 `spec/5-system/4-execution-engine.md` 의 이번 변경(§7.5.1 nodeId 불일치 케이스 + 진입점별 커버리지 표 추가)은 명명·출력 포맷·문서 구조·에러 코드 안정성 규약(`error-codes.md`) 을 모두 준수하며, 코드(`execution-engine.service.ts`)·인접 spec(`15-chat-channel.md`, `telegram.md`, `14-external-interaction-api.md`) 과도 정합됨을 직접 대조로 확인했다. 신규 에러 코드를 만들지 않고 기존 `InvalidExecutionStateError` 를 재사용한 결정은 규약 §1/§2 의 모범 사례에 해당한다. 단, 본 checker 에게 전달된 payload 의 "정식 규약 모음" 이 target 과 무관한 cafe24 카탈로그로 채워져 있어 실제 관련 규약(`error-codes.md`/`chat-channel-adapter.md`/`i18n-userguide.md`) 이 누락돼 있었다 — 이번엔 직접 `spec/conventions/` 를 열람해 보완했으나, payload 생성 로직(아마 알파벳/재귀 순 인라인 후 token 예산 초과로 truncate)의 개선이 필요해 보인다.

## 위험도

NONE
