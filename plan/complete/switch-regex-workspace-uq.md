---
worktree: switch-regex-workspace-uq
started: 2026-06-03
owner: developer
completed: 2026-06-10
spec_impact:
  - spec/4-nodes/1-logic/1-if-else.md
  - spec/data-flow/12-workspace.md
---

# spec-sync §C 후속 — Switch regex no-op 수정 + workspace (owner_id,type) UNIQUE 정정

> 출처: `spec-update-c-sync-promotions.md §3·§4` (planner PR #444 가 분리한 코드/마이그레이션 잔여).
> #443(§C 19건) 머지 후 최신 main 위에서 developer 가 처리.

## 1. Switch expression-mode regex no-op  — ✅ DONE

- C-4 가 If/Else 만 고쳤던 regex no-op 을 Switch (expression mode) 에도 적용.
- `switch.handler.ts`: case 별 `compileRegexCache([c.condition])` 로 정규식 컴파일 후
  `evaluateCondition(input, c.condition, { strict, regex })` 전달. (If/Else 와 동일 경로.)
- 테스트: `switch.handler.spec.ts` 에 regex 매칭/불일치/잘못된 패턴(default) 3케이스 추가 (48 passed).
- spec: `4-nodes/1-logic/1-if-else.md §6` 의 "Switch 는 아직 no-op" 문장은 본 수정 후 stale → planner 정정 필요(아래 비고).

## 2. workspace `(owner_id, type)` UNIQUE 정정  — ✅ DONE (decorator) / 🔵 부분인덱스 hardening 보류

- 발견: spec Rationale 가 "personal 1개만 의도, **team 은 다수 보유 가능**" 으로 명시 → broad
  `@Unique(['ownerId','type'])` 는 **의미상 부정확**(team 다중 소유를 잘못 금지). 게다가 마이그레이션
  부재로 미적용. → **데코레이터 제거** (`@Index(['ownerId','type'])` 는 query 용으로 유지).
- personal 유일성은 앱 레이어 `findOrCreatePersonalWorkspace` (find-or-create + catch-refind) 로 보장 (기구현).
- spec `data-flow/12-workspace.md` §2.1 표 + Rationale 갱신: 데코레이터 제거 + 앱 보장 + 올바른 DB 강제는
  부분 유니크 인덱스 `(owner_id) WHERE type='personal'` 임을 명시.
- **보류(🔵)**: 부분 유니크 인덱스 마이그레이션은 기존 데이터의 owner 당 중복 personal 정리(dedup)가
  선행돼야 해 리스크가 있어 본 PR 에서 미수행. 필요 시 별도 hardening 마이그레이션 PR.

## 비고 (planner 정정 필요)
- `4-nodes/1-logic/1-if-else.md §6`: "Switch expression mode 는 아직 no-op" → "Switch 도 정상 평가" 로 정정.
  (developer 는 spec read-only — planner 위임. spec-update-c-sync-promotions.md §3 에 연결.)
