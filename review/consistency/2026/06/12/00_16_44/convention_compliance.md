# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system)
**검토 일시**: 2026-06-12
**검토 대상**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md` (payload 에 포함된 범위 기준)

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md` — 감사 액션 동사 혼용 불일치

- **target 위치**: `spec/5-system/1-auth.md` §4.1 "Action naming 규약" 단락 및 "현재 구현된 액션" 표
- **위반 규약**: `spec/conventions/` 에는 감사 액션 명명에 대한 독립 convention 파일이 없으나, 동 섹션 자체가 naming invariant 를 선언한다. 선언과 실제 표의 불일치가 문제다.
- **상세**: 동 섹션 내에서 "integration 은 과거분사(`created`/`updated`/`deleted`)" 와 "auth_config 은 현재형 동사(`create`/`update`/`delete`/`regenerate`/`reveal`)" 라는 두 규칙이 공존한다. 규약 자체가 두 패턴을 병용하도록 허용하고 있으므로 엄밀한 외부 규약 위반은 아니다. 그러나 "Planned" 섹션의 워크스페이스/멤버/워크플로우 액션들(`workspace.create`, `member.invite`, `workflow.create` 등)이 과거분사 형태가 아닌 **현재형 동사**로 기재되어 있어, 기존 `integration.*` 과거분사 패턴과 일관성이 없다. 신규 Planned 액션들이 auth_config 예외 패턴을 따르는 것인지, integration 패턴을 따르는 것인지가 명시되지 않았다.
- **제안**: Planned 액션(`workspace.create`, `member.invite`, `workflow.create`, `trigger.create`, `schedule.create`, `model_config.*`) 의 동사 패턴을 명시적으로 선언하거나, auth_config 예외 범위를 "CRUD 동사 현재형" 카테고리로 일반화하는 선언을 추가한다. 또는 규약 자체를 갱신해 두 패턴이 허용되는 조건을 명확히 한다.

---

### [WARNING] `spec/5-system/1-auth.md` — §1.5.4 에러 코드 `forbidden` / `rate_limited` 의 Historical-artifact 레지스트리 등재 중복 정확성

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 "명명 — historical-artifact 예외" 인라인 주석
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`
- **상세**: `1-auth.md §1.5.4` 의 인라인 주석은 `forbidden` / `rate_limited` 를 historical-artifact 로 인정하고 `error-codes.md §3` 에 등재한다고 선언한다. 실제 `error-codes.md §3` 레지스트리 표를 확인하면 `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` 가 한 행으로 묶여 등재되어 있다. 두 문서가 상호 참조하는 구조 자체는 올바르나, `error-codes.md §3` 의 해당 행 "진실(의미)" 칸에 **"초대 API 한정 — 본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개다"** 라는 중요 단서가 명시되어 있다. `1-auth.md` 의 인라인 주석은 이 "초대 API 한정" 범위 제한을 충분히 반복 설명하지 않아, 독자가 `forbidden` / `rate_limited` 코드를 다른 API 에서도 lowercase 로 발행해도 된다고 오해할 여지가 있다.
- **제안**: `1-auth.md §1.5.4` 인라인 주석에 "이 예외는 초대 흐름 전용이며, 신규 코드에 적용하지 않는다" 는 명시를 추가한다.

---

### [INFO] `spec/5-system/10-graph-rag.md` — 문서 구조: Overview 섹션이 이중으로 존재

- **target 위치**: `spec/5-system/10-graph-rag.md` — 파일 상단 `## Overview (제품 정의)` 블록(H2), 그리고 이어지는 `### 1. 목표`, `### 2. 범위` 등 H3 섹션들이 Overview 에 속하다가, 다시 `## 1. 개요`(H2) 가 시작된다.
- **위반 규약**: CLAUDE.md "정보 저장 위치": "spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장. 또한 `spec/conventions/spec-impl-evidence.md §2.1` 에서 문서 구조 규약을 간접적으로 전제한다.
- **상세**: 10-graph-rag.md 는 파일 앞부분에 `## Overview (제품 정의)` H2 + 그 안에 목표/범위/요구사항/기술결정/비기능요구사항/단계별도입/의존성/미결 등 8개 H3 절을 포함하는 긴 블록이 있고, 이후 `## 1. 개요` 라는 별도 H2 본문 섹션이 다시 시작된다. CLAUDE.md 의 3섹션 권장(Overview / 본문 / Rationale)에 부합하기는 하나, "Overview" 섹션이 본문 길이에 버금가는 볼륨으로 중복된 구조 진입점을 만든다. `## 1. 개요` (본문) 는 `## Overview` 와 다소 중복된 서론을 담고 있다.
- **제안**: Overview 와 본문 `## 1. 개요` 의 역할을 명확히 분리하거나(Overview = 제품 목표·범위 선언, 본문 = 기술 상세), 또는 Overview 내 목표/범위/요구사항 이하를 본문에 통합하고 Overview 는 1~2 단락 요약으로 압축하는 구조를 검토한다. 규약 갱신이 아닌 target 정리 제안이다.

---

### [INFO] `spec/5-system/10-graph-rag.md` — Rationale 섹션이 파일 말미에 있으나 "Graph RAG 기획 결정" 과 혼합

- **target 위치**: `spec/5-system/10-graph-rag.md` `## Rationale` 섹션
- **위반 규약**: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`"
- **상세**: Rationale 섹션은 파일 말미에 존재하므로 위치 규약은 준수한다. 그러나 내용이 "Graph RAG 기획 결정 — 도메인 용어 / 사용자 결정 / 결정 근거 요약 / 비-목표" 로 구성되어, 실제 기술 결정의 Rationale(왜 이 설계를 선택했는가)보다는 기획 요약 재기술에 가깝다. `1-auth.md` 와 `11-mcp-client.md` 의 Rationale 이 `### 1.4.A`, `### 1.4.B` 등 참조 anchor 와 함께 구체적 결정 근거를 제공하는 것과 비교하면 일관성이 낮다.
- **제안**: `## Rationale` 내에 도메인 용어 정의를 이동하거나(별도 Glossary 또는 Overview 에 통합), 각 기술 결정(PostgreSQL 선택, KB 모드 불변, extraction LLM 분리 등)에 대한 구체적 근거를 Rationale anchor 형식으로 추가한다. 단, 이것은 규약 위반이 아닌 일관성 제안이다.

---

### [INFO] `spec/5-system/11-mcp-client.md` — frontmatter `status: partial` + `pending_plans` 경로 존재 여부

- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 `pending_plans` 의무, 해당 plan 파일 실존 의무
- **상세**: frontmatter 에 `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]` 가 명시되어 있다. 이 경로가 실제로 존재하는지는 파일 시스템 확인이 필요하다. 명시 자체는 규약을 따른다. 단, 검토 시점에 실존을 확인하지 못했으므로 INFO 로 기록한다.
- **제안**: `plan/in-progress/spec-sync-mcp-client-gaps.md` 파일이 실존하는지 확인한다. `spec-pending-plan-existence.test.ts` CI 가드가 이를 자동 검증하므로 테스트 통과 시 문제 없다.

---

### [INFO] `spec/5-system/1-auth.md` — frontmatter `pending_plans` 경로 복수 실존 확인 권장

- **target 위치**: `spec/5-system/1-auth.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1`
- **상세**: frontmatter 에 `pending_plans: [plan/in-progress/auth-config-webhook-followups.md, plan/in-progress/spec-sync-auth-gaps.md]` 두 경로가 명시되어 있다. 규약 준수 형식이나, 두 파일이 모두 실존하는지 CI 에서 검증된다. INFO 수준으로 기록만 한다.
- **제안**: 테스트 통과로 자동 검증됨. 별도 조치 불필요.

---

### [INFO] `spec/5-system/10-graph-rag.md` — WebSocket 이벤트 `document:graph_error` dead-declared 사실 명시

- **target 위치**: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 표 아래 주석
- **위반 규약**: 직접적 위반은 없으나 `spec/conventions/` 의 일반 원칙("spec 이 약속한 surface = 구현") 대비 dead-declared surface 가 존재하는 점이 `spec-impl-evidence.md` 의 gap 감지 의도와 배치될 수 있다.
- **상세**: `document:graph_error` 이벤트가 `websocket.service.ts` 타입 union 에만 선언되고 실제로 emit 되지 않음을 spec 이 직접 명시하고 있다. spec 이 이를 명시적으로 선언("dead-declared")하고 실제 동작을 `document:graph_retry` / `document:graph_failed` 로 안내하므로, 문서 자체의 처리는 적절하다.
- **제안**: 추가 조치 불필요. 단, 향후 `document:graph_error` 를 타입 union 에서도 제거하거나 별도 plan 으로 추적하는 것을 검토할 수 있다.

---

## 요약

`spec/5-system` 대상 문서(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)의 전반적인 규약 준수 수준은 양호하다. frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)는 모든 파일에 올바르게 구성되어 있고, `_product-overview.md` 는 `_` prefix 제외 대상으로 면제되어 있다. 에러 코드 명명(UPPER_SNAKE_CASE) 은 신규 코드에 올바르게 적용되며, historical-artifact 예외는 `error-codes.md §3` 에 등재되어 규약을 준수한다. 주요 경고 사항은 감사 액션 동사 패턴의 혼용(integration 과거분사 vs auth_config 현재형)이 Planned 액션에서 명시되지 않은 부분과, `forbidden`/`rate_limited` historical-artifact 의 "초대 API 한정" 제한 표현 불충분 두 가지다. `10-graph-rag.md` 의 Overview 이중 구조와 Rationale 품질은 규약 위반보다는 일관성 개선 사항이다.

## 위험도

LOW
