---
worktree: render-presentation-button-click-fix-683f3a
started: 2026-05-23
owner: project-planner
---

# Spec draft: `spec/4-nodes/6-presentation/0-common.md` §10.5 — `normalize button ids` 단계 1행 추가

## 배경

본 worktree (`render-presentation-button-click-fix-683f3a`) 의 사용자 보고 fix: AI Agent `render_*` 페이로드 안 버튼이 클릭되지 않음. root cause 는 `presentation-renderers.tsx` 의 `selectedButtonId === btn.id` 비교에서 양쪽 모두 `undefined` 일 때 `isSelected = true` 가 되어 onClick 이 즉시 단락되는 회귀. backend 정규화로 LLM 이 빠뜨린 `button.id` 를 채워 SoT (`spec §1` ButtonDef.id "자동 생성") 를 유지하는 방향으로 결정 (사용자 명시 결정 2026-05-23: A+C 동시).

본 draft 는 (C) backend 정규화 결정을 spec 의 단일 진실에 반영. consistency-check Rationale Continuity W5 권고 사항이기도 함.

## 변경 대상

| 파일 | §섹션 | 변경 |
|------|-------|------|
| `spec/4-nodes/6-presentation/0-common.md` | §10.5 (Schema 위반 처리) | 기존 3-step (validate → 위반 회신 → 재시도) 파이프라인 사이에 "validate 통과 후 누락 `button.id` 를 UUID v4 로 자동 보완" 단계 1행 추가 |

다른 파일 동반 갱신 없음 — `§1 ButtonDef.id "자동 생성"` 의 원칙을 LLM tool 모드에서도 일관 적용한다는 직접 cross-ref.

## 본문 (draft)

§10.5 갱신 본문은 다음과 같다:

```
### 10.5 Schema 위반 처리 및 정규화

1. LLM 페이로드를 해당 노드의 zod schema 로 validate.
2. 위반 (필수 필드 누락, 타입 불일치, 정합성 위배) 또는 1MB cap 초과 (Carousel/Table 의 tail truncate 후에도 element 자체가 1개도 안 들어가는 경우 등 cap 적용 불가 케이스) 시 tool_result 에 `{error: 'INVALID_PAYLOAD', issues: [...]}` 회신.
3. validate 통과 + defaults overlay + 1MB cap 적용 이후, 누락된 `button.id` 를 UUID v4 로 자동 보완한다 (§1 의 "id: 자동 생성, 불변" 원칙을 LLM tool 모드에 일관 적용). cap 이후 적용이라 tail-truncate 된 element 안의 버튼은 처리하지 않는다 — frontend 에 도달하지 않으므로 의도된 최적화. 사용자가 `defaults` 또는 LLM payload 에 명시한 id 는 보존.
4. LLM 이 같은 turn 안에서 재시도 가능. 재시도 1회 후에도 실패하면 silent drop + `meta.presentationSchemaViolations[]` 에 누적 ([AI Agent §4.1·§10](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_)).
5. AI Agent 의 `error` 포트는 발화하지 않는다 — 표현 surface 확장이라 텍스트 응답으로 fallback 한다.
```

### 변경 요지
- 섹션 제목: "Schema 위반 처리" → "Schema 위반 처리 및 정규화"
- 신규 step 3 (button.id 정규화) 삽입. 기존 step 3, 4 가 4, 5 로 재번호.
- step 3 본문은 (a) 적용 시점 (cap 이후), (b) 원칙 cross-ref (§1), (c) truncate 와의 관계, (d) 명시 id 보존 4 요소를 모두 1 문단에 응축.

## Rationale

### normalize 시점 — validate 후 / cap 이후 / overlay 이후

- validate 이전 보완은 schema 통과 여부 자체를 흐릴 수 있다 (id 가 optional 이긴 하나 다른 위반과 섞이면 분기 모호).
- defaults overlay 이전 보완은 사용자가 `defaults.buttons[].id` 를 명시한 경우의 의도를 흐린다.
- 1MB cap 이후 보완은 truncate 된 element 의 버튼에 무의미한 work 를 막는다 (frontend 미도달).

→ "validate → overlay → cap → **normalize**" 순서가 유일 정합.

### §1 cross-ref 만 두고 추가 surface 신설하지 않는 이유

- ButtonDef.id "자동 생성" 원칙은 §1 의 단일 진실. 본 변경은 그 원칙의 적용 범위 (워크플로 에디터 UI → LLM tool 모드) 확장이지 새 결정이 아니다.
- 새 enum / 새 필드 신설 X — spec 변경 면적 최소.

### 다른 위치 (§10.6 blocking, §10.7 thread 운반) 무영향

- §10.6 (blocking vs display-only) 는 `render_form` 의 interactionType 분기와 form 제출 흐름. button.id 정규화와 독립.
- §10.7 (ConversationThread 운반) 은 `presentations[]` payload 저장 위치. button.id 가 채워졌든 안 채워졌든 payload 보관 메커니즘은 동일.

### 기각된 대안

| 안 | 효과 | 채택 여부 |
|---|---|---|
| ① frontend 가 defense-in-depth 가드만 (`selectedButtonId != null` 비교) | 회귀 즉시 해소되지만 LLM emit payload 의 button.id 가 여전히 비어 있어 다른 surface (예: future thread query) 에서 동일 패턴 재발 가능 | 부분 채택 — A+C 둘 다 |
| ② backend 가 zod schema 의 id 를 required + default 로 변경 | schema 위반 → 재시도 1회 → silent drop 흐름이 LLM 의 자연스러운 emit 을 막아 UX 회귀 | 기각 |
| ③ (채택) backend 가 normalize 단계로 id 보완 + frontend 가드 동시 적용 | LLM 자유 보존 + SoT 일관 + 회귀 즉시 차단 (defense-in-depth) | ✅ |

## 사전 일관성 검토 결과

- 실행: `/consistency-check --spec plan/in-progress/spec-draft-presentation-normalize-button-ids.md`
- 세션: `review/consistency/2026/05/23/10_42_12/`
- 판정: **BLOCK: NO** (Critical 0건, Warning 6건 / Info 11건)
- Warning 반영:
  - W1: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.i` 에 normalize 단계 cross-ref 1줄 추가 ✓
  - W2/W6: `0-common.md §10.4` 의 "schema 위반 흐름" → "schema 위반 처리 및 정규화 흐름" + §10.5 신규 anchor (`#105-schema-위반-처리-및-정규화`) 동시 갱신 ✓
  - W3: 본 섹션 (사전 일관성 검토 결과) TBD 해소 ✓
  - W4: `0-common.md §Rationale` 에 "`button.id` backfill 도입 (2026-05-23)" 항목 추가 ✓
  - W5: 용어를 "UUID v4 backfill" 로 구체화 + 함수명 `backfillButtonUuids` 권장 (`normalizeNodeButtonIds` 와 의미 구분) ✓
- INFO 사항 중 본 PR 안에서 처리 가능한 것 (I2, I4 표현 명확화) 도 step 3 본문에 흡수.

## 적용 후 후속

- 본 draft 의 적용은 `project-planner` 가 처리.
- 적용 후 발신자 (`developer`) 가 backend `render-tool-provider.ts` 의 normalize 단계 구현 + frontend 가드를 TDD 로 진행.
