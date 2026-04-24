# Node schema audit — follow-up 목록

2026-04-24 audit 에서 발견된 이슈 중 이번 커밋 범위 밖으로 넘긴 항목.
완료된 조치는 아래 "이미 조치됨" 섹션 참고.

## 이미 조치됨 (A 범위)

- `switch.caseDefSchema` 에 `id` 필드 추가 (resolver 가 이미 `c.id || case_${i}` 로 동작하므로 스키마만 보강).
- `send-email.subject` / `body` 에 `.default('')` 추가 — UI 빈 필드 렌더 안정화 + LLM "선택 사항이니 생략 가능" 오인 차단.

## 재평가로 이번 대상에서 제외됨

- `workflow.workflowId` 의 `.default('')`: 다른 `*-selector` 필드와 shape 이 다르지만, 모든 소비자 (`flow-configs.tsx` · `workflow.handler.ts` · `detectPendingUserConfig.isEmptyValue`) 가 빈 문자열 / undefined 를 동치로 처리하도록 이미 방어되어 있어 기능적 문제 없음. `.default('')` 유지. (2026-04-24 사용자 확인)

## Follow-up

### F-1 (HIGH) text-classifier stable id 마이그레이션

**문제**: `categoryDefSchema` 에 `id` 필드 없음. LLM/UI 관점에서는 category 마다 고유 id 가 있는 게 자연스럽지만 현재는 인덱스 기반 `class_${i}` 로만 동작.

**스코프** (스키마 한 줄이 아님):
1. `backend/src/nodes/ai/text-classifier/text-classifier.schema.ts` — `categoryDefSchema` 에 `id: z.string().optional().meta({ ui: { label: 'ID', widget: 'text', hidden: true } })` 추가 (ai_agent `conditionDefSchema.id` 패턴 참고).
2. `backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts` — `classifierCategoriesPorts` 를 `c.id && c.id.length > 0 ? c.id : 'class_${i}'` 로 수정.
3. `backend/src/nodes/ai/text-classifier/text-classifier.handler.ts:324,402` — `class_${portIndex}` 하드코딩을 `c.id` 우선 로직으로 교체. 라우팅 단에서 category → port id 매핑 테이블 필요.
4. Legacy 호환: 기존 canvas 에 이미 `class_0` edge 가 붙은 워크플로가 있다면 resolver 가 여전히 `class_${i}` fallback 을 내려줘 기존 edge 가 끊기지 않아야 함. "id 없으면 class_${i}" 로직이 그 역할.
5. 테스트: `text-classifier.handler.spec.ts` 의 `class_0`/`class_1` 하드코딩 다수. 새 시나리오 (custom id 설정) 를 추가하고, 기존 legacy 시나리오도 유지.
6. system-prompt 는 이미 "categories 에 id 지정 권장" 문구가 있어 추가 문서 동기화 불필요.

**발동 조건 (이 항목이 급해지는 트리거)**: 사용자가 category label 을 수정한 뒤 edge 가 깨지거나, LLM 이 system-prompt 의 id 안내를 따라 `cases[*].id` 처럼 classifier category 에도 custom id 를 지정하려다 스키마에서 strip 되는 문제를 보고할 때.

### F-2 (MEDIUM) carousel / chart / table / template 버튼 `id` 정책 결정

현재 `buttons[*].id` 가 `.optional()` 이라 누락 시 resolver 의 `btn_0` fallback 이 생성된다. spec §8 의 "custom id 권장" 과는 정합. required 로 바꿀지는 spec 개정 영역 (project-planner 경유). 현실 위험: 사용자가 label 만 수정하고 id 공란이면 fallback index 가 재배치되며 edge 깨질 수 있음.

조치 후보:
- (a) Schema 는 그대로 `.optional()` 유지하되, shadow-workflow 의 `add_node` / `update_node` 에서 **id 가 공란이면 auto-generate slug (label 기반)** 해 config 에 삽입. 이후 edit 은 안정적.
- (b) required 로 강제. LLM 프롬프트와 UI 에 강제 입력 요구. 기존 워크플로는 migration 필요.
- (a) 쪽이 하위 호환 우수, 복잡도 낮음.

### F-3 (MEDIUM) `form.optionSchema.value` default 누락

`backend/src/nodes/presentation/form/form.schema.ts` 의 select/radio 옵션. 현재 `z.unknown().optional()`. 기본값 없으면 UI 에서 새 옵션 추가 시 빈 입력 상태.

조치: `.default('')` 또는 `.default(null)` — form 필드 type 별 분기 필요할 수 있음.

### F-4 (MEDIUM) http-request `keyValueSchema` `.passthrough()` 누락

`backend/src/nodes/integration/http-request/http-request.schema.ts` 의 headers / queryParams / cookies 공용 schema. sub-field 에 `.passthrough()` 가 없어 향후 shape 변경 시 zod 가 엄격히 거부. 다른 노드 (form/carousel) 는 이미 `.passthrough()` 붙여놓았음.

조치: `keyValueSchema = z.object({...}).passthrough()` 로 보강.

### F-5 (LOW) `text-classifier.categoryDefSchema` 의 `name` / `description` default 누락

현재 `z.string().meta(...)` 만 있어 빈 입력 상태가 모호. 다른 노드의 label 필드는 대체로 `.default('')`. 통일성 회복.

조치: `name: z.string().default('')`, `description: z.string().default('')`.

---

## 우선순위

- **F-1**: 실제 버그 가능성 있으므로 **사용자 보고 발생 시 즉시** 처리. 그 전에는 미뤄도 현 기능 영향 없음 (index 기반으로 정상 동작).
- **F-2**: 사용자 UX 리스크 (label 수정 시 edge 깨짐) 가 실측되면. 현 spec §8 안내로는 LLM 도 id 를 붙여주므로 발생 빈도 낮음.
- **F-3 / F-4 / F-5**: 소소한 일관성 개선. 별도 문서 필요 없이 1~2줄 수정. 다른 bug-fix 때 끼워 넣어 진행 가능.
