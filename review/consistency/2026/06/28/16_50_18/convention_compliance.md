# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (--impl-prep 모드)
검토 일시: 2026-06-28
검토 범위 중점 파일: `1-auth.md`, `10-graph-rag.md`, `16-system-status-api.md`, `_product-overview.md`, `2-api-convention.md`, `3-error-handling.md` (참고), 관련 `spec/conventions/` 파일

---

## 발견사항

### [INFO] `1-auth.md` §1.4.3 — WebAuthn availability 응답 논리 payload 표기 일관성 명시

- **target 위치**: `spec/5-system/1-auth.md` §1.4.3, `/auth/2fa/webauthn/availability` 설명
- **관련 규약**: `spec/conventions/swagger.md §2-5` / `spec/5-system/2-api-convention.md §5.1`
- **상세**: 해당 주석에서 `{ enabled: boolean }` 을 "논리 payload" 로 표기하고, 전역 TransformInterceptor 가 `{ "data": { "enabled": … } }` 로 래핑한다는 사실을 parenthetical 로 명시하고 있다. §5 엔드포인트 표에서도 `{ enabled: boolean }` 으로 표기되어 있어, spec 내 두 위치가 각각 논리 payload 형태로 표기되고 실제 wire 형식은 주석에서만 언급된다. 일관성 이슈는 없으나, API 응답 표기가 논리 payload(래핑 전) 와 wire 응답(래핑 후) 중 어느 것을 기준으로 하는지 spec 내부 약속이 명시적으로 선언되지 않은 상태다.
- **제안**: 현 표기 방식("본 문서는 논리 payload 표기로 통일한다" 는 §1.4.3 주석이 이미 명시)은 충분하다. 별도 조치 불필요.

---

### [INFO] `10-graph-rag.md` — 문서 구조 3섹션(Overview / 본문 / Rationale) 중 Rationale 섹션 부재

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체
- **관련 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권고
- **상세**: `10-graph-rag.md` 는 Overview 섹션과 본문(§1~§8) 을 갖추고 있으나, 독립된 `## Rationale` 섹션이 없다. 기술 결정 사항(§4)에 결정 근거가 인라인으로 기술되어 있으나, 다른 spec 파일(`1-auth.md` 등)이 갖는 별도 `## Rationale` 섹션이 없어 3섹션 권고를 완전히 따르지 않는다.
- **제안**: 구현 착수 전이므로, 최소한 §4 "기술 결정 사항" 의 근거를 `## Rationale` 섹션으로 이동 또는 별도 섹션으로 추가하는 것을 권장한다(강제 아님, CLAUDE.md "권장" 수준).

---

### [INFO] `16-system-status-api.md` §1 — `agent-memory-extraction` 큐 구현 갭 spec 내 주석 처리

- **target 위치**: `spec/5-system/16-system-status-api.md` §1 주석
- **관련 규약**: 정식 규약 직접 위반 없음; spec-impl-evidence 정책(`spec/conventions/spec-impl-evidence.md`) 관련
- **상세**: `⚠ 구현 갭` 주석이 spec 본문 안에 인라인으로 있다. 이 갭은 spec이 구현보다 앞선 경우로, spec 자체의 규약 준수 이슈는 아니다. 단, spec 본문에 구현 갭을 표시하는 방식이 일관성 없이 사용되고 있다(일부 파일은 `pending_plans` frontmatter 필드 사용, 이 파일은 인라인 주석).
- **제안**: 현 상태 유지 가능. 단, 구현 갭 추적은 `pending_plans` frontmatter 에서 하는 것이 타 파일과 일관된다.

---

### [WARNING] `1-auth.md` §1.5.4 에러 응답 — `lower_snake_case` 코드 Historical-artifact 등재 정합성 검증

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 + 하단 명명 주석
- **관련 규약**: `spec/conventions/error-codes.md §3` Historical-artifact 예외 레지스트리
- **상세**: `1-auth.md §1.5.4` 는 `invitation_not_found`·`invitation_expired`·`invitation_already_used`·`invitation_email_mismatch`·`forbidden`·`rate_limited` 코드를 lowercase 로 정의하고, 이들이 `error-codes.md §3` 에 등재된 historical-artifact 라고 주석으로 명시한다. `error-codes.md §3` 레지스트리를 확인하면 이 코드들이 실제로 등재되어 있어 양측이 일치한다. 이는 규약 위반이 아니라 규약에서 명시적으로 허용된 예외이며, 두 문서 간 상호 포인터도 정확하다. 단, `forbidden`·`rate_limited` 가 초대 흐름 "전용 한정" 임을 §1.5.4 주석과 `error-codes.md §3` 모두 명시하고 있어 invariant 는 유지된다.
- **제안**: 현재 정합 상태이므로 수정 불필요. 신규 초대 관련 에러 코드 추가 시 `error-codes.md §3` 동기 업데이트 의무 유지.

---

### [WARNING] `1-auth.md` §4.1 감사 액션 카탈로그 — `audit-actions.md` 규약 SoT 역할 분리 표기 검증

- **target 위치**: `spec/5-system/1-auth.md` §4.1 "Action naming·시제 규약" 리드 문장
- **관련 규약**: `spec/conventions/audit-actions.md §1~§3`
- **상세**: `1-auth.md §4.1` 에서 "Action naming·시제 규약은 `conventions/audit-actions.md` 가 SoT 다 — 본 §4.1 은 그 규약을 따르는 액션 카탈로그·workspace 귀속·읽기측 계약을 소유한다" 고 명시하며, `audit-actions.md §1` 에서는 역으로 "액션 카탈로그·workspace 귀속·읽기측 계약: `5-system/1-auth.md §4.1`" 이 SoT 라고 정의해 상호 일관된 책임 분리를 선언하고 있다. 이는 규약 설계상 올바른 SoT 분리이다.

  그러나 `1-auth.md §4.1` 의 "현재 구현된 액션" 표에서 `auth_config.*` 액션의 표기(`auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal`)가 `audit-actions.md §3` 의 분류 레지스트리에서 `auth_config | 현재형 (§2.2) | create, update, delete, regenerate, reveal` 로 일치하므로, 명명 규약 준수에 문제없다.
- **제안**: 현 상태 유지.

---

### [INFO] `_product-overview.md` — 섹션 제목 표기

- **target 위치**: `spec/5-system/_product-overview.md` 파일명 및 내부
- **관련 규약**: CLAUDE.md "정보 저장 위치 단일 진실 원칙" — `spec/<영역>/_product-overview.md` 또는 진입 문서 `## Overview`
- **상세**: `_product-overview.md` 파일명이 CLAUDE.md 에서 정의한 `_product-overview.md` 컨벤션에 정확히 일치한다. 내부에도 `# PRD: 비기능 요구사항` 제목 하에 비기능 요구사항이 기술되어 있다. 규약 준수.
- **제안**: 불필요.

---

### [INFO] `2-api-convention.md` §5.1 — `TransformInterceptor` 래핑 예외 및 단일 SoT 교차 참조 일관성

- **target 위치**: `spec/5-system/2-api-convention.md` §5.2
- **관련 규약**: `spec/conventions/swagger.md §2-5`, §Rationale
- **상세**: `2-api-convention.md §5.2` 는 `data`·`pagination` 이 top-level 형제임을 명시하고, 메커니즘 상세를 `swagger.md §2-5` 로 포인터로 연결한다. `swagger.md §2-5` 와 §Rationale 은 이 pass-through 예외를 명확히 정의한다. 양측 문서가 일관된다.
- **제안**: 불필요.

---

### [INFO] `10-graph-rag.md` 용어 "rerank" 혼동 방지 주석 — 규약 준수

- **target 위치**: `spec/5-system/10-graph-rag.md` §1 개요, §3.4 KB-GR-SR-05
- **관련 규약**: 출력 포맷 규약 직접 위반 없음
- **상세**: §1 개요에서 "본 문서에서 그래프 4단계의 'rerank'·'score 재정렬' 은 centrality-weighted score blending 을 뜻한다 — RAG 검색 §3.3 의 cross-encoder reranking 과 혼동하지 않는다" 를 명시한다. 이는 spec 내 용어 모호성을 능동적으로 제거하는 양호한 패턴이다. 규약 위반 없음.
- **제안**: 불필요.

---

## 요약

`spec/5-system/` 의 주요 파일들은 정식 규약(`spec/conventions/`)을 전반적으로 잘 준수하고 있다. 에러 코드 명명(`error-codes.md §3`) 의 historical-artifact 예외 등재, 감사 액션 SoT 분리(`audit-actions.md` ↔ `1-auth.md §4.1`), API 응답 포맷(`api-convention.md §5`) 등 핵심 규약 영역에서 양측 문서 간 상호 포인터가 일치하며 invariant 가 유지되고 있다. `10-graph-rag.md` 가 Rationale 섹션을 별도로 두지 않는 점과 `16-system-status-api.md` 의 구현 갭 추적 방식이 다른 파일과 미세하게 다른 점이 INFO 수준 관찰로 남는다. CRITICAL 또는 실제 규약 직접 위반은 발견되지 않았다.

## 위험도

LOW

---

STATUS: PASS
