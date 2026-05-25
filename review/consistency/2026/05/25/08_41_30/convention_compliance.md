# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep`, scope=`spec/5-system/`
검토 일시: 2026-05-25
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/15-chat-channel.md`

---

## 발견사항

---

### **[CRITICAL]** `spec/5-system/1-auth.md` — `status: spec-only` 이지만 구현이 존재 (spec-impl-evidence §3.1 위반)

- **target 위치**: `spec/5-system/1-auth.md` frontmatter (`status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 "status 라이프사이클" + §3.1 전이 규칙 ("spec-only → partial: 최초 코드 머지 시점에 승격")
- **상세**:
  `status: spec-only` 는 "작성됐고 구현 의도 결정됨, 아직 코드 없음"을 의미한다. 그러나 인증 모듈 전체 (`codebase/backend/src/modules/auth/`)가 이미 구현되어 있으며, WebAuthn 서브모듈 (`auth/webauthn/`) 도 존재하고, V058 마이그레이션도 적용된 상태다. 본 spec 의 Rationale §1.4.H 는 "WebAuthn 도메인 모듈 분리"를 현재형으로 기술하며 구체적 파일 경로를 나열한다. `plan/in-progress/2fa-webauthn-followups.md` 가 미완료 follow-up을 추적 중이다.

  `spec-impl-evidence.md` §3 에 따르면 코드가 존재하므로 `spec-only`는 잘못된 상태다. 미완료 plan이 존재하므로 `partial`이 올바르다. `code: []` 이므로 `spec-code-paths.test.ts` 가드도 현재 우회된 상태 (이 테스트는 `partial`/`implemented` 시에만 경로 매치를 강제하므로, `spec-only` 로 남아 있으면 가드가 오작동이다).
- **제안**:
  ```yaml
  status: partial
  code:
    - codebase/backend/src/modules/auth/**
  pending_plans:
    - plan/in-progress/2fa-webauthn-followups.md
  ```
  `status: partial`로 승격하고, 구현 경로와 미완료 plan을 명시한다.

---

### **[CRITICAL]** `spec/5-system/15-chat-channel.md` — `pending_plans` 에 존재하지 않는 경로 포함 (spec-impl-evidence §4 가드 위반)

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans[0]`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §4 `spec-pending-plan-existence.test.ts` 가드 ("pending_plans: 의 모든 path 가 plan/in-progress/ 에 실존")
- **상세**:
  ```yaml
  pending_plans:
    - plan/in-progress/chat-channel-dispatcher-split.md   # <-- MISSING
    - plan/in-progress/chat-channel-discord-gateway.md
    ...
  ```
  `plan/in-progress/chat-channel-dispatcher-split.md` 는 존재하지 않는다. 해당 파일은 `plan/complete/chat-channel-dispatcher-split.md` 에 위치해 있다(다만 파일 내용에 `status: in-progress` 가 남아 있는 별도 plan-lifecycle 이슈도 동반). `plan/in-progress/` 에 없으므로 `spec-pending-plan-existence.test.ts` 가드 기준으로 빌드 실패다.
- **제안**:
  `pending_plans` 에서 `plan/in-progress/chat-channel-dispatcher-split.md` 항목을 제거한다. 해당 plan이 실제로 완료됐다면 `pending_plans` 목록에서 삭제하면 되고, 아직 미완이라면 `plan/complete/` 에서 `plan/in-progress/` 로 되돌려 (`git mv`) plan-lifecycle도 함께 정정해야 한다.

---

### **[CRITICAL]** `spec/5-system/10-graph-rag.md` — `status: spec-only / code: []` vs 본문 "P0~P2 구현 완료" 불일치 (spec-impl-evidence §3.1 위반)

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter (`status: spec-only`, `code: []`) — 검토 대상 payload 기준
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 "status 라이프사이클" + §3.1 ("spec-only → partial: 최초 코드 머지 시점에 승격" / "partial → implemented")
- **상세**:
  본문 `## Overview (제품 정의)` 블록이 `✅ P0~P2 구현 완료 (검증 일자: 2026-05-11)` 라고 명시하면서, 파이프라인·Hybrid 검색·Entity/Relation CRUD·3D 시각화 모두 동작 중임을 기술한다. `V025__graph_rag.sql`~`V027__relation_head_tail_index.sql` 마이그레이션도 적용됐다. `codebase/backend/src/modules/knowledge-base/graph/**` 등 구현 경로가 명확히 존재한다.

  payload에서는 frontmatter가 `status: implemented`에 code 경로가 올바르게 채워진 버전이 제공되어 있으나, 이는 제안안(proposed)이며 실제 디스크의 파일은 아직 `status: spec-only, code: []` 상태다. 이 불일치를 해소하지 않으면 `spec-code-paths.test.ts` 가드가 통과하지 않는다.

  단, payload에 포함된 버전(`status: implemented`, code 경로 채움)은 규약에 부합한다.
- **제안**:
  실제 `spec/5-system/10-graph-rag.md` 를 payload 기준(status: implemented + code 경로 목록)으로 갱신한다. 구현 착수 전 검토 모드이므로, 착수 전에 이 spec 파일도 올바른 상태로 update해야 한다.

---

### **[CRITICAL]** `spec/5-system/11-mcp-client.md` — `status: spec-only / code: []` 이지만 구현이 존재 (spec-impl-evidence §3.1 위반)

- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter (`status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 전이 규칙
- **상세**:
  `codebase/backend/src/modules/mcp/` 에 `mcp-client.service.ts`, `mcp-client.service.spec.ts`, `mcp-test-connection.service.ts`, `mcp.module.ts`, `mcp-error-codes.ts` 등 MCP 클라이언트 구현이 존재한다. 구현이 있으므로 `spec-only`는 잘못된 상태다.
- **제안**:
  ```yaml
  status: partial
  code:
    - codebase/backend/src/modules/mcp/**
  ```
  또는 전체 구현이 완료됐다면 `implemented`로 승격하고 구현 경로를 명시한다. MCP 관련 pending plan이 있다면 `pending_plans`도 추가한다.

---

### **[WARNING]** `spec/5-system/1-auth.md` §1.5.4 — invitation 에러 코드가 `lowercase_snake_case`

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (코드 컬럼: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited`)
- **위반 규약**: `spec/5-system/2-api-convention.md` §5.3 예시 (`VALIDATION_ERROR` 형태), `spec/conventions/node-output.md` Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`)
- **상세**:
  API 에러 응답의 `error.code` 필드는 프로젝트 전반에서 `UPPER_SNAKE_CASE` 를 사용한다 (`VALIDATION_ERROR`, `EXECUTION_TIMEOUT` 등). `2-api-convention.md` §5.3 및 `3-error-handling.md` §3 모두 UPPER_SNAKE_CASE 형태로 예시를 제공한다. 초대 에러 코드만 `invitation_not_found` (소문자) 형태를 사용하면 일관성이 깨진다. 실제 구현 코드(`workspace-invitations.service.ts`)도 소문자 코드를 사용하고 있어, spec 과 구현이 일치하는 상태이나 프로젝트 규약과는 거리가 있다.

  `node-output.md` Principle 3.2 는 노드 실행 output.error.code 에 대한 규약이므로 HTTP API 응답에 직접 적용되지는 않지만, `2-api-convention.md` 의 사례 + 프로젝트 전반 관행으로 볼 때 불일치다. 의도적인 결정이었다면 spec 에 이유를 명시하거나 규약을 갱신해야 한다.
- **제안**:
  `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN`, `RATE_LIMITED` 등 UPPER_SNAKE_CASE 로 통일하고 구현도 함께 변경하거나, 의도적 예외임을 spec 내 Rationale 에 명시한다.

---

### **[WARNING]** `spec/5-system/11-mcp-client.md` — `## Rationale` 섹션 부재

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조 (§1~§12 본문 섹션만 존재, 별도 `## Rationale` 없음)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" / `project-planner/SKILL.md` "Spec 문서 3섹션 권장 (Overview / 본문 / Rationale)"
- **상세**:
  §2.2 (stdio 미지원 사유), §4.3 (풀링 미채택 사유), §5 (평탄화 모델 이유), §8.1 (격리 원칙), §8.4 (단일 실패 시 status 전환 의도) 등 설계 결정 근거가 본문 섹션 안에 인라인으로 혼재되어 있다. 이를 한 곳(`## Rationale`)에 모으면 결정 추적과 규약 유지가 쉬워진다. 단, "권장"이므로 CRITICAL은 아니다.
- **제안**:
  spec 말미에 `## Rationale` 섹션을 추가하고, §2.2 stdio 미지원·§4.3 풀링 미채택·§8.4 단일 실패 격하 등 주요 설계 결정 근거를 이동한다.

---

### **[INFO]** `spec/5-system/1-auth.md` — `## Overview` 섹션 부재

- **target 위치**: `spec/5-system/1-auth.md` 최상단 섹션 구조 (`## 1. 인증(Authentication)` 으로 시작)
- **위반 규약**: `project-planner/SKILL.md` "Spec 문서 3섹션 권장 (Overview / 본문 / Rationale)"
- **상세**:
  `spec/5-system/_product-overview.md` 가 영역 전반의 Overview 역할을 담당하므로 개별 파일에 Overview가 없어도 규약 위반은 아니다 (CLAUDE.md: "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"). 단, 10-graph-rag.md나 15-chat-channel.md 같은 동일 영역의 다른 파일들은 각 파일 안에 `## Overview (제품 정의)` 섹션을 두고 있어 형식이 통일되지 않는다.
- **제안**:
  영역 내 일관성을 위해 `## Overview` 섹션(짧은 목적/범위 요약)을 추가하는 것을 고려한다. 필수가 아닌 권장이므로 다음 spec 갱신 시 적용해도 무방하다.

---

### **[INFO]** `spec/5-system/11-mcp-client.md` — `## Overview` 섹션 부재 (`## 1. 개요` 로 대체)

- **target 위치**: `spec/5-system/11-mcp-client.md` 첫 번째 섹션 (`## 1. 개요`)
- **위반 규약**: `project-planner/SKILL.md` "Spec 문서 3섹션 권장 — `## Overview (제품 정의)`"
- **상세**:
  `## 1. 개요` 는 내용 면에서 Overview 역할을 하나, 동일 영역의 다른 파일들이 사용하는 `## Overview (제품 정의)` 형식과 다르다. 규약에서는 권장이므로 엄격한 위반은 아니지만, 검색·파싱 일관성 측면에서 통일하면 좋다.
- **제안**:
  `## 1. 개요` 를 `## Overview (제품 정의)` 로 변경하거나, `## Overview` + `## 1. 세부 개요` 구조로 분리하는 것을 고려한다.

---

## 요약

`spec/5-system/` 에 대한 구현 착수 전 정식 규약 준수 검토 결과, 가장 심각한 문제는 **spec-impl-evidence 규약의 `status` 라이프사이클 위반**이다. `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` 세 파일 모두 `status: spec-only / code: []` 를 유지하고 있으나 실제로는 구현이 존재한다. 이 상태에서는 `spec-code-paths.test.ts` 빌드 가드가 구현 표면을 추적하지 못해, spec 약속 vs 구현 갭 감지 기능이 무력화된다. `15-chat-channel.md` 는 `pending_plans` 에 `plan/in-progress/` 에 없는 경로를 포함해 `spec-pending-plan-existence.test.ts` 가드 기준으로 빌드 실패 조건이다. 이 네 가지 CRITICAL 사항은 구현 착수 전에 반드시 해소되어야 한다. `1-auth.md` §1.5.4 의 소문자 에러 코드 및 `11-mcp-client.md` 의 Rationale 섹션 부재는 WARNING 등급으로, 착수를 막지는 않으나 다음 spec 갱신 시 정정이 권장된다.

---

## 위험도

**HIGH**

CRITICAL 발견 4건 중 3건이 spec-impl-evidence 규약의 `status` 필드 오기재다. 이는 빌드 가드를 직접적으로 우회하는 상태이며, spec 약속 vs 구현 갭 추적 인프라 전체의 신뢰성을 흐린다. 1건(chat-channel pending_plans)은 존재하지 않는 경로 참조로 빌드 실패 조건이다. 모든 CRITICAL 사항은 구현 착수 전 스펙 파일 갱신으로 해소 가능하다.
