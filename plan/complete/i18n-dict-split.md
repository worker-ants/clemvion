---
worktree: i18n-dict-split-70d366
started: 2026-05-16
owner: developer
---

# i18n dict 파일을 섹션 단위로 split

## 배경

`frontend/src/lib/i18n/dict/{ko,en}.ts` 가 각각 2,385 / 2,391 줄로 비대해졌다. 같은 파일에 22 개의 top-level 섹션 (common, sidebar, auth, ..., editor, nodeConfigs, integrations, ...) 이 한 객체로 모여 있어, 병렬 PR 이 각자 다른 섹션에 키를 추가할 때마다 **공유 closing brace** 패턴의 충돌이 빈발한다.

오늘 하루만 dict/{ko,en}.ts 를 동시에 확장한 PR — #66 (warning-msg), #69 (node-label), #71 (result-detail), #72 (llm-info-tab), #73 (conv-inspector) — 5건. PR #69/#72 는 rebase 시 충돌이 발생해 수동 해결이 필요했다.

## 목표

같은 top-level 섹션 안의 sub-object 추가가 **하나의 섹션 파일** 만 건드리도록 한다. 다른 섹션을 손대는 병렬 PR 과는 파일 경로 자체가 분리되어 충돌이 발생할 수 없다.

## 분리 구조

```text
frontend/src/lib/i18n/dict/
├── ko/
│   ├── index.ts          # 22 섹션 import → export const ko = {...} as const
│   ├── common.ts
│   ├── sidebar.ts
│   ├── auth.ts
│   ├── profile.ts
│   ├── workspace.ts
│   ├── invitations.ts
│   ├── dashboard.ts
│   ├── workflows.ts
│   ├── editor.ts         # conversation·runResults·llmInfo 등 sub-object 다수
│   ├── nodeConfigs.ts    # 가장 큰 섹션 (~533 줄)
│   ├── triggers.ts
│   ├── schedules.ts
│   ├── integrations.ts
│   ├── knowledgeBases.ts
│   ├── llmConfigs.ts
│   ├── authentication.ts
│   ├── statistics.ts
│   ├── executions.ts
│   ├── docs.ts
│   ├── time.ts
│   ├── errors.ts
│   └── assistant.ts
├── en/                   # ko 와 동일한 22 섹션 구조
│   ├── index.ts
│   └── *.ts (× 22)
└── types.ts              # `Dict = WidenString<typeof ko>` — 그대로
```

## 호환성

기존 import 경로는 **변경 없이 그대로 작동**한다 — Node/Webpack 모듈 해석이 `./dict/ko` 를 `./dict/ko/index.ts` 로 자동 매핑.

| 호출 위치 | import 경로 |
| --- | --- |
| `frontend/src/lib/i18n/core.ts` | `from "./dict/ko"` / `from "./dict/en"` / `from "./dict/types"` |
| `frontend/src/lib/i18n/__tests__/i18n.test.ts` | `from "../dict/ko"` / `from "../dict/en"` |

## 타입 보존

- `ko/<section>.ts`: `export const <section> = { ... } as const;` — literal 타입 보존
- `ko/index.ts`: 22 import 후 `export const ko = { common, sidebar, ... } as const;` — composite 도 `as const`
- `en/<section>.ts`: `export const <section>: Dict["<section>"] = { ... };` — Dict 의 해당 키 shape 와 강제 매칭
- `en/index.ts`: `export const en: Dict = { common, sidebar, ... };` — 전체 Dict shape 와 강제 매칭

> en 측이 section 단위로 Dict["section"] 타입 annotation 을 가지면, 각 섹션 파일 단독으로도 type-check 가 강제된다. 한쪽 sub-key 누락 시 해당 섹션 파일에서 즉시 fail. parity 가드 (i18n.test.ts) 와 합쳐서 2중 안전망.

## 실행 단계 (phase)

### Phase 1 — 분리 plan + 스크립트 (본 plan)

- [x] 본 plan 작성
- [x] `scripts/split-i18n-dict.py` 작성 — 22 섹션을 line range 기반으로 추출, 파일 출력. one-time tool.
- [x] 스크립트 실행, 새 디렉토리 생성

### Phase 2 — 검증 + 원본 제거

- [x] 줄 수 합산 검증 — ko: 2385 → 2430, en: 2391 → 2479 (header 와 import overhead 만큼 증가, 컨텐츠 변화 없음)
- [x] lint clean / `tsc --noEmit` clean / `npm test` 1392/1392 pass / `npm run build` 통과
- [x] 원본 `dict/ko.ts`·`dict/en.ts` 삭제 (모듈 해석은 `index.ts` 로 자동 fallback 확인됨)

### Phase 3 — 문서 동기화

- [x] `.claude/skills/developer/SKILL.md` DOCUMENTATION 매핑 갱신 — "신규 UI 문자열" 행의 경로를 `dict/{ko,en}/<section>.ts` 로 정정 + i18n dict 컨벤션 블록 신설
- [x] plan/in-progress → plan/complete 이동 (Phase 모두 끝난 뒤)

## 비변경 영역

- `frontend/src/lib/i18n/dict/types.ts` — `Dict = WidenString<typeof ko>` 로직 그대로. `./ko` 가 디렉토리로 바뀌어도 import 의미 보존.
- `frontend/src/lib/i18n/core.ts` — import 경로 그대로.
- 기존 키 / 값 / interpolation 문법 — 모두 그대로. 본 PR 은 순수 file split.

## 위험과 대응

- **위험 1**: section 파일에서 `as const` 누락 → literal 타입 widening 으로 `Dict` 구조가 흐려짐.
  - **대응**: ko 측 section 은 모두 `as const`. CI 의 ko↔en parity 테스트가 결손 시 fail.
- **위험 2**: 분리 스크립트의 line-range 파싱 오류로 일부 항목 누락.
  - **대응**: 분리 후 줄 수 합산 비교 + ko↔en parity 테스트 + 빌드. 3중 검출.
- **위험 3**: en 의 `Dict["section"]` 타입 annotation 이 일부 section 에서 작동 안 함 (e.g. mapped types).
  - **대응**: en index.ts 의 `: Dict` 가 최종 shape 를 강제하므로 section 단위 annotation 은 보강용. 문제 시 section annotation 만 제거하고 index.ts 의 `: Dict` 로만 typing.
