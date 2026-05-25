---
worktree: telegram-carousel-button-click-5b52c1
started: 2026-05-25
owner: project-planner
---
# Spec Fix Draft — presentation/0-common.md frontmatter + CHANGELOG

## 원본 발견사항

`/ai-review` SUMMARY (`review/code/2026/05/25/15_42_38/SUMMARY.md`) 의 WARNING:

- **W6**: `spec/4-nodes/6-presentation/0-common.md` frontmatter `status: spec-only` / `code: []` 미갱신
- **W7**: 동 spec `§9 CHANGELOG` 본 회귀 수정 미기재

## 제안 변경

### W6 — frontmatter 갱신

`spec/conventions/spec-impl-evidence.md §3` 라이프사이클 표 기준 적용. 본 spec 은 5 presentation 노드 (`carousel`/`table`/`chart`/`form`/`template`) 의 공통 규약 (ButtonDef·port 토폴로지·Blocking Mode·출력 포맷·5필드 공통·AI Tool 모드 §10) 을 모두 정의하며, 이 surface 는 backend/frontend 양쪽에 이미 머지된 구현이 광범위하게 존재. 본 PR (`telegram-carousel-button-click-5b52c1`) 의 `button_click` graceful degradation 구현으로 §10.9 line 407 invariant 처리까지 코드 머지가 완료된다.

→ `status: implemented` 승격. `code:` 에 본 spec 본문 §1~§10 약속 surface 의 주요 구현 영역 glob 등록 (§4 가드 `spec-code-paths.test.ts` ≥1 매치 의무 충족).

**`spec-only → implemented` 직접 전이 근거 (W1 해소)**: `spec-impl-evidence §3.1` 의 표준 전이 규칙은 `spec-only → partial → implemented` 2단계지만, 동 문서 `§6 Rollout 정책`항이 *"기존 머지된 PR 로 구현 완료된 spec → `implemented` + `code:` 채움"* 직접 승격을 명시적으로 허용한다. 본 spec 의 §1~§10 약속 surface 는 모두 기존 머지 PR (#269/#277/#278/#280/#298/#301/#319 등) 로 구현 완료 + 본 PR 이 §10.9 line 407 마지막 invariant 처리를 추가해 spec 본문 약속이 코드로 전부 충족된 상태. 따라서 `§6 Rollout` 정책 적용 — 소급 전이로 직접 `implemented` 승격이 적법하다.

```yaml
---
id: presentation-common
status: implemented
code:
  - codebase/backend/src/nodes/presentation/_shared/**
  - codebase/backend/src/modules/execution-engine/execution-engine.service.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts
  - codebase/backend/src/shared/conversation-thread/**
---
```

`id: common` → `id: presentation-common` 변경: convention-compliance-checker 의 INFO #I2 발견 (`id: common` 이 다른 카테고리 공통 문서 5 개와 중복) 해소. basename `0-common` 의 카테고리 prefix 반영.

### W7 — §9 CHANGELOG 항목 추가

```markdown
| 2026-05-25 | §10.9 dispatch 표 `button_click` 케이스 graceful degradation (line 407 invariant) 구현 완료 — `waitForAiConversation` else 분기에 `else if (action.type === 'button_click')` 명시 분기 추가, `MAX_UNKNOWN_SKIPS` 카운팅 제외. 텔레그램 stale `inline_keyboard` 클릭이 누적돼 AI 대화가 FAILED 종결되던 회귀 차단. 본문(§10.9) 변경 없음 — 기존 SoT 그대로 충실 구현. 결정 근거: PR `telegram-carousel-button-click-5b52c1` ai-review (`review/code/2026/05/25/15_42_38/`) WARNING W1-W5 후속 조치 (`review/code/2026/05/25/15_42_38/RESOLUTION.md`) |
```

## Side-effect 점검

- 본 변경은 spec 본문 (content) 무수정 — frontmatter / CHANGELOG 메타 layer 만. §10.9 line 400/407 의 graceful degradation 정책 자체는 이미 SoT.
- spec-impl-evidence §4 가드:
  - `spec-frontmatter.test.ts`: `id`, `status` 의무 필드 유효 — `implemented`, `presentation-common` 으로 통과
  - `spec-code-paths.test.ts`: `status ∈ {partial, implemented}` 의 `code:` ≥1 매치 — 4개 glob 모두 실존 파일 매치 (확인 완료)
  - `spec-status-lifecycle.test.ts`: `implemented` 의 `pending_plans:` 없음 — 통과
  - `spec-pending-plan-existence.test.ts`: `pending_plans:` 없음 — N/A
- 다른 spec 영역 영향: `id` 변경은 다른 spec 의 cross-link 가 `presentation/0-common.md` 경로 기반이라 영향 없음 (`id` 는 frontmatter 식별자, 본문 cross-link 는 파일 경로 기반).
- consistency-check W1/W2 (WS spec §4.4 `buttonConfig.timeout` / `nodeOutput.type`) 는 별도 plan `spec-drift-ws-button-config.md` 가 추적 중 — 본 PR 변경과 직교. `implemented` 승격 외형이 *"완료 완결"* 로 오해되지 않도록 `0-common.md §9 CHANGELOG` 항목에 *"WS §4.4 와의 C2/C3 drift 는 별도 plan 추적 중"* 노트를 함께 기재 (I3 해소).
- 다른 카테고리 `0-common.md` 6 개의 `id: common` 중복 잔존은 본 PR 범위 외 — 별도 후속 plan 추적 (I2). 본 PR 은 `presentation` 카테고리 한정.

## 절차

- [x] draft 작성
- [x] `/consistency-check --spec` 호출 → BLOCK:NO 확인 (`review/consistency/2026/05/25/16_11_28/SUMMARY.md`)
- [x] spec 본문 반영 (`spec/4-nodes/6-presentation/0-common.md` frontmatter + §9 CHANGELOG)
- [x] plan complete + commit
- [x] 본 PR push

## 담당

project-planner 역할. PR `telegram-carousel-button-click-5b52c1` 안에 묶어 머지.
