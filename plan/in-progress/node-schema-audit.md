# Node schema audit — follow-up

> 2026-04-24 audit / 2026-05-05 사용자 결정 + 코드 재검증 후 전면 재작성.
> 이후 구현 단계 진행 시 본 문서를 같은 turn 안에 갱신해 drift 가 누적되지 않도록 한다.

---

## Context

2026-04-24 schema audit 의 후속 항목 4건(F-1~F-4) 이 미해결로 남아 있었으나, 그 사이 표면 갱신 없이 시간이 흘러 plan 표면(체크박스/문구)과 코드 ground truth 간 drift 가능성이 의심됐다. 2026-05-05 코드 재검증 결과 4건 모두 STILL_VALID 로 확인됐고, 일부 항목은 영향 범위가 audit 시점보다 넓다는 사실이 추가로 드러났다. 본 문서는 그 재검증 결과 + 사용자 결정 + 미해결 우려를 토대로 작성된 실행 계획이다.

---

## 이미 조치됨 (재확인 2026-05-05)

- `switch.caseDefSchema.id` (regex + max(64) + optional + meta hidden) — `switch.schema.ts:13-18` 그대로 보존 ✅
- `send-email.subject` / `body` 의 `.default('')` — `send-email.schema.ts:115-122` 그대로 보존 ✅

## 재평가로 이번 대상에서 제외됨

- `workflow.workflowId` 의 `.default('')`: 다른 `*-selector` 필드와 shape 이 다르나 모든 소비자(`flow-configs.tsx` · `workflow.handler.ts` · `detectPendingUserConfig.isEmptyValue`) 가 빈 문자열 / undefined 를 동치 처리해 기능적 문제 없음. `.default('')` 유지 (2026-04-24 사용자 확인).

---

## 재검증 스냅샷 (2026-05-05)

| 항목 | 상태 | 위치 |
|------|------|------|
| F-1.1 categoryDefSchema.id 부재 | ✅ DONE 2026-05-05 (f92ba0f) | text-classifier.schema.ts categoryDefSchema |
| F-1.2 name/description default 부재 | ✅ DONE 2026-05-05 (f92ba0f) | text-classifier.schema.ts categoryDefSchema |
| F-1.3 handler `class_${i}` 하드코딩 2곳 | ✅ DONE 2026-05-05 (f92ba0f, e2ac50b) | text-classifier.handler.ts buildCategoryPortIds |
| F-1.4 resolver fallback 미구현 | ✅ DONE 2026-05-05 (f92ba0f, e2ac50b) | resolve-dynamic-ports.ts classifierCategoriesPorts |
| F-1.5 테스트 하드코딩 7곳 | ✅ DONE 2026-05-05 (f92ba0f) — legacy 시나리오로 보존, custom id 신규 시나리오 추가 | text-classifier.handler.spec.ts |
| F-1.6 system-prompt 잘못된 그룹핑 | ✅ DONE 2026-05-05 (ee98449) — text_classifier 별도 라인, information_extractor 제거 | system-prompt.ts:230-235 |
| F-1.7 information_extractor 의 conditions 부재는 의도된 설계 | ✅ DONE 2026-05-05 (ee98449) — system-prompt 그룹에서 제거, 별도 단락에 mode-based system ports 안내 | system-prompt.ts:236 |
| F-2.1 4 노드 buttons[*].id optional | ✅ DONE 2026-05-05 (828509b) — schema 는 그대로(.optional) 두되 shadow 가 자동 부여 | carousel/chart/table/template 동일 buttonDefSchema |
| F-2.2 fallback 패턴 3종 | ✅ DONE 2026-05-05 (828509b) — label 비면 prefix index fallback, label 있으면 kebab-slug | resolve-dynamic-ports.ts (resolver) + button-slug.util (handler/shadow) |
| F-2.3 shadow auto-generate 미구현 | ✅ DONE 2026-05-05 (828509b) — addNode/updateNode 가 normalizeNodeButtonIds 호출, 기존 id 보존 | shadow-workflow.ts |
| F-2.5 spec §8 buttons[*].id 행 부재 | ✅ DONE 2026-05-05 (828509b) — §8 워크플로우 조립 규칙 cell 에 buttons 자동 부여 정책·기존 id 보존·마이그레이션 노트 추가 | spec/3-workflow-editor/4-ai-assistant.md §8 |
| F-3 form.optionSchema.value default 부재 | ✅ DONE 2026-05-05 (a2ee8f6, f3ad430) | form.schema.ts optionSchema |
| F-4 keyValueSchema.passthrough 부재 | ✅ DONE 2026-05-05 (a2ee8f6, f3ad430) — CRLF 방어까지 보강 | http-request.schema.ts keyValueSchema |

### 의도 확정 (2026-05-05)

- `ai_agent` 만 `conditions` 필드 보유 (분기 dispatch 용).
- `text_classifier` 는 `categories` 필드 사용, `conditions` 없음 — 정상.
- `information_extractor` 는 `conditions` / `categories` 둘 다 없음 — 정상. 동적 포트는 `info-extractor-mode` resolver 가 mode 별 시스템 포트(`completed`/`user_ended`/`max_turns`/`error` 또는 `out`/`error`)를 직접 발급. 사용자/LLM 이 설정할 id 필드 자체가 없다.

→ `system-prompt.ts:232` 의 `ai_agent / information_extractor / text_classifier → conditions[*].id` 그룹핑은 ai_agent 만 정확. F-1.6 수정 방향:
  - **ai_agent**: `config.conditions[*].id` (그대로 유지)
  - **text_classifier**: `config.categories[*].id` 별도 라인 신설 (F-1 결과로 categoryDefSchema 에 id 가 추가된 후)
  - **information_extractor**: 이 그룹에서 **완전 제거** (사용자 설정 id 필드 없음)

---

## 사용자 결정 (2026-05-05)

### F-1 (✅ 완료 2026-05-05)
1. ✅ id 스키마 패턴: switch 스타일 — `regex(/^[a-zA-Z0-9_-]+$/).max(64).optional() + meta(hidden)`
2. ✅ resolver fallback: `resolveStablePortId(c.id, \`class_${i}\`)` (공유 헬퍼, defense-in-depth 포함)
3. ✅ system-prompt: text_classifier 를 `config.categories[*].id` 별도 라인으로 분리, information_extractor 는 그룹에서 제거
4. ✅ 핸들러 라우팅: `buildCategoryPortIds()` 매핑 테이블 도입 + 공유 헬퍼 호출

ai-review 조치: review/2026-05-05_15-23-14/RESOLUTION.md (Warning 7 + Info 6).
부산물: backend/src/nodes/core/port-id.util.ts 신규 (switch/ai-agent 까지 trim 정책 통일).

### F-2 (✅ 완료 2026-05-05)
1. ✅ (a) shadow auto-generate slug 채택
2. ✅ slug 생성 규칙: **B-1 label-slug** (사용자 재확인 후 변경 — UUID 대신 kebab-case + 충돌 시 -2/-3 접미사. system-prompt 의 "Prefer short descriptive slugs" 권고와 일치)
3. ✅ spec §8 갱신 (단순 보강으로 처리 — 기존 dynamic-ports cell 에 buttons 자동 부여 정책·마이그레이션 노트 추가)
4. ✅ 적용 범위: `add_node` + `update_node`

부산물:
- backend/scripts/migrate-button-ids.ts — 기존 워크플로 빈 button id backfill (dry-run/apply)
- backend/src/nodes/core/button-slug.util.ts — labelToSlug, uniqueSlug, normalizeNodeButtonIds (재사용 가능)
- backend/src/nodes/core/port-id.util.ts 에 isValidStablePortId 추가 (button-slug 와 마이그레이션 스크립트 공통 출처)

ai-review 조치: review/2026-05-05_16-07-30/RESOLUTION.md (Warning 8 처리, 5 deferred).

### F-3 (✅ 완료 2026-05-05)
1. ✅ `value: z.unknown().default('')`
2. ✅ select / radio / checkbox 단일 default

ai-review 조치: review/2026-05-05_15-47-51/RESOLUTION.md.

### F-4 (✅ 완료 2026-05-05)
1. ✅ `keyValueSchema.passthrough()`
2. ✅ 부산물: CRLF 인젝션 방어 regex 추가 (review W-1 defense-in-depth)

---

## 우려사항 — 모두 해소됨 (2026-05-05)

§1 ✅ B-1 label-slug 채택 (사용자 재확인 결과). §2 ✅ migrate-button-ids.ts 작성 + RESOLUTION 안내. §3 ✅ normalizeNodeButtonIds 가 살아있는 id 보존. §4 ✅ form 만 default('') 적용으로 결정 (switch.caseDefSchema.value 일관성은 별도 audit 영역).

원본 우려 보존 (history):

## 우려사항 (구현 진입 전 재확인 권장)

### ⚠ §1 — UUID 결정이 system-prompt 명시 정책과 정면 충돌 (강함)

`system-prompt.ts:234`:
> Prefer short descriptive slugs (`case_refund`) over **UUIDs** so edges survive human edits.

LLM 에 "UUID 쓰지 말고 의미 있는 슬러그 써라"고 가르치는 동시에 shadow 가 자동으로 UUID 부여하면 정책 모순. 디버깅·읽기 어려움도 추가됨. spec §8 의 "사람 친화 의미 id" 지향(`btn_ai`, `btn_logic`)과 어긋남.

**대안**:
- (B-1) **label 기반 kebab-case 슬러그 + 충돌 시 `-2` 접미사** — 의미 보존, switch case_id 톤과 일치 (추천)
- (B-2) **nanoid(8자)** — 짧음, 의미 손실
- (B-3) **UUID 유지** + system-prompt "Prefer short descriptive slugs" 문구 약화/제거 (정책 일관성 회복)

→ **F-2 진입 전 사용자 재확인.** 본 plan 의 §F-2 구현부는 일단 (B-1) label-slug 채택을 가정해 작성하되, 결정에 따라 1~2 줄만 교체.

### ⚠ §2 — F-2 update_node 시 기존 워크플로 edge 깨짐 위험 (마이그레이션 필수)

기존 워크플로 canvas 에 id 비어있는 button entry 가 있으면 resolver 가 `btn_0` fallback 으로 edge 를 만든 상태. shadow auto-generate 가 새 slug 부여 시 button.id 와 edge.target_port 불일치하여 edge 끊김.

**필요 조치**:
- 일회성 backfill 스크립트 `backend/scripts/migrate-button-ids.ts`
- 모든 워크플로의 carousel/chart/table/template 노드 buttons 위치(`items[*].buttons[*]`, `itemButtons[*]`, `buttons[*]`) 순회, id 비어있는 entry 에 resolver 와 동일한 fallback id 부여
- dry-run / apply 분리, 실행 전 백업 권장
- 적용 시점: shadow auto-generate 코드 배포 전 또는 동일 release

### ⚠ §3 — F-2 update_node id 보존 정책

자동 부여 정책: **id 가 비어있을 때만 새 slug 생성, 기존 id 는 항상 보존**. 사용자가 label 만 수정해도 slug 가 재생성되지 않아야 edge 안정.

→ 구현 시 `normalizeButtonIds(buttons, prevButtons?)` 헬퍼에서 entry 매칭 후 prev.id 우선.

### ⚠ §4 — F-3 zod type 일관성 (낮음)

`z.unknown().default('')` 적용 후에도 type 은 unknown 이라 사용자가 후속에 boolean/number 입력 가능. 의도된 동작이나, `switch.caseDefSchema.value` 도 default 없는 `unknown().optional()` 이라 일관성이 깨짐.

→ 본 작업은 form 만 적용. switch.caseDefSchema.value 일관성 확장은 후속 audit.

---

## 구현 순서

| Step | 항목 | 우선 | 상태 |
|------|------|------|------|
| 1 | F-1 — text-classifier stable id (system-prompt 수정 포함) | HIGH | ✅ DONE 2026-05-05 (ee98449~e2ac50b) |
| 2 | F-3 + F-4 — 1줄 보강 묶음 | LOW | ✅ DONE 2026-05-05 (a2ee8f6~f3ad430) |
| 3 | F-2 — buttons 정책 (마이그레이션 + shadow + spec 보강) | MEDIUM | ✅ DONE 2026-05-05 (828509b~) — B-1 label-slug 채택 |

**모든 follow-up 완료**. 본 문서를 `plan/complete/node-architecture/` 로 이동 검토.

---

## Step 1: F-1 — text-classifier stable id

### SDD (문서/system-prompt 갱신)

- `backend/src/modules/workflow-assistant/prompts/system-prompt.ts:230-234` selector 정책 표:
  - 기존 `ai_agent / information_extractor / text_classifier → config.conditions[*].id` 라인 분해
  - **ai_agent**: `config.conditions[*].id` (그대로 유지)
  - **text_classifier**: `config.categories[*].id` 별도 라인 신설 (예: `cat_refund`)
  - **information_extractor**: 그룹에서 제거. 필요 시 별도 단락에 "mode-based system ports" 안내 1~2 줄 (선택).
- spec 갱신 필요성 점검: spec/3-workflow-editor/4-ai-assistant.md §8 "Selector 필드 정책" 표에 categories[*].id 항목이 없으면 추가. 기존 dynamic-ports row 안에 한 줄 보강이면 충분 — 별도 spec 신설 작업이 아닌 경우 같은 turn 안에 처리.

### TDD

- `text-classifier.handler.spec.ts`:
  - **신규** custom id 시나리오: `categories: [{ id: 'cat_refund', name: 'Refund', ... }, ...]` → 라우팅 결과 port id `cat_refund`
  - **신규** id 미설정 시 legacy fallback 시나리오: 기존 `class_0`/`class_1` 동작 유지 (회귀 방지)
  - **신규** id 가 공백 문자열일 때 trim → fallback 사용
- `resolve-dynamic-ports.spec.ts` 가 있으면 `classifierCategoriesPorts` 의 fallback 케이스 보강. 없으면 신설 여부 검토 (switchPorts 와 동일 시나리오).

### 구현

1. `backend/src/nodes/ai/text-classifier/text-classifier.schema.ts`
   - `categoryDefSchema.id` 추가:
     ```ts
     id: z
       .string()
       .regex(/^[a-zA-Z0-9_-]+$/)
       .max(64)
       .optional()
       .meta({ ui: { label: 'ID', widget: 'text', hidden: true } })
     ```
   - `name`, `description` 에 `.default('')` 추가
2. `backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts:81-107` `classifierCategoriesPorts`
   - `id: \`class_${i}\`` 자리에 `id: typeof c.id === 'string' && c.id.trim().length > 0 ? c.id : \`class_${i}\`` (switchPorts:66-79 패턴 복사)
3. `backend/src/nodes/ai/text-classifier/text-classifier.handler.ts:314, 392`
   - 매핑 테이블 빌드:
     ```ts
     const portIds = categories.map((c, i) =>
       typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `class_${i}`,
     );
     ```
   - `class_${portIndex}` 자리에 `portIds[portIndex]` 사용
4. `backend/src/modules/workflow-assistant/prompts/system-prompt.ts:230-234` SDD 항목 반영

### 영향 파일

- backend/src/nodes/ai/text-classifier/text-classifier.schema.ts
- backend/src/nodes/ai/text-classifier/text-classifier.handler.ts
- backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts
- backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts
- backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.spec.ts (해당 시)
- backend/src/modules/workflow-assistant/prompts/system-prompt.ts
- spec/3-workflow-editor/4-ai-assistant.md (text_classifier categories[*].id 안내가 신규 spec 행이 아닌 단순 보강이면 같은 turn 내 처리)

### TEST WORKFLOW + REVIEW WORKFLOW

종료 시 본 문서의 §F-1 테이블 행을 `DONE` 으로 갱신. 모든 STILL_VALID 행이 DONE 이면 본 문서를 `plan/complete/node-architecture/` 로 이동 검토 (단 §F-2/§F-3/§F-4 잔존 시 보류).

---

## Step 2: F-3 + F-4 묶음 (소규모)

### F-3

- `backend/src/nodes/presentation/form/form.schema.ts:7-12` `optionSchema.value` 를 `z.unknown().default('')` 로
- 단위 테스트: 빈 옵션 추가 시 value 가 `''` 로 기본 적용

### F-4

- `backend/src/nodes/integration/http-request/http-request.schema.ts:7-10` `keyValueSchema = z.object({ ... }).passthrough()`
- 단위 테스트: 추가 필드가 strip 되지 않고 보존되는지

### TEST WORKFLOW + REVIEW WORKFLOW

F-3·F-4 단일 commit. 종료 시 본 문서 테이블 갱신.

---

## Step 3: F-2 — buttons[*].id 정책

> 우려 §1 (UUID vs label-slug) 의 사용자 재확인 후 진행.

### 3-1. spec §8 개정 (project-planner 경유)

- `spec/3-workflow-editor/4-ai-assistant.md §8`:
  - "Selector 필드 정책" 표에 buttons[*].id 행 **신설** (현재 row 부재)
  - 내용: "id 가 공란이면 add_node/update_node 응답 시점에 시스템이 안정 id 부여, 기존 id 는 보존 (label 변경에도 slug 불변)"
- system-prompt 의 "Prefer short descriptive slugs over UUIDs" 문구는 slug 규칙 결정에 따라:
  - label-slug 채택 시: 그대로 유지
  - UUID 채택 시: 약화/제거 (정책 일관성 회복)

### 3-2. 마이그레이션 스크립트

- `backend/scripts/migrate-button-ids.ts` 신규
  - 모든 워크플로 entity fetch
  - 노드 type ∈ {carousel, chart, table, template} 의 buttons 위치 3곳 순회:
    - `items[*].buttons[*]` → fallback id `items_${i}_btn_${j}`
    - `itemButtons[*]` → fallback id `itemBtn_${i}`
    - `buttons[*]` → fallback id `btn_${i}`
  - id 비어있는 entry 에 fallback id 부여 (resolve-dynamic-ports.ts:230,245,257 와 동일 패턴)
  - `--dry-run` / `--apply` flag, 변경 노드 수 보고
  - 단일 트랜잭션 또는 배치 적용

### 3-3. shadow-workflow 자동 부여

- `backend/src/modules/workflow-assistant/shadow-workflow.ts` `addNode` / `updateNode`
  - 헬퍼 `normalizeButtonIds(config, prevConfig?)`:
    - 노드 type 한정 (carousel/chart/table/template)
    - 모든 button 위치에서 id 빈 문자열/undefined → 새 slug 부여 (label-slug 또는 UUID)
    - 기존 id 보존 (prevConfig 가 있으면 entry 매칭 후 prev.id 우선)
  - addNode, updateNode 진입 직후 호출

### 3-4. TDD

- `shadow-workflow.spec.ts`:
  - `add_node` carousel 빈 buttons → 응답 buttons 모두 새 slug
  - `update_node` 기존 id 유지 + 신규 entry 만 slug 부여
  - `update_node` label 만 수정 → id 불변
  - 마이그레이션 후 fallback id 와 호환

### 영향 파일

- backend/scripts/migrate-button-ids.ts (신규)
- backend/src/modules/workflow-assistant/shadow-workflow.ts
- backend/src/modules/workflow-assistant/shadow-workflow.spec.ts
- backend/src/modules/workflow-assistant/prompts/system-prompt.ts (slug 규칙에 따라)
- spec/3-workflow-editor/4-ai-assistant.md (project-planner)

### TEST WORKFLOW + REVIEW WORKFLOW

### 3-5. 마이그레이션 실행

dev/prod 적용 시점은 사용자 결정. 또는 lazy migration (다음 update_node 시 자연 적용 + 기존 fallback id 그대로 보존).

---

## 검증

```bash
# F-1
grep -rn "class_\${" backend/src/nodes/ai/text-classifier/  # 매핑 테이블만 남아야
grep -n "text_classifier\|categories\[\*\]\.id" backend/src/modules/workflow-assistant/prompts/system-prompt.ts

# F-3
grep -n "default" backend/src/nodes/presentation/form/form.schema.ts | head

# F-4
grep -n "passthrough" backend/src/nodes/integration/http-request/http-request.schema.ts

# F-2 마이그레이션
node backend/scripts/migrate-button-ids.ts --dry-run | tail -5

# 전체
(cd backend && npm run lint && npm test && npm run build)
(cd frontend && npm run lint && npm test && npm run build)
```

---

## Out of Scope

- ai_agent 의 conditions / text_classifier 의 categories / information_extractor 의 mode-based ports 는 **의도된 설계**로 확정 (2026-05-05). 추가 audit 불필요.
- text_classifier 의 multi-turn / 별도 분기 모드 (만약 추후 도입 예정) 는 본 범위 밖.
- form `value` 의 다른 노드 일관성(switch.caseDefSchema.value 와 통일) 은 후속 audit.
- buttons[*].id 외 다른 dynamic-port id 정책 통일 (e.g. carousel 의 itemButtons label 정책) 은 본 범위 밖.

---

## 갱신 책임 (drift 방지)

본 문서는 `plan/in-progress/` 의 활성 plan. 각 Step 종료 시 같은 turn 안에 다음을 갱신한다 — 시간이 지나 surface 와 코드가 어긋나지 않게.

- 재검증 스냅샷 표의 해당 행 → `DONE (커밋 hash 또는 날짜)`
- 사용자 결정·우려 항목이 더 이상 유효하지 않으면 즉시 제거
- 모든 follow-up 이 DONE 이고 우려가 해소되면 본 문서를 `plan/complete/node-architecture/` 로 `git mv`
