# Code Review Resolution

PR #192 (loop-count-policy) ai-review 후속 조치 결과.

## WARNING 처리

| # | 항목 | 처리 | 위치 |
|---|---|---|---|
| W-1 | `loopNodeConfigSchema.parse({})` 직접 assert 부재 | **FIXED** — `describe('loopNodeConfigSchema (zod parse)')` 신설, `parse({})` → `{ count: '1', maxIterations: 1000 }` + 명시값 보존 + empty string 통과 3건 추가 | `loop.schema.spec.ts` |
| W-2 | cross-field 검증이 숫자 문자열에 적용 안 됨 — 의도/버그 불명 | **FIXED (의도)** — spec §8.2 신설하여 "raw string 보존 정책 + engine 단 cross-field 책임 분리" 명문화. `loop.schema.ts` JSDoc 에도 동일 정책 명시. 회귀 테스트 `skips cross-field check when count is a numeric string` 추가 | `spec/4-nodes/1-logic/3-loop.md` §8.2, `loop.schema.ts` JSDoc, `loop.schema.spec.ts` |
| W-3 | `validateLoopConfig` undefined/null/'' 경계 케이스 테스트 부재 | **FIXED** — `it.each` 로 3 케이스 모두 `[]` 반환 assert + `validateLoopConfig({})` 빈 config 케이스 1건 추가 | `loop.schema.spec.ts` |
| W-4 | 파싱 패턴 중복 | **DEFERRED** — 중기 리팩토링 후보. 즉시 fix 시 변경 영향이 본 PR scope 를 벗어남. 별 worktree 로 분리 가능 | `loop.schema.ts` validateLoopConfig 헬퍼 |

## INFO 처리

| # | 항목 | 처리 |
|---|---|---|
| I-1 | `validateLoopConfig` JSDoc stale 문장 | **FIXED** — "Single-field 'is count set?' check lives in warningRules below" 삭제, "zod default fills empty/undefined + engine 가 runtime safety net" 명시. cross-field numeric-only 가드 의도도 같은 JSDoc 에 추가 |
| I-2 | `backend-labels.ts` JSDoc i18n Principle 3 삭제 방향 미언급 | **FIXED** — JSDoc 끝에 "synchronization on both add and remove. ... MUST be removed in the same commit. The i18n guard CI check verifies both directions" 단락 추가 |
| I-3 | `loopNodeMetadata` SSOT 주석 보강 | **FIXED** — "warningRules: [] — intentionally empty" 강조 + 빈 값 경로가 storage 단계에서 닫혀 있음 + spec §8 참조 명시 |
| I-4 | `loop.handler.spec.ts` 한·영 혼용 | **FIXED** — `"accepts missing count — zod default fills it (min-1-iteration policy, spec §8)"` 영문 통일 |
| I-5 | `plan_coherence.md` 표준 헤더 누락 | **NOT APPLICABLE** — sub-agent 출력 형식의 일관성 이슈. 본 PR 범위 외 (sub-agent 자체 개선 사안) |
| I-6 | 기존 실행 로그 `loop:no-count` ko 번역 fallback | **TRACKED** — 영어 fallback 자체는 UX 허용 (다른 미번역 항목과 동일 처리). 기존 로그에 해당 경고가 저장된 경우는 거의 없을 것 (warningRule 은 실시간 캔버스 배지/handler.validate 차단이라 영구 저장 경로 없음). 사용자 결정 가능 영역 |
| I-7 | `LoopHandler.validate({})` 행동 계약 변경 호출 경로 검토 | **PARTIALLY ADDRESSED** — `handler.validate({ count: undefined })` 명시 케이스 추가 (I-8 와 함께). frontend 가 backend handler.validate 를 직접 호출하지는 않음 (frontend 는 `evaluateWarnings` 를 자체 호출 — `getConfigSummary`). assistant tool 경로는 backend handler 호출이지만 동일 의미 변경 (`add_node {}` → valid). 영향 평가는 RESOLUTION 추적 항목 |
| I-8 | `count: undefined` 명시 테스트 부재 | **FIXED** — `handler.validate({ count: undefined })` 케이스 추가 (I-7 처리와 동일 commit) |
| I-9 | `breakCondition` 표현식 인젝션 | **OUT OF SCOPE** — ExpressionResolverService 의 책임. 본 PR 범위 외 |

## 후속 추적

- **W-4 (중기 리팩토링)** — `validateLoopConfig` 의 `parseNumericField` 헬퍼 추출. 본 sweep plan 의 후속 follow-up 으로 미등록 (실제 영향 영역이 좁아 사용자 결정 후 처리)
- **I-7 영향 평가** — assistant tool `add_node` 경로의 valid: false → true 변경이 미치는 영향. 별 검토 가능. 본 PR 의 의도된 행동 변경이라 즉시 차단은 아님

## 테스트 결과 (후속 fix 적용 후)

- `nodes/logic/loop` 전체 테스트 통과 (수 갱신은 fix commit 단계에서 재실행)
- `loopNodeConfigSchema (zod parse)` 신설 describe 3 케이스
- `validateLoopConfig (imperative)` 의 빈 값 통과 4 케이스 (it.each 3 + 빈 config 1)
- `handler.validate` accepts missing count + accepts undefined count 2 케이스

## e2e

본 변경은 backend schema 메타·테스트·주석·spec 문서 변경으로 한정 — 실행 경로의 실제 동작 변화는 `loop:no-count` warningRule 발화 제거 1건. 해당 rule 은 zod default 로 발화 경로가 닫혀 있어 사용자 가시 동작 변화 없음 (handler.validate 빈 config valid: false → true 변화는 사용자 입력 흐름에서 zod default 가 선행되므로 결과 동일).

PROJECT.md §e2e 면제 화이트리스트 적용 가능 여부는 사용자 확인 필요. 본 변경은 사용자 가시 동작에 영향이 없음을 명시하여 사용자 판단 영역으로 둠.
