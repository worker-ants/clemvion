# Convention Compliance Review

**검토 대상**: `spec/5-system/` (diff vs origin/main, scope=impl-done)
**검토 모드**: 구현 완료 후 검토 (--impl-done)
**검토 일시**: 2026-06-04

---

## 발견사항

### [WARNING] `_product-overview.md` 시스템 영역 spec 맵 링크 대폭 삭제

- **target 위치**: `spec/5-system/_product-overview.md` line 3 (변경 후)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — `_product-overview.md` 는 "제품 정의·요구사항" 진입 문서로, CLAUDE.md 의 `spec/<영역>/_product-overview.md` 패턴 문서
- **상세**: 변경 전에는 `_product-overview.md` 의 관련 문서 링크에 16개 spec 파일 전체(1-auth.md ~ 16-system-status-api.md)가 "시스템 영역 spec 맵"으로 나열되어 있었다. 변경 후에는 처음 3개(1-auth, 2-api-convention, 3-error-handling) 만 남고 나머지 13개(4-execution-engine.md ~ 16-system-status-api.md)가 제거되었다. `_product-overview.md` 는 spec 영역 내의 cross-cutting 진입 문서 역할을 하므로 spec 맵이 불완전해졌다. 이 파일을 탐색 진입점으로 사용하는 독자(AI 에이전트·인간)가 4~16 문서로 연결되는 경로를 잃는다.
- **제안**: 삭제된 링크를 복원하거나, 대안으로 `spec/0-overview.md` 의 5-system 섹션 진입 링크 체인을 보완해 탐색 가능성을 유지한다. 이 변경이 의도적(빌드 크기 축소 등)이었다면 규약(CLAUDE.md §정보 저장 위치)을 갱신해 `_product-overview.md` 의 cross-link 완전성 요건을 완화하는 것이 적절하다.

---

### [INFO] `14-external-interaction-api.md` 및 `15-chat-channel.md` 내부 앵커 링크 변경 — 일관성

- **target 위치**: `spec/5-system/14-external-interaction-api.md` EIA-NX-03 / R12 항목; `spec/5-system/15-chat-channel.md` 여러 내부 링크
- **위반 규약**: `spec/conventions/` 에 명시된 규약 직접 위반은 아님. 단, CLAUDE.md §정보 저장 위치 — "단일 진실 원칙"의 링크 정합성
- **상세**: 두 파일에서 `12-webhook.md#42-hmac-서명--authconfigtypehmac` 형태의 앵커가 `12-webhook.md#42-hmac-서명` 으로, `14-external-interaction-api.md#34-신뢰성일관성` 이 `#34-신뢰성·일관성` 으로 일부 수정됐고, `15-chat-channel.md` 에서 `../4-execution-engine.md` 가 원래 없던 `../` prefix 형태로 변경되었다(실제론 `4-execution-engine.md` 상대경로 수정). 이 링크 변경들이 실제 섹션 헤딩 변경을 따른 것인지 아니면 오타인지를 대상 파일들과 교차 검증하지 않아 broken link 여부를 단정하기 어렵다.
- **제안**: `15-chat-channel.md` line ~252 의 `[실행 엔진 §7.5](../4-execution-engine.md#75-resume-after-restart-rehydration)` 는 이전에 `4-execution-engine.md#75-...` 였는데 `../` 가 추가되었다 — 같은 `spec/5-system/` 내에 있어 `../` 는 `spec/` 루트를 가리키게 되어 broken link 가 된다. 이를 `./4-execution-engine.md#75-resume-after-restart-rehydration` 로 수정해야 한다.

---

### [INFO] `7-llm-client.md` 와 `9-rag-search.md` 에 `Rationale` 섹션 신규 추가 — 문서 구조 규약 준수 확인

- **target 위치**: `spec/5-system/7-llm-client.md` 마지막; `spec/5-system/9-rag-search.md` 마지막
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 두 파일 모두 변경 diff 에서 `## Rationale` 섹션이 문서 끝에 신규 추가되었다. 이는 CLAUDE.md 의 3섹션 구성(Overview / 본문 / Rationale) 권장을 올바르게 준수한 것이다. 특히 `9-rag-search.md` 는 reranking 도입 의사결정 근거 7개 bullet 을, `7-llm-client.md` 는 RerankClient 분리 근거 3개 bullet 을 갖추었다.
- **제안**: 규약 준수. 이슈 없음.

---

### [INFO] `9-rag-search.md` frontmatter 상태 전이 — `implemented` → `partial` + `pending_plans` 추가

- **target 위치**: `spec/5-system/9-rag-search.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` 라이프사이클
- **상세**: `status: implemented` 에서 `status: partial` 로 격하되고 `pending_plans: plan/in-progress/rag-rerank-followup.md` 가 추가되었다. `spec-impl-evidence.md §3` 에 따르면 `partial` 시 `pending_plans:` 는 의무이며, 해당 plan 파일이 실존해야 한다. 파일 `/plan/in-progress/rag-rerank-followup.md` 가 실존하므로 가드 규칙을 충족한다. `status` 역방향 전이(`implemented` → `partial`)는 규약에서 명시적으로 금지하지 않으나 — `cross_encoder_llm` 후속 구현이 미완인 상태를 정직하게 반영한 것으로 의도에 부합한다.
- **제안**: 규약 준수. 이슈 없음.

---

### [INFO] `10-graph-rag.md` 문서 구조 — `## Overview` 섹션이 `### 1.` 과 병존

- **target 위치**: `spec/5-system/10-graph-rag.md` (변경 없음, 기존 파일 포함 검토)
- **위반 규약**: CLAUDE.md §정보 저장 위치 권장 구조 — "Overview / 본문 / Rationale 3섹션"
- **상세**: 이번 diff 범위 밖의 기존 파일이므로 본 리뷰의 직접 대상은 아니다. 다만 prompt 에 포함된 `10-graph-rag.md` 전문을 분석하면 `## Overview` + `### 1. 목표 / ### 2. 범위 / ...` 구조를 가지며 `## Rationale` 는 마지막에 존재한다. 3섹션 구조 준수로 이슈 없다.
- **제안**: 이슈 없음.

---

### [INFO] `1-auth.md` 에러 코드 표기 — `invitation_not_found` 등 `lower_snake_case`

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표
- **위반 규약**: `spec/conventions/node-output.md §3.2` + `spec/conventions/error-codes.md` — `code` 는 `UPPER_SNAKE_CASE`
- **상세**: §1.5.4 에러 응답 표의 코드 컬럼에 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 가 `lower_snake_case` 로 기재되어 있다. `spec/conventions/node-output.md §3.2` 는 `code` 는 `UPPER_SNAKE_CASE` 이며, `error-codes.md §1` 도 동일 규약을 참조한다. 이 spec 은 이번 diff 의 직접 변경 대상이 아니라 기존 파일이므로 이번 PR 에서 생긴 위반이 아니다. 단 포함된 target 문서의 규약 위반으로 표시한다.
- **제안**: `invitation_not_found` → `INVITATION_NOT_FOUND` 등 `UPPER_SNAKE_CASE` 로 수정. 단, 이 코드들이 이미 API wire 상 배포된 값이라면 `error-codes.md §2` 의 "rename 은 breaking change" 정책에 따라 실제 API 코드를 rename 하지 말고 spec 표기만 수정하거나, 기존 코드 값이 `lower_snake_case` 임을 historical-artifact 예외 레지스트리에 등재하는 것이 적절하다.

---

## 요약

이번 diff(`spec/5-system/` 변경분, origin/main 대비)의 정식 규약 준수 수준은 전반적으로 양호하다. `9-rag-search.md` 의 `status: partial` 전이와 `pending_plans:` 추가는 `spec-impl-evidence.md` 라이프사이클 규약을 정확히 따랐고, `7-llm-client.md` 와 `9-rag-search.md` 의 `## Rationale` 섹션 신규 추가는 CLAUDE.md 의 3섹션 구성 권장을 충족한다. 다만 `_product-overview.md` 에서 "시스템 영역 spec 맵" 링크 13개가 제거된 것은 해당 문서의 탐색 진입점 역할을 약화시키는 WARNING 수준 이슈이다. `15-chat-channel.md` 의 `../4-execution-engine.md` 앵커 경로 변경은 같은 `spec/5-system/` 내 파일 사이에 `../` prefix 를 추가해 broken link 가 될 가능성이 있어 확인이 필요하다. `1-auth.md` 의 에러 코드 `lower_snake_case` 는 이번 diff 범위 밖의 기존 문제이지만 target 문서 내 규약 불일치로 INFO 수준으로 기록한다.

## 위험도

LOW
