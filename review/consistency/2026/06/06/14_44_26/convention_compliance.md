# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/spec-draft-rag-dynamic-cut.md` (spec draft — --spec 모드)
**검토 일자**: 2026-06-06
**검토 범위**: `spec/conventions/**` 의 정식 규약 대비 준수 여부

---

## 발견사항

### 1. **[CRITICAL]** plan 문서 frontmatter 3필드 누락

- **target 위치**: 문서 최상단 (frontmatter 없음)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `plan/in-progress/<name>.md` 에 `worktree`·`started`·`owner` 3필드 frontmatter 필수. build guard `plan-frontmatter.test.ts` 강제.
- **상세**: target 문서는 `plan/in-progress/spec-draft-rag-dynamic-cut.md` 에 위치하지만 `---` frontmatter 블록이 전혀 없다. `worktree`, `started`, `owner` 3필드 부재 상태로 머지되면 `plan-frontmatter.test.ts` 가 build fail 을 일으킨다. 다른 spec-draft 계열 plan (예: `spec-draft-conventions-code-data.md`) 은 모두 frontmatter 를 보유한다.
- **제안**: 문서 최상단에 아래 형태의 frontmatter 추가.
  ```yaml
  ---
  worktree: rag-dynamic-cut-12fac1
  started: 2026-06-06
  owner: project-planner
  ---
  ```

---

### 2. **[WARNING]** `pending_plans:` 상호참조 방향 — target plan 파일 자신이 spec frontmatter 에 등재됐는지 확인 필요

- **target 위치**: § A1 "frontmatter 갱신" 지시
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1·§3` — `status: partial` 인 spec 은 `pending_plans:` 에 in-progress plan 경로를 **의무** 기재하고, 해당 경로는 실존해야 함 (`spec-pending-plan-existence.test.ts`).
- **상세**: spec draft 는 `spec/5-system/9-rag-search.md` 의 `pending_plans:` 에 `plan/in-progress/rag-dynamic-cut.md` 를 추가하라고 지시한다 (§A1). 그러나 target plan 파일명은 `spec-draft-rag-dynamic-cut.md` 이고, plan 폴더에는 `rag-dynamic-cut.md` 라는 별도 파일이 존재하지 않는다(현재 `plan/in-progress/` 에서 불발견). `pending_plans:` 경로가 실존하지 않으면 `spec-pending-plan-existence.test.ts` 가 build fail. `rag-dynamic-cut.md` 를 별도 생성할지, 또는 `spec-draft-rag-dynamic-cut.md` 경로를 기재할지 명확히 해야 한다.
- **제안**: §A1 의 `pending_plans:` 경로를 실제 plan 파일 경로인 `plan/in-progress/spec-draft-rag-dynamic-cut.md` 로 수정하거나, `plan/in-progress/rag-dynamic-cut.md` 를 별도로 생성(별 구현 plan).

---

### 3. **[WARNING]** 문서 구조 — 3섹션 권장 패턴(Overview / 본문 / Rationale) 미충족

- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md `§정보 저장 위치` — spec 관련 draft 문서는 본문 끝에 `## Rationale` 섹션 권장. 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 에 둔다.
- **상세**: target 문서는 §A~§F 의 구체적 spec 변경 지시와 마지막에 `## Rationale (draft 자체)` 섹션을 보유하고 있다. 그러나 이 Rationale 은 plan document 의 draft 로서 다루어지며, 실제 spec 문서 갱신 시 각 spec 파일(`spec/5-system/9-rag-search.md` 등)의 `## Rationale` 섹션으로 이전되어야 한다. target 문서 자체에서 "spec 에 반영할 Rationale 내용" 과 "plan 자체의 근거" 가 혼재되어 있어 혼동 가능성이 있다.
- **제안**: `## Rationale (draft 자체)` 제목을 `## Rationale — 본 spec draft 결정 근거` 와 `## 각 spec 파일 Rationale 추가 내용 (§A8)` 로 명확히 분리하거나, §A8 에 이미 spec 파일 Rationale 추가 지시가 있으므로 draft Rationale 은 plan 근거로만 남기고 spec Rationale 내용은 §A8 에 통합.

---

### 4. **[WARNING]** `spec/5-system/9-rag-search.md` frontmatter 갱신 지시 — status 전이 명시 없음

- **target 위치**: § A1
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3 전이 규칙` — `partial` → `implemented` 전이는 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 자동 승격 의무. `pending_plans` 추가 시 spec `status` 를 `partial` 로 설정해야 하는 경우 명시 필요.
- **상세**: §A1 은 `pending_plans:` 에 `plan/in-progress/rag-dynamic-cut.md` 추가를 지시한다. `spec/5-system/9-rag-search.md` 가 현재 `status: implemented` 라면 `pending_plans:` 추가와 함께 `status: partial` 로 변경이 필요하다 (`spec-impl-evidence.md §3` — `partial` 의 `pending_plans:` 의무·`implemented` 는 `pending_plans` 없음). 이 전이가 spec draft 내 어디에도 명시되지 않아 적용 시 가드 실패 위험이 있다.
- **제안**: §A1 에 `status: partial` 로 변경하라는 지시를 추가하거나, 해당 spec 의 현재 status 에 따라 조건을 명시.

---

### 5. **[WARNING]** 새 내부 상수 명명 — 규약 문서 정합 확인 필요

- **target 위치**: §A5 `RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`
- **위반 규약**: `spec/conventions/error-codes.md §1` (도메인 prefix 패턴, UPPER_SNAKE_CASE) 및 `spec/conventions/node-output.md §Principle 1.1` (config vs output 직교).
- **상세**: 세 상수는 `UPPER_SNAKE_CASE` + `RAG_` prefix 로 도메인 prefix 패턴을 따르고 있다. §A8 에서 `RAG_INJECT_TOKEN_BUDGET` 을 `DEFAULT_MEMORY_TOKEN_BUDGET` 과 구분하기 위해 `RAG_` prefix 를 쓴다고 Rationale 에 명시되어 있어 의도적 패턴이다. 이 자체는 규약과 일치한다. 단, 이 상수들이 코드베이스 내에서 환경변수(`process.env.*`)로 노출되는지, 아니면 모듈 내 리터럴로만 존재하는지가 spec 본문에서 명시되지 않았다. 환경변수로 노출 시 naming convention(`snake_case` vs `UPPER_SNAKE_CASE`)이 달라진다.
- **제안**: §A5 또는 §A8 에 "코드 상수(module-level constant)이며 환경변수로 노출 안 됨" 을 명확히 기재하여 구현 시 ambiguity 제거.

---

### 6. **[INFO]** `plan/in-progress/rag-rerank-followup.md` 갱신 지시의 체크박스 마커

- **target 위치**: §F `plan 갱신` — `[ ]` → `[~]` 전환 지시
- **위반 규약**: `plan-lifecycle.md §2` — 미체크 체크박스(`[ ]`)·"TODO" 등이 하나라도 있으면 `in-progress/`로 남는다. `[~]` 마커는 체크박스 규약에 정의되지 않은 비표준 값이다.
- **상세**: spec draft 는 `rag-rerank-followup.md` 의 `[ ]` 를 `[~]` (진행 중/부분 완료 표기로 보임)로 변경하라고 지시한다. `plan-lifecycle.md §2` 의 분류 기준은 `[x]` (완료) vs 미완(`[ ]`)만 정의하며, `[~]` 는 표준 마커가 아니다. 기존 `rag-rerank-followup.md` 에서도 `[~]` 가 이미 사용 중이므로 이 파일에서는 관행이 있으나, plan-lifecycle 정식 규약에는 없는 비표준 표기임.
- **제안**: `[~]` 마커가 "메커니즘 구현됨, A/B 임계 후속" 의미라면 `rag-rerank-followup.md` 의 해당 항목 설명에 그 상태를 인라인으로 기재하거나, plan-lifecycle 규약 자체에 `[~]` 의미를 추가하는 것을 검토. 현재 기존 파일에서 이미 사용 중이므로 위험도는 낮다.

---

### 7. **[INFO]** `spec/5-system/17-agent-memory.md` 변경 지시 — 라인 번호 명시

- **target 위치**: §D "라인 83"
- **위반 규약**: 명시적 규약 위반은 아님. 단, spec 변경 지시 시 라인 번호를 기준점으로 쓰는 것은 문서 편집 후 라인이 밀리면 오적용 위험이 있다.
- **상세**: §D, §B1/§B2 에서 `라인 40`, `라인 83`, `라인 156`, `라인 667 부근` 등 라인 번호를 통해 변경 위치를 지정한다. spec 변경이 순차적으로 적용될 때 후행 변경의 라인 번호가 틀릴 수 있다.
- **제안**: 라인 번호 대신 섹션 헤딩이나 기존 텍스트 앵커를 기준으로 변경 위치를 기술. 이미 §3.1, §3.3.1 등 섹션 참조가 혼용되고 있어 통일이 바람직.

---

## 요약

target 문서(`plan/in-progress/spec-draft-rag-dynamic-cut.md`)는 spec 내용 자체(RAG 동적 컷 D1/D2 설계)는 spec/conventions 의 도메인 규약(에러 코드 명명, 출력 포맷, API 문서 패턴)에 위배되지 않는다. 그러나 **plan 문서로서의 구조 규약** 위반이 CRITICAL 1건 발견됐다 — plan frontmatter(`worktree`/`started`/`owner`) 전면 부재로 `plan-frontmatter.test.ts` build 차단이 확실하다. 추가로 `pending_plans:` 경로 불일치(실존 파일명과 기재 경로 불일치)가 WARNING 으로 발견됐으며 이 역시 `spec-pending-plan-existence.test.ts` 차단을 유발할 수 있다. 두 CRITICAL/WARNING 을 반드시 해소 후 spec 반영을 진행해야 한다.

## 위험도

**HIGH**

- CRITICAL: plan frontmatter 누락 → build 차단 확실
- WARNING: `pending_plans:` 경로 불일치 → spec 반영 후 build 차단 가능성 높음
- WARNING: spec status 전이 미명시 → 적용 시 `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` 실패 가능
