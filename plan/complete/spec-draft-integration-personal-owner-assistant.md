---
title: spec draft — 워크플로우 어시스턴트의 통합 후보도 §8 을 따른다 (Personal 통합 소유자 강제 보강)
status: complete
owner: planner
worktree: integration-personal-owner
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
started: 2026-09-25
---

# spec draft — 워크플로우 어시스턴트의 통합 후보도 §8 을 따른다

같은 PR 의 `plan/in-progress/spec-draft-integration-personal-owner.md`(반영 커밋 `f47069564`)의 보강이다. 그 draft 는
`spec/2-navigation/4-integration.md §8` 판정 규칙에 «워크플로우 어시스턴트의 통합 목록 도구와 노드 후보 제시는 «조회» 행을 따른다» 고
적었는데, 그 표면을 소유한 `spec/3-workflow-editor/4-ai-assistant.md` 는 여전히 «워크스페이스에 등록된 목록» · «`workspace_id` 일치» 만
적는다. `--impl-prep` `review/consistency/2026/09/25/21_49_24` WARNING 1(cross_spec) · 3(rationale_continuity)이 짚었다.

## 변경안 — `spec/3-workflow-editor/4-ai-assistant.md`

### (1) §4.1 탐색 도구 표 — `list_integrations` 행 설명

«현재 워크스페이스에 등록된 Integration 목록» →

```markdown
현재 워크스페이스에 등록된 Integration 목록 — 남의 personal 은 빠진다([통합 §8](../2-navigation/4-integration.md#8-권한-규칙))
```

### (2) §4.3.1 후보 필터 표 — `integration-selector` · `mcp-server-selector` 두 행

두 행 모두 «`workspace_id` 일치 + `status='connected'`» →

```markdown
`workspace_id` 일치 + `status='connected'` + 요청자에게 보이는 것(남의 personal 제외 — [통합 §8](../2-navigation/4-integration.md#8-권한-규칙))
```

### (3) Rationale ED-AI-39 «구현자가 기억해야 할 계약» 1번

«widget 별 저장소(…) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다.» →

```markdown
widget 별 저장소(…) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다(Integration 은 거기에 더해 요청자에게 보이는 것만 — 남의 personal 제외, [통합 §8](../2-navigation/4-integration.md#8-권한-규칙) — 2026-09-25 부터).
```

## Rationale

- **왜 별도 draft 인가** — 원 draft 는 이미 spec 에 반영돼 커밋됐다. 같은 파일에 덧붙여 `--spec` 을 다시 돌리면 checker 가 반영된
  변경을 «이미 있음» 으로 다시 읽는다. 보강분만 따로 검토받는다.
- **왜 세 자리 모두인가** — 도구 표(§4.1) · 후보 표(§4.3.1) · 구현 계약(Rationale)이 같은 조회를 세 층에서 서술한다. 한 곳만 고치면
  나머지 둘이 «워크스페이스 전체» 를 계속 약속한다.
- **남은 이 문서의 drift 는 다루지 않는다** — §4.1 `list_integrations` 의 출력 열(`[{id, name, type, category}]`)이 구현
  (`id · name · serviceType · scope · status`)과 다른 것은 이 PR 이전부터이고 소유자 강제와 무관하다.

## `--spec` 처리 (`review/consistency/2026/09/25/22_00_14` — BLOCK: NO, WARNING 2 · INFO 3)

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 | 변경안 (1) · Rationale 의 절 번호 §4.2 는 §4.1(탐색 도구)이다 | 정정 |
| W2 | developer plan `spec_impact` 에 `4-ai-assistant.md` 누락 | developer plan 에 추가 |
| INFO 1 | 세 자리의 어투(동사형 · 명사형) 차이 | 의미 같음 — 조치 없음 |
| INFO 2 | ED-AI-39 계약 갱신에 날짜가 없다 | (3) 끝에 «— 2026-09-25 부터» |
| INFO 3 | developer plan 체크리스트에 «목록에서 조용히 제외(에러 아님)» 케이스가 없다 | developer plan 체크리스트에 추가 |
