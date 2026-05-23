---
worktree: render-form-options-and-state-fix-d72e6d
started: 2026-05-23
owner: developer
---

# render_form 옵션 collision + DynamicFormUI 상태/타입 안정화

## 배경

사용자 보고 (2026-05-23): AI Agent 의 `render_form` 으로 그려진 폼에서:

- "select 항목을 선택할 수가 없어. 선택한 후에도 초기값으로 적용돼."

진단 (worktree analysis):

**핵심 원인** — `presentation/form/form.schema.ts:13` 의 `optionSchema.value: z.unknown().default('')`. LLM 이 옵션 emit 시 `value` 를 빼먹으면 zod default 가 **모든 옵션의 value 를 빈 문자열 `""`로 통일** → `<option value="">Select...</option>` placeholder 와 모든 옵션이 DOM 상 동일 value → 클릭해도 시각적으로 placeholder 가 유지됨. PR #279 의 `button.id` UUID backfill 과 동형 문제.

부가 발견 (form 전체 점검):

| # | 영역 | 문제 | 위험도 |
|---|---|---|---|
| 1 | `option.value` collision | 핵심 원인 (위) | HIGH |
| 2 | DynamicFormUI state remount | `isWaitingForm && resolvedFormConfig` 조건이 WS 이벤트 단위 flicker → `useState` 초기값 리셋 | HIGH |
| 3 | `number` 빈 입력 → 0 | `Number("") === 0` 자동 0 강제 → 사용자가 비우는 의도 손실 | MED |
| 4 | `select`/`radio` type drift | `value: z.unknown()` 허용 (number/bool 가능), DOM 은 string 강제 → 비교 실패 | MED |
| 5 | `defaultValue` 재진입 stale | `useState` initializer 가 첫 마운트에만 실행 — backend 가 새 defaults 보내도 local state 미반영 | MED |
| 6 | `file` 타입 미구현 | spec `formFieldSchema` 는 `file` 허용하나 `renderField` switch 에 case 없음 → text input 으로 fallback | MED |
| 7 | required 검증 부족 | HTML attribute 만 의존 — 브라우저 차이로 빈 제출 가능 | LOW |

## 사용자 결정 (2026-05-23)

> 한개의 pr로 전부 진행해

→ S/A/C 3계층을 한 PR 에 묶음. follow-up 분리 없이 본 PR 안에서 처리.

## 변경 범위 (S/A/C 3축)

### (S) spec

- `spec/4-nodes/6-presentation/0-common.md` §10.5 backfill 단계 본문에 form `option.value` backfill 추가 항목 1줄 + Rationale 1단락 (PR #279 button.id backfill 과 평행 결정 근거).
- `spec/4-nodes/6-presentation/4-form.md` (또는 0-common 안 §10.5 만으로 충분하면 별도 변경 없음 — project-planner 판단). 다음 사항 명문화:
  - LLM tool 모드의 옵션 정규화 — `value` 누락 시 결정적 fallback (`opt-{idx}-{slug(label)}` 또는 `opt-{idx}`) 생성.
  - file 타입 input UI 처리 (현재 spec 은 file 허용하지만 UI 동작 미정).
- §9 CHANGELOG 2026-05-23 항목.

### (C) backend

- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`
  - `backfillFormOptionValues(payload: Record<string, unknown>)` helper 신설 — `fields[].options[].value` 의 빈 문자열·null·undefined 를 결정적 fallback (`opt-{fieldIdx}-{optIdx}` 또는 `opt-{optIdx}-{slugify(label)}`) 으로 채움.
  - `execute()` 안 cap 이후 `backfillButtonUuids` 와 동일 위치에서 `type === 'form'` 시 `backfillFormOptionValues` 호출.
- `codebase/backend/src/nodes/presentation/form/form.schema.ts` — `optionSchema.value` 의 zod default 동작 명시 (`z.unknown().optional()` 로 변경 검토 — backfill 책임을 render-tool-provider 로 일원화). 단, 그래프 노드 본체 path 호환성 확인 필요.
- `render-tool-provider.spec.ts` — backfill 테스트 (옵션 모두 빈 value → 모두 unique fallback / 일부 값 있음 보존 / file 필드 무관 etc).

### (A) frontend

- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`
  - **(A1) state 안정화** — 호출 측 (`page.tsx`, `result-detail.tsx`) 에서 `<DynamicFormUI key={waitingNodeId} ... />` 로 mount/unmount 만 의도된 시점에 일어나게. 또는 `useState` 를 `useEffect` 로 defaults sync 패턴 도입 검토.
  - **(A2) number 보존** — empty string 입력시 `""` 그대로 보존 (또는 별 `null` sentinel). `Number()` 강제 변환 제거.
  - **(A3) value coerce** — select/radio 비교에서 `String(value) === String(opt.value)` 로 정규화. submit 시 원래 옵션 value 타입 복원이 필요하면 lookup 후 복원, 아니면 string 으로 전송.
  - **(A4) file 케이스** — `<input type="file" multiple={maxFiles > 1} accept={allowedMimeTypes.join(",")}>` 추가. 제출 데이터 형식은 spec §form 결정 필요 (file → 일반 FormData 흐름 아닌, render_form 은 form_submitted JSON 으로 LLM 에 회신하는 흐름 → file 의 어떤 표현을 넣을지 spec 확정 후).
- 테스트:
  - `dynamic-form-ui.test.tsx` 신규
  - field type 매트릭스: text / textarea / number / email / date / select / radio / checkbox / file (file 케이스는 spec 결정 후)
  - select option value 빈 문자열 — placeholder 와 구분 가능한 fallback (`opt-{idx}`) 적용 후 클릭 → 정상 selection
  - 부모 remount 회피 (key=waitingNodeId)
  - number 빈 입력 보존

## TDD 체크리스트

- [x] (S) project-planner 위임 — §10.5 step 4 신설 + §1.5 신설 (commit `e402d017`)
- [x] (S) `/consistency-check --spec` BLOCK:NO 확인
- [x] (S) spec commit (`e402d017`)
- [x] (impl-prep) `/consistency-check --impl-prep spec/4-nodes/` BLOCK:NO
- [x] (C) backend `backfillFormOptionValues` test 선작성
- [x] (C) backend helper + execute() 통합 (commit `f40d6130`)
- [x] (C) backend test PASS (50/50)
- [x] (A) frontend test 선작성 (4-fix 모두)
- [x] (A) frontend DynamicFormUI 구현 (commit `145b1ced`)
- [x] (A) frontend test PASS (9/9)
- [x] (8) TEST WORKFLOW — lint / unit 4555 / build / e2e 98 PASS
- [x] (9) REVIEW WORKFLOW — `/ai-review` + resolution-applier (review/code/2026/05/23/15_27_41) + spec drift fix (commit `8293e73c`)
- [x] (10) PR 생성

## 결정 메모

- **함수명 `backfillFormOptionValues`** — PR #279 의 `backfillButtonUuids` 와 평행 명명. 그래프 노드 본체용 `normalizeNodeButtonIds` 와 구분.
- **fallback 형식** — `opt-{idx}-{slug(label)}` 시도, slug 가 비면 `opt-{idx}` 만. 결정적 (UUID 아님) — LLM 이 후속 turn 에서 submitted value 를 의미적으로 인식 가능하도록.
- **file 타입** — spec 미정. project-planner 가 결정 시 본 PR 에서 구현. 만약 결정 지연되면 보류로 명시 후 별 plan.
- **number 빈 입력 보존** — 데이터 무결성 우선. 단, FormSubmittedContent (LLM 에 회신되는 데이터) 가 string 으로 받으면 LLM 해석 가능. 강제 변환 제거.

## Follow-up (별 plan)

본 PR 안에서 모두 일괄 처리:

- ai-review 후속 spec drift (slug variant 정합화) — `plan/complete/spec-fix-form-option-backfill-slug.md` (commit `8293e73c`)

향후 강화 후보 (별 task, 본 PR scope 밖):

- DynamicFormUI 클라이언트 측 파일 MIME/크기/개수 검증 강화 (spec §1.5 요구)
- file.name LLM-side sanitize (prompt injection 잠재 경로)
- backfillFormOptionValues object-type option value 추가 가드

## Closeout (2026-05-23)

본 worktree 작업 완료. commit chain:

- spec: `e402d017` — §10.5 step 4 + §1.5 신설
- backend: `f40d6130` — backfillFormOptionValues + execute() 통합
- frontend: `145b1ced` — DynamicFormUI 4-fix (state/number/coerce/file)
- ai-review fix: `dc2d3cd8` — SUMMARY#2-#7 후속 (key fallback / 헬퍼 추출 / 테스트)
- RESOLUTION: `eebb597c`
- spec drift 정정: `8293e73c` — slug variant 제거 (W#1)

TEST 최종: lint PASS / unit 4555 PASS / build PASS / e2e 98 PASS.
PR: https://github.com/worker-ants/clemvion/pull/285
