---
worktree: button-cap-spec-validator
started: 2026-05-18
owner: developer
---

> **소유권 이전 (2026-05-19)**: 본 investigation plan 은 root cause 가 확정되어 `button-cap-spec-validator` worktree 의 fix PR 안에서 `complete/` 로 이동 처리한다 (동일 PR 내 chore commit). frontmatter `worktree` 를 fix PR 의 worktree 로 갱신.

# 프리젠테이션 노드 — 버튼 다수 설정 시 일부 누락 렌더링 조사

## 배경

사용자 보고: Carousel / Form / Table / Chart / Template 등 프리젠테이션 노드에 버튼을 다수 설정했을 때 일부 버튼만 화면에 렌더링된다. N 개 설정했는데 M (M < N) 개만 나타나는 형태.

본 티켓은 [node-config-required-defaults-sweep](./node-config-required-defaults-sweep.md) sweep 과는 별개의 작업이다. sweep PR 안에서는 본 티켓의 root cause 가 아직 확정되지 않았으므로 코드 변경을 하지 않는다 — 본 문서에 분석 + 다음 검증 단계만 기록.

## 조사 결과 요약 (2026-05-18)

데이터 흐름:

```
[설정 UI]
  button-list-editor.tsx        ← maxButtons=10 enforce, key={btn.id}
        ↓ (배열 저장)
[backend handler]
  carousel.handler.ts:150-173   ← truncate(items) 후 globalButtons + itemButtons 머지
                                  → allButtons + buttonItemMap 동봉
        ↓ (response payload)
[frontend renderer]
  button-config.ts:58-67        ← parseButtonConfig: 각 버튼 parseButtonDef 검증
                                  실패 버튼은 .filter(b !== null) 에서 silent drop
  presentation-renderers.tsx:525-600
                                ← buttonItemMap 에 속한 id 는 글로벌 바에서 제외
  button-bar.tsx:104-138        ← flex flex-wrap, key={btn.id}
```

## 유력 원인 후보 (확률 순)

| # | 후보 | 근거 파일:라인 | 메커니즘 |
|---|---|---|---|
| 1 | parseButtonConfig 의 URL 안전성 필터 | `frontend/.../button-config.ts:36, 58-67` | `link` 타입 버튼의 URL 이 `isSafeButtonUrl` 통과 못 하면 `parseButtonDef` 가 `null` → `.filter` 에서 조용히 제거. 상대경로·프로토콜 누락이 사용자 흔한 실수 |
| 2 | Carousel itemButtons 4개/아이템 제약 | `backend/.../carousel/carousel.schema.ts:313-350` | spec/구현 모두 "maximum 4 buttons per item". 5개 이상 설정 시 schema reject, 일부 저장 경로에서 부분 보존 발생 가능 |
| 3 | Output 1MB cap → tail item 잘림 | `carousel.handler.ts:156`, `truncate-output.util.ts:79-122` | items truncate 적용 후 그 item 의 itemButtons 자동 누락. 출력에 `itemsTruncated` 플래그 있음 |
| 4 | buttonItemMap dedupe overkill (id 충돌) | `presentation-renderers.tsx:542-544` | 글로벌 버튼이 itemButton id 와 우연히 겹치면 글로벌 쪽도 같이 제거 |
| 5 | CSS overflow | `button-bar.tsx:106` | `flex flex-wrap` 사용하므로 가능성 낮음, 부모 컨테이너 max-height 만 의심 |

## 다음 검증 단계 (재현 환경에서)

- [x] **A. payload 확인** — 정책 불일치 (frontend 10 / backend 4) 가 root cause 로 확정. 추가 재현 불요.
- [ ] **B. link 버튼 URL 형식 검사** — 별 follow-up (silent drop 차원, parseButtonConfig URL 안전성 필터)
- [x] **C. Carousel itemButtons 개수** — 사용자 보고 케이스가 5개 이상 itemButton 설정 → backend `validateCarouselItemButtons` 의 `>4` 조건으로 reject 또는 부분 저장. **본 PR (button-cap-spec-validator) 의 cap 5 통일로 해소.**
- [ ] **D. itemsTruncated/rowsTruncated 플래그** — 별 follow-up (output size cap 차원)
- [ ] **E. button id 중복** — 별 follow-up (renderer dedupe 차원)

**Root cause 확정 (2026-05-19)**: 후보 2 (Carousel itemButtons cap 4) + 정책 불일치 (frontend 10 vs backend itemButtons 4 vs 사용자 의도 5). 사용자 결정 ③ (frontend 5 + backend 5 통일) 로 fix 진행. 후보 1 / 3 / 4 / 5 는 본 PR 범위 외 — 사용자 재현 보고 시 재조사.

**Fix PR**: `button-cap-spec-validator` (worktree 동일명).

## 관련 파일 색인

- spec: `spec/4-nodes/6-presentation/0-common.md` §1 (ButtonDef), §1.1 (validation, max 10), §8 (output)
- backend
  - `codebase/backend/src/nodes/presentation/_shared/button.types.ts:1-108`
  - `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts:313-350`
  - `codebase/backend/src/nodes/presentation/carousel/carousel.handler.ts:150-173`
  - `codebase/backend/src/nodes/presentation/table/table.handler.ts:179-192`
- frontend
  - `codebase/frontend/src/components/editor/run-results/button-config.ts:36, 58-67`
  - `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:525-600`
  - `codebase/frontend/src/components/editor/run-results/button-bar.tsx:104-138`
  - `codebase/frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx:18-163`

## 본 티켓 완료 조건

- [x] 위 검증 단계 (A~E) 중 root cause 가 확정됨 — 후보 2 (carousel cap 비대칭)
- [x] fix 작업이 별도 worktree·PR 로 분리되어 머지됨 — `button-cap-spec-validator` PR #203 (2026-05-19 머지, commit `061af7c8`)
- [x] fix PR 링크가 본 문서 하단에 기록됨 (아래 §Closeout 참조). 후보 B / D / E 체크박스는 본 PR 범위 외 follow-up 으로 분리되어 본 plan close 시점에는 미체크 상태로 보존 (line 79 정책)

## Closeout (2026-05-22)

- **Fix PR**: [#203 `worktree-button-cap-spec-validator`](https://github.com/worker-ants/clemvion/pull/203) — 머지 commit `061af7c8` (2026-05-19).
  - backend `MAX_BUTTONS_PER_NODE = 5` 단일 상수 도입 (`codebase/backend/src/nodes/presentation/_shared/button.types.ts:45`)
  - frontend `button-list-editor.tsx` `maxButtons = 5` default
  - carousel `validateCarouselItemButtons` cap 4 → 5
  - spec `spec/4-nodes/6-presentation/0-common.md` §1.1 정합화
- **잔여 후보 (본 PR 범위 외)**:
  - B. `parseButtonConfig` URL 안전성 silent drop — 사용자 재현 보고 시 별 plan 신설
  - D. `itemsTruncated`/`rowsTruncated` 1MB cap → tail item 누락 — 사용자 재현 보고 시 별 plan 신설
  - E. `buttonItemMap` dedupe id 충돌 — 사용자 재현 보고 시 별 plan 신설

본 PR (button-cap-spec-validator) 머지에 따라 `plan/complete/` 로 `git mv` (본 chore commit). 후보 1/3/4/5 는 별 follow-up plan 신설 시점에 분리 가능.
