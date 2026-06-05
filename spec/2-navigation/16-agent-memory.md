---
id: nav-agent-memory
status: implemented
code:
  - codebase/frontend/src/app/(main)/agent-memory/page.tsx
---

# Spec: Agent Memory 관리 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md) · [Spec 레이아웃](./_layout.md) · [Spec Agent Memory 저장소·API](../5-system/17-agent-memory.md) · [Spec AI Agent 노드](../4-nodes/3-ai/1-ai-agent.md)

AI Agent 노드의 `memoryStrategy: 'persistent'` 로 누적된 영속 메모리를 워크스페이스 멤버가
scope 별로 조회하고 정리(삭제)하는 관리 화면. 경로 `/agent-memory`. 데이터·API 계약은
[Agent Memory §6](../5-system/17-agent-memory.md#6-메모리-관리-api-조회삭제-admin-surface) 가 SoT.

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Agent Memory                                   [↻ 새로고침]   │
│  ⓘ AI Agent persistent 메모리를 scope 별로 조회/삭제합니다.    │
│                                                              │
│  ┌── Scope 목록 ────────────┐ ┌── 메모리 (선택 scope) ──────┐ │
│  │ 🔍 [scope 검색.......]   │ │ kind: [전체 ▾]  12건         │ │
│  │ cust:42      8건  2d전 🗑│ │ ┌──────────────────────────┐│ │
│  │ exec:abc…    3건  5d전 🗑│ │ │ "사용자는 환불 정책을…"   ││ │
│  │ cust:99      1건  1h전 🗑│ │ │ preference · 2d전     🗑 ││ │
│  │ …                        │ │ │ "주문번호 양식은 …"       ││ │
│  │ [더 보기]                │ │ │ fact · 5d전           🗑 ││ │
│  └──────────────────────────┘ │ └──────────────────────────┘│ │
│                               │ [더 보기]                    │ │
│                               └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

좌측은 워크스페이스의 scope 목록(건수·최신 시각), 우측은 선택한 scope 의 메모리 행 목록.
삭제(🗑)는 editor 이상에게만 노출되며 확인 모달을 거친다.

## 2. 기능 상세

- **Scope 목록**: `GET /agent-memories/scopes` — scope_key, 메모리 건수, 최신 `updated_at`.
  scope 검색(부분일치)·페이지네이션(더 보기). scope 가 없으면 빈 상태 안내.
- **메모리 목록**: scope 선택 시 `GET /agent-memories?scopeKey=` — content, kind 배지
  (`fact`/`preference`/`entity`), 생성/갱신 시각, TTL 만료 예정(`expiresAt`) 표기.
  kind 필터 드롭다운. 페이지네이션(더 보기).
- **단건 삭제**: 메모리 행 🗑 → 확인 모달 → `DELETE /agent-memories/:id`. 성공 시 목록 갱신.
- **scope 전체 삭제**: scope 행 🗑 → 확인 모달(건수 경고) → `DELETE /agent-memories?scopeKey=`.
- **읽기 권한**: 화면 진입·조회는 워크스페이스 멤버(viewer+). 삭제 액션은 editor+ (RoleGate).
- **빈 상태**: persistent 메모리를 한 번도 쌓지 않은 워크스페이스는 "아직 메모리가 없습니다"
  안내와 함께 AI Agent 노드 `memoryStrategy` 설정 안내 링크.

## 3. 요구사항

요구사항 ID `NAV-AM-01`~`NAV-AM-06` 은 [내비게이션 PRD §3.13 Agent Memory](./_product-overview.md#313-agent-memory-에이전트-메모리) 가 단일 진실 — 본 문서는 화면 동작(§1·§2)을 정의한다.

## Rationale

**별도 화면 vs 노드 에디터 인라인**: 메모리는 scope(`memoryKey ?? execution_id`) 단위로
실행을 가로질러 누적되므로 특정 워크플로/노드에 종속되지 않는다. 따라서 노드 에디터 인라인이
아니라 Knowledge Base·System Status 와 같은 워크스페이스 수준 관리 화면으로 둔다.

**조회는 viewer+, 삭제는 editor+**: 메모리 내용은 운영 점검 정보라 멤버가 열람 가능해야 하나,
삭제는 비가역(hard delete, §6)이므로 통합/지식저장소 삭제와 동일하게 editor 이상으로 제한한다.
