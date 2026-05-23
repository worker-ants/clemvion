# RESOLUTION — ai-agent-render-button-user-message-521f33 / 2026/05/23 12_39_18

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W#1 | 코드 | 117463b1 | `composeUserMessage`: `sanitizeUserMessage` 헬퍼 추가 — max 500자 잘라내기, `javascript:`/`data:`/`vbscript:` 스킴 거부 |
| W#2 | 코드 | 117463b1 | carousel/chart/table/template 4개 `buttonDefSchema` — `.max(500)` 추가 |
| W#3 | 코드 | 117463b1 | `validateButtons` — `link+userMessage` 조합 advisory warning 추가 (spec §1.1: 클릭 시 무시 정책 명시) |
| W#4 | 코드 | 117463b1 | `findButtonContext` — `dynamicIdx >= 0 && dynamicIdx < items.length` 명시적 범위 검사 추가 |
| W#5 | 코드 | (deferred) | `buttonDefSchema` 4파일 DRY 위반 — pre-existing 패턴, 별 plan 으로 분리 |
| W#6 | 코드 | (deferred) | `ButtonDef` interface / Zod 이중 진실 — pre-existing 패턴, W#5 와 묶어 별 plan |
| W#7 | 코드 | (deferred) | `buttonDefSchema` 4파일 반복 — W#5 와 동일, 별 plan |
| W#8 | 코드 | 117463b1 | carousel `buttonDefSchema` — placeholder 분기 의도 명시 주석 추가 (spec §10.8 참조) |
| W#9 | 코드 | 117463b1 | `ButtonDef` / `ButtonContext` named 타입 추출 — `findButtonContext` + `composeUserMessage` 공용 |
| W#10 | 코드 | 117463b1 | `render-tool-provider.spec.ts` — `userMessage` 보존 테스트 3건 추가 (backfill 2건 + execute 1건) |
| W#11 | 코드 | 117463b1 | `button.types.spec.ts` — port+userMessage 통과 / link+userMessage advisory 테스트 각 1건 추가 |
| W#12 | 코드 | 117463b1 | `assistant-presentations-block.test.tsx` — items vs buttonConfig 우선순위 충돌 테스트 1건 추가 |
| W#13 | 코드 | 117463b1 | `assistant-presentations-block.test.tsx` — onSendMessage 미전달 smoke 테스트 1건 추가 |
| W#14 | 코드 | 117463b1 | 4개 `schema.spec.ts` — `buttonDefSchema — userMessage` describe 블록 앞에 spec §10.8 참조 JSDoc 추가 |
| I#18 | 코드 | 117463b1 | 4개 `schema.ts` — 로컬 `buttonDefSchema` 상단에 `// Mirror: ButtonDef in _shared/button.types.ts` 한 줄 추가 |
| I#19 | 문서 | 117463b1 | `plan/in-progress/ai-agent-render-button-user-message.md` — TDD 체크리스트 완료 항목 `[x]` 갱신 |

## TEST 결과

- lint  : 통과 (duration: 29s)
- unit  : 통과 (4541 passed, duration: 24s)
- build : 통과 (duration: 26s)
- e2e   : 통과 (98 passed, duration: 62s)

## 보류·후속 항목

### 별 plan 으로 분리 (scope 한정 결정)

- **W#5/W#6/W#7** — `buttonDefSchema` 4파일 DRY 위반 + `ButtonDef` interface/Zod 이중 진실: pre-existing 패턴으로 본 PR 이 신설하지 않았음. "Don't add features/refactor beyond task scope" 원칙에 따라 별 plan 으로 분리 권장.
  - 제안 조치: `_shared/button.schema.ts` 에 단일 `buttonDefSchema` 정의 후 4개 파일 import 전환; `export type ButtonDef = z.infer<typeof buttonDefSchema>` 로 interface 파생.

### 별 plan / spec 위임

- **INFO #3** — table/chart/template global 버튼 클릭 user-message 발화 경로 미구현: 현 단계 scope 한정 (carousel 만). 후속 task 로 추적.
- **INFO #4** — spec §10.8 `userMessage` 빈 문자열 처리 규칙 미명문화: `project-planner` 위임 필요. 현행 동작(frontend 가 빈 문자열 무시, backend Zod 허용)은 유지되며 spec 보충만 필요.

### INFO 항목 (자동 수정 대상 아님)

- **INFO #1** — `.passthrough()` → `.strip()`/`.strict()` 전환 검토: 별 plan
- **INFO #2** — `url` 필드 Zod `.refine()` scheme 차단: 별 plan
- **INFO #5** — carousel global `buttons` placeholder 수정 검토: W#5 완료 후 자연스럽게 해소
- **INFO #6** — `findButtonContext` 헬퍼 분리: 현재 수용 가능
- **INFO #7** — `@internal` + `export` JSDoc 보충: W#9 에서 `@internal — exported for testing only` 주석으로 처리됨
- **INFO #8** — `validateButtons` imperative/Zod 이중 경로: 별 plan
- **INFO #9** — `review/consistency/` 산출물 커밋 포함: 조치 불필요 (프로젝트 규약 준수)
- **INFO #10** — `findButtonContext` static 모드 완전 일치 변경: 현행 동작 정확함
- **INFO #11** — `dynamicMatch`/`dynamicIdx`/`dynamicItem` 선제 계산: 현재 수용 가능
- **INFO #12** — `as unknown as {...}` 타입 단언 패턴: 선택적 개선
- **INFO #13** — `validateButtons` 에 빈 문자열 의도 주석 부재: 별 commit 필요 시 추가
- **INFO #14** — `carousel.schema.spec.ts` `userMessage: ""` 보존 테스트: INFO 수준
- **INFO #15** — chart/table/template spec `it` 블록 assertion 혼합: INFO 수준
- **INFO #16** — `userMessage` 최대 길이 경계값 테스트: W#2 fix 로 `.max(500)` 추가됨; 경계값 테스트는 INFO 수준
- **INFO #17** — `ButtonDef` 나머지 필드 JSDoc 부재: INFO 수준
- **INFO #20** — Zod `z.string().optional()` vs `z.string().min(1).optional()` API 계약: INFO 수준 (현행 동작 유지)
