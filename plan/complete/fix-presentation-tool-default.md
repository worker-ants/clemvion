---
worktree: fix-presentation-tool-default-dcecc3
started: 2026-06-03
owner: developer
status: complete
pr: 438
---

# presentationTools 첫 옵션 미선택 저장 시 빈 객체(`{}`) 영속화 버그 수정

## 배경 / 증상

런타임 WARN 반복:

```
WARN [RenderToolProvider] Skipping presentation tool with invalid/missing type: undefined
```

AI Agent 노드 config 의 `presentationTools[0]` 이 `{"type":"table"}` 가 아니라 `{}` 로
저장됨. 나머지 4개(chart/carousel/template/form)는 정상. `table` 은 select 의 **첫 옵션**이라
사용자가 드롭다운을 바꾸지 않으면 onChange 가 발화되지 않아 폼 상태에 값이 안 들어감.

## 근본 원인 (uncontrolled-default 미초기화)

1. `ai-agent.schema.ts` 의 `presentationToolDefSchema.type` = `z.enum(...)` — `.default()` 없음
   → JSON Schema 에 `default` 키 부재.
2. `widgets.tsx::buildNewItem` 는 `field.default !== undefined` 인 필드만 초기화 → `type` 누락 →
   새 행이 `{}` 로 append.
3. `SelectWidget` 가 `value ?? ""` 로 전달, `SelectField` 의 native `<select>` 에 `value=""`
   매칭 옵션이 없어 브라우저는 첫 옵션(table)을 **시각적으로만** 표시 → 사용자가 안 건드리면
   onChange 미발화 → `type` 영영 미저장.

> 선례: presentation `spec/4-nodes/6-presentation/0-common.md §10.5 step 4` (form option.value
> 결정적 backfill) 가 동일한 native `<select>` placeholder 충돌 클래스를 normalization
> 레이어에서 해소. 본 수정은 그 인식과 정합적.

## 수정 (2 레이어)

- [x] (1) Backend: `ai-agent.schema.ts` `type` enum 에 `.default('table')` 추가 →
  JSON Schema `default:'table'` 노출 + zod parse 시 absent→table 보정.
- [x] (2) Frontend 범용 안전망: `buildNewItem` 에 `.default` 없는 scalar enum/select 필드를
  resolveWidgetOptions 의 첫 옵션 값으로 초기화하는 폴백 추가 (array/object 제외) — default
  없는 다른 노드 select 들의 동일 버그도 차단.

## 테스트

- [x] Backend `ai-agent.schema.spec.ts`: `parse({presentationTools:[{}]})` → type='table',
  JSON Schema items.type.default==='table'. 기존 `rejects unknown type`/`duplicate` 테스트는
  영향 없음(default 는 absent 에만 적용).
- [x] Frontend `__tests__/widgets.test.ts`: buildNewItem 폴백 — enum 첫값 초기화,
  explicit default 보존, array(multiselect) 미적용, text 미적용, required id UUID 보존.
- [x] 기존 `render-tool-provider.spec.ts` 의 type:undefined skip 회귀 테스트는 defense-in-depth
  로 유지 (ctx 직접 구성이라 무관, 그대로 통과).

## 일관성 / 문서 영향

- spec write 없음. 필드/라벨/enum값 추가 아님(default 추가만) → doc-sync 매트릭스 동반 갱신 불요.
- spec 필드 테이블은 `type` 을 required(✓)로 표기하고 default 컬럼 자체가 없음. `.default('table')`
  은 데이터 무결성 안전망이라 사용자 가시 의미를 바꾸지 않음. 향후 project-planner 가 필드
  테이블에 "(기본 table)" 명기를 검토할 수 있으나 본 PR 범위 밖.

## 워크플로 체크리스트

- [x] 집중 impl-prep 일관성 검토(수동: Rationale 연속성·naming·convention) — 충돌 없음
- [x] lint (backend+frontend+web-chat) — PASS (worktree 부트스트랩: packages/sdk·expression-engine
  자체 node_modules/dist 선빌드 필요했음. lint `--fix` 가 건드린 범위 밖 기존 파일 6건은 revert)
- [x] unit — PASS (backend 290 suites/5585, frontend 177 files; 신규: backend schema 2건,
  frontend widgets 8건)
- [x] build — PASS
- [x] e2e — PASS (143 tests, docker compose 실 인프라; 리뷰 반영 후 재통과)
- [x] /ai-review + SUMMARY — RISK=LOW, Critical 0, Warning 2 (둘 다 Testing). Warning 2 +
  저비용 INFO 3건(#2 drift-free 리터럴·#4 배열 타입 방어·#9 partial itemDefault) 수동 조치.
  RESOLUTION.md 기록. INFO #1(spec type default 명기)은 spec write 라 project-planner follow-up.
