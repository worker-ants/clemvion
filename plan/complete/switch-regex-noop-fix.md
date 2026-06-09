---
worktree: (unstarted)
started: 2026-06-03
owner: developer
completed: 2026-06-10
spec_impact:
  - spec/4-nodes/1-logic/1-if-else.md
  - spec/data-flow/12-workspace.md
---

# spec-sync §C 후속 — Switch regex no-op + workspace UNIQUE 마이그레이션 (developer)

> 출처: `spec-update-c-sync-promotions.md §3·§4` (planner 가 §C 후속 처리 중 분리한 **코드/마이그레이션** 잔여). spec 편집이 아니라 코드 변경이라 developer 가 착수한다.

## 1. Switch expression-mode regex no-op  — 🔴 OPEN

- **배경**: §C C-4 가 If/Else 의 regex 연산자를 `compileRegexCache` + `options.regex` 전달로 정상 동작시켰다. **Switch (expression mode) 핸들러는 동일 패턴이 적용되지 않아 regex 가 여전히 항상 false 인 no-op** 다 (`evaluateResolvedCondition` 의 `case 'regex': if (!compiledRegex) return false`).
- **기대**: Switch expression-mode 핸들러도 If/Else 와 동일하게 `compileRegexCache` 로 조건별 정규식을 컴파일해 `evaluateCondition(..., { strict, regex })` 로 전달.
- **위치(추정)**: `codebase/backend/src/nodes/flow/switch/` (또는 flow/logic 의 switch 핸들러) — `evaluateCondition` 호출부.
- **참조 구현**: `codebase/backend/src/nodes/logic/if-else/if-else.handler.ts` execute() (C-4, PR #443).
- **spec**: `spec/4-nodes/1-logic/1-if-else.md §6` 가 "Switch expression mode 는 아직 no-op" 으로 명시 — 본 fix 후 해당 문장도 정정(planner 위임).
- **테스트**: switch 핸들러 spec 에 regex match/no-match/invalid-pattern 케이스 추가.

## 2. workspace `(owner_id, type)` UNIQUE 마이그레이션 갭  — 🔴 OPEN

- **배경**: full-branch ai-review(`review/code/2026/06/03/16_16_02`)가 `spec/data-flow/12-workspace.md §2.1` 의 `(owner_id, type) UNIQUE` 가 **TypeORM `@Unique` 데코레이터로만** 표현되고 DB 마이그레이션 SQL 이 없음을 플래그. `synchronize:false` 라 personal workspace 중복 생성 가능. §C C-16.4(node 라벨 UQ 데코레이터 미적용) 와 동류.
- **결정 필요 (C-16.4 와 동일 축)**: (a) 마이그레이션으로 `ALTER TABLE workspace ADD CONSTRAINT ... UNIQUE(owner_id, type)` 강제, 또는 (b) 데코레이터 제거 + `createPersonalWorkspace` 의 앱-레이어 사전 SELECT 중복검사로 보장 + spec 명시.
- **주의**: (a) 채택 시 기존 데이터에 중복 (owner_id,type) 존재하면 VALIDATE 실패 → NOT VALID + 사전 정리 단계 필요. 최신 마이그레이션 번호 확인 후 V0xx 부여.
- **spec**: `data-flow/12-workspace.md §2.1` + Rationale — 결정에 맞춰 planner 가 정정.

## 비고
- 둘 다 §C(코드 갭) 와 같은 성격의 잔여이나 #443 범위에 안 넣고 분리(§C 19건 완결 후 발견/정리). spec status 영향 없음(workspace 는 data-flow 라 frontmatter 가드 밖, if-else 는 이미 implemented).
