---
worktree: loop-count-policy
started: 2026-05-19
owner: developer
---

# Loop count default 정책 명문화 + dead warningRule 제거

## 배경

`spec/4-nodes/1-logic/3-loop.md` 의 `count` 는 `default('1')` 이라 zod parse 시 빈 값이 `'1'` 로 채워진다.
그 결과 backend 의 `loop:no-count` warningRule (`when: '!count'`) 는 발화 경로가 없는 **dead rule** 이다.

ai-review W-1 / consistency-check I-1 지적사항. node-config-required-defaults-sweep PR (#188, 2026-05-18 머지 완료) 의 후속 follow-up — base 는 머지 직후 main.

## 결정 (사용자, 2026-05-19)

② `default('1')` 유지 + warningRule 제거 + spec Rationale "최소 반복 1회 정책" 명문화.

근거:
- `default('1')` 변경 시 신규 노드 default UX 가 빈 input 으로 노출 — 의미 있는 동작 부재
- `'1'` 은 "한 번 반복" 으로 의미 있는 fallback (loop 노드 본래 목적)
- `ui.required: true` 로 UI 상 비울 수 없음을 표시 (asterisk)
- 빈 값이 어떤 경로로 들어와도 zod default 가 채움 → warningRule 발화 경로 없음

## 작업 항목

> 모든 변경은 **단일 commit** 에 묶는다 — schema 의 warningRule 삭제 ↔ i18n 매핑 삭제는 i18n Principle 3 가드(삭제 방향 포함)가 동일 PR 안에서 통과해야 안전. spec 섹션 갱신, 테스트 갱신, plan 마킹 모두 같은 변경 단위.

- [x] plan 생성
- [x] `loop.schema.ts` — warningRules 에서 `loop:no-count` 제거, 관련 주석 갱신
- [x] `loop.schema.spec.ts` — `describe('loop:no-count')` 제거, `evaluateMetadataBlockingErrors` 테스트 갱신
- [x] `loop.handler.spec.ts` — "rejects missing count" 테스트 갱신 (zod default 적용 후 valid 가 정확한 동작)
- [x] `execution-engine.service.spec.ts:4506` 주석에서 `loop:no-count` 참조 제거
- [x] `frontend backend-labels.ts:328` — `"Count must be entered."` ko 매핑 제거
- [x] `spec/4-nodes/1-logic/3-loop.md`:
  - L13 표의 `count` 행에 Rationale 참조 단문 추가
  - L170 에러 코드 표에서 "count 미설정" 행 **전체** 제거 — warningRule + handler.validate 양 경로 모두 zod default 로 인해 발화 불가
  - §8 Rationale 섹션 신설 — "최소 반복 1회 정책"
- [x] 본 sweep plan `node-config-required-defaults-sweep.md` 후속 follow-up 섹션에서 A 항목·loop Rationale 항목을 "→ loop-count-policy 로 분리" 로 마킹
- [x] consistency-check 통과 (BLOCK: NO, WARNING 2건은 본 PR scope 외 또는 frontmatter ↔ 디렉토리 일치로 동작상 OK)
- [x] tests + lint + typecheck (loop 관련 21 tests pass, 변경분 lint clean, 변경 파일 type-clean. pre-existing typecheck errors 는 본 PR 범위 외)
- [x] /ai-review (LOW 위험도, Critical 0, WARNING 4 / INFO 9 → 6 즉시 fix, 3 추적/scope 외; RESOLUTION.md)
- [ ] PR merge (#192)
- [ ] `git mv plan/in-progress/loop-count-policy.md plan/complete/`

## 후속 (별 plan/PR)

- **loop output.count 3중 문서 정합화** — `node-output.md §9.2`·`0-common.md §9.1/§11` 의 loop 행이 `{ iterations, count }` 로 명시하나 `3-loop.md §5.2` 는 Principle 1.1 (config↔output 직교) 사유로 `count` 제외. 본 PR 의 consistency-check W-1. 본 PR 의 scope ("loop.count default 정책") 와 별 사안 — `node-output.md`·`0-common.md` 의 loop 행에서 `count` 제거하는 별 정합화 PR 로 분리.
- **plan frontmatter worktree slug 컨벤션 정착** — 본 PR 은 `EnterWorktree(name="loop-count-policy")` 로 slug 없이 생성됨. frontmatter ↔ 디렉토리명 일치하므로 plan_coherence 추적 측면은 OK 이나 CLAUDE.md 의 `<task_name>-<slug>` 권장 미준수. EnterWorktree 호출 시점 자동 slug 부여 또는 컨벤션 완화 결정은 별 정리.

## 관련 문서

- 원 sweep plan: [`node-config-required-defaults-sweep`](./node-config-required-defaults-sweep.md)
- ai-review 산출물: `review/code/2026/05/18/23_11_13/SUMMARY.md` W-1
- consistency-check (sweep) 산출물: `review/consistency/2026/05/18/23_26_44/SUMMARY.md` I-1
- consistency-check (본 PR) 산출물: `review/consistency/2026/05/19/07_35_34/SUMMARY.md`
