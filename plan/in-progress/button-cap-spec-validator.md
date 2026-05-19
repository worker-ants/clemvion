---
worktree: button-cap-spec-validator
started: 2026-05-19
owner: developer
---

# Presentation 노드 버튼 cap 통일 — spec 명문화 + backend validator + frontend default 갱신

## 배경

사용자 보고: Presentation 노드 (Carousel/Template/Table/Chart) 에 버튼을 다수 설정 시 일부 버튼만 렌더링됨.

`plan/in-progress/presentation-button-render-investigation.md` 분석 결과 root cause 후보:
1. parseButtonConfig URL 안전성 필터 (silent drop)
2. **Carousel itemButtons 4개 cap** ← 본 PR 의 즉시 fix 대상 cap
3. Output 1MB cap → tail item 잘림
4. buttonItemMap dedupe overkill (id 충돌)
5. CSS overflow

사용자가 frontend cap 가설로 결정사항 부여 — cap 정책을 spec 명문화 + backend validator 추가 + cap < 5 면 5 로 상향.

## 결정 (사용자, 2026-05-19)

- **cap < 5 면 5 로 상향**
- 캐러셀의 경우 "item 5 + 노드(global) 5 = 10 표시" 가 사용자 가시 모델
- cap 을 spec 에 명시
- backend validator 에 cap 추가 (현재 carousel itemButtons 만 validator 보유)

## 현 cap 인벤토리

| 위치 | 현 cap | 변경 |
|---|---|---|
| `spec/4-nodes/6-presentation/0-common.md` §1.1 "노드당 최대 10개" | 10 | **5** (사용자 의도 "노드 5") |
| `frontend button-list-editor.tsx` `maxButtons = 10` | 10 | **5** |
| `backend carousel.schema.ts validateCarouselItemButtons` itemButtons cap | 4 | **5** |
| backend carousel/template/table globalButtons (`buttons: z.array(buttonDefSchema).optional()`) | **명시 없음** | **5 validator 추가** |

## 작업 항목

> 모든 코드/spec 변경은 **단일 commit** — spec + frontend default + backend validators + tests 동시 정렬이 의미를 가짐. plan 이동 (`git mv presentation-button-render-investigation.md` 등) 은 동일 PR 내 별도 chore commit (CLAUDE.md §PLAN 라이프사이클 — "plan 이동만 담은 별 PR 로 분리하지 않는다").

- [x] plan 생성
- [x] `spec/4-nodes/6-presentation/0-common.md`:
  - §1.1 "최대 버튼 수: 노드당 최대 10개" → "**노드당 5개** + carousel itemButtons 도 각 아이템당 5개" + Rationale 참조
  - §Rationale 신설 — cap 정책 근거 + 3개 선택지 비교 + "item 5 + global 5 = 10" 가시 모델 명시
  - §9 CHANGELOG 2026-05-19 행 추가
- [x] `frontend button-list-editor.tsx`: `maxButtons = 10` → `maxButtons = 5` (default) + 보강 JSDoc
- [x] `backend _shared/button.types.ts`: `MAX_BUTTONS_PER_NODE = 5` 상수 도입, validateButtons 가 상수 참조
- [x] `backend carousel.schema.ts`: `validateCarouselItemButtons` cap 4 → MAX_BUTTONS_PER_NODE (5)
- [x] 통일된 cap 적용 — `MAX_BUTTONS_PER_NODE` 가 SSOT. template/chart 의 globalButtons 는 이미 `validateButtons` 호출하므로 자동 적용
- [x] tests:
  - `button.types.spec.ts`: "should fail when more than 10" → "passes with exactly 5" + "should fail when more than 5"
  - `carousel.schema.spec.ts`: "caps per-item buttons at 4" → "allows exactly 5" + "caps per-item buttons at 5"
  - `shadow-workflow.spec.ts:1234`: maxButtonsValidator 인라인 헬퍼 cap 10 → 5 + 메시지 동기화 + 테스트 fixture (11→6) 갱신 (ai-review C-4)
- [x] `presentation-button-render-investigation.md`:
  - 후보 2 root cause 확정 기록 + frontmatter worktree 본 PR 로 이전
  - 후보 1/3/4/5 는 본 PR 범위 외로 명시
  - 본 PR 머지 시점에 동일 PR 내 chore commit 으로 `complete/` 로 이동
- [x] **consistency-check BLOCK 해소** — Critical 3건 즉시 fix:
  - `spec/4-nodes/6-presentation/1-carousel.md` L22·24·35·417·432 모두 cap 5 로 정합화 + 경계 조건 ≥6
  - `spec/4-nodes/6-presentation/2-table.md` L353 "10개 초과" → "5개 초과"
  - `spec/4-nodes/_product-overview.md` ND-CL-08 "최대 4개" → "최대 5개"
- [x] consistency-check 재실행 (08_55_14 BLOCK NO)
- [x] tests + lint + typecheck (318 tests pass: presentation 237 + shadow-workflow 81)
- [x] /ai-review (HIGH 발견 4 Critical 중 1건만 본 PR 사안 — C-4 즉시 fix; 나머지 NOT APPLICABLE diff range artifact)
- [ ] PR merge (#203)
- [ ] `git mv plan/in-progress/button-cap-spec-validator.md plan/complete/` (동일 PR chore commit, 사용자 merge 시점)
- [ ] `git mv plan/in-progress/presentation-button-render-investigation.md plan/complete/` (동일 PR chore commit, 사용자 merge 시점)

## 관련 문서

- 원 sweep plan: [`node-config-required-defaults-sweep`](./node-config-required-defaults-sweep.md)
- 별 ticket: [`presentation-button-render-investigation`](./presentation-button-render-investigation.md)
- 병행 PR: A [`loop-count-policy`](./loop-count-policy.md) (PR #192), B `send-email-to-array-only` (PR #199)
