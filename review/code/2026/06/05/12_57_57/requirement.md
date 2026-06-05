# 코드 리뷰 — 요구사항 충족 (memory-backlog A1/A3/B3)

**대상**: `git diff 7afa9ae0..HEAD -- codebase/`  
**변경 파일 4개**:
- `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`
- `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts`
- `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`

---

## CRITICAL

없음.

---

## WARNING

### [SPEC-DRIFT] A1 — listScopes `COUNT(*) OVER()` offset 초과 시 total=0 동작이 spec에 미기술

- **위치**: `agent-memory.service.ts` L579, `agent-memory.service.spec.ts` 신규 케이스 "빈 결과(또는 offset 초과)면 total 0"
- **상세**: `COUNT(*) OVER()` 윈도우 함수는 PostgreSQL에서 LIMIT/OFFSET **이전** 기준으로 평가되므로 정상 페이지에서는 전체 그룹 수를 올바르게 반환한다. 그러나 OFFSET이 전체 그룹 수를 초과해 반환 행이 0개가 되면 `rows[0]` 이 없어 `total = 0`이 된다. 즉 "5페이지까지 있고 총 47개"를 이미 알고 있던 클라이언트가 6페이지를 요청하면 `total=0`이 응답된다. 코드 주석("그 페이지엔 표시할 아이템도 없고 호출부 page 파생도 영향받지 않는다")은 이 동작을 의도적 트레이드오프로 문서화했으며, controller `PaginatedResponseDto.create([], 0, page, limit)` 는 빈 페이지를 올바르게 렌더링한다. 되돌리는 것이 오답이다.
  - `spec/5-system/17-agent-memory.md` 와 `plan/in-progress/agent-memory-admin-ui.md` §요구사항 AGM-12에 "OFFSET 초과 시 total=0" 동작이 명시되지 않아 spec이 낡음.
- **제안**: 코드 유지. `spec/5-system/17-agent-memory.md` §6 또는 `plan/in-progress/agent-memory-admin-ui.md` AGM-12 행에 "OFFSET이 전체 그룹 수를 초과하면 행 없음 → total=0(클라이언트는 항상 정상 페이지에서 total을 캐싱해야 함)" 을 spec 갱신 시 반영할 것.

---

## INFO

### [A1] listScopes 단일쿼리 변환 — 기능 완전성 확인

- **위치**: `agent-memory.service.ts` L526–580, `agent-memory.service.spec.ts` 전체 listScopes describe 블록
- **상세**: 기존 두 쿼리(집계 + COUNT 서브쿼리)를 CTE + `COUNT(*) OVER()` 단일쿼리로 통합. 다음 기능 불변식이 모두 유지됨:
  - workspace_id 격리 (`am.workspace_id = $1` 필터 유지)
  - q ILIKE 부분일치 파라미터 바인딩 (`'%' || $2 || '%'` 리터럴 보간 없음)
  - embedding 컬럼 미선택
  - GROUP BY scope_key / COUNT(*) / MAX(updated_at)
  - ORDER BY latest_updated_at DESC
  - limit/offset 파라미터 인덱스 계산(q 유무에 따른 $2/$3 vs $3/$4) 올바름
  - 반환 타입 shape 변경 없음 (`{ items, total }`)
- 신규 테스트 케이스 4건이 추가 커버리지를 제공: 단일쿼리 호출 횟수(1회), 빈결과 total=0, 페이지<전체에서 윈도우 total 보존. 모두 적절하다.

### [A3] embeddingModel widget `text` → `expression` 변환 — 기능 완전성 확인

- **위치**: `ai-agent.schema.ts` L596
- **상세**: `memoryKey`(expression), `summaryModel`(expression), `extractionModel`(expression)과 일관된 widget 타입으로 수정. `embeddingModel` 역시 표현식 평가 대상이므로(`{{ $input.embeddingModelId }}` 같은 동적 값 지원) `expression` 위젯이 적합하다. spec `1-ai-agent.md` §1 config 표에서 `embeddingModel` 필드의 widget 타입은 명시되지 않으므로 spec 위반 없음. placeholder(`text-embedding-3-small`)는 그대로 유지돼 정적 리터럴 입력도 안내됨.

### [B3] summaryBuffer 경계 케이스 테스트 — 기능 완전성 확인

- **위치**: `agent-memory-injection.spec.ts` L657–781 (신규 테스트 2건)
- **상세 B3-a**: `runningSummary != undefined` 경로에서 `buildSummaryBlock(runningSummary)` 토큰이 `fixedOverhead`에 포함되어 `referenceCut` 오라클과 bit-identical하게 cut 경계가 결정되는지 sweep 검증. 구현의 `noChange.runningSummary = runningSummary`(L216)가 no-op 시 기존 요약 보존을 보장하고, 테스트 단언 `expect(update.runningSummary).toBe(priorSummary)` 와 일치함.
- **상세 B3-b**: `tokenBudget === currentTokens` 정확 경계에서 `currentTokens <= tokenBudget` 조건(inclusive)으로 압축이 미발생함을 확인. 대조 케이스(`tokenBudget = currentTokens - 1`) 로 경계 + 1 압축 발동도 검증. 구현 L234(`if (currentTokens <= tokenBudget) return noChange`)와 정확히 일치함.

### 금지 항목 점검

- 마이그레이션 파일 변경: 없음
- 서비스 분리 / page.tsx 분해: 없음
- spec 파일 변경: 없음 (코드/테스트 전용으로 의뢰 범위 준수)
- 4개 파일 외 추가 변경: 없음

---

## 요약

3건 백로그(A1 listScopes 단일쿼리, A3 embeddingModel expression widget, B3 summaryBuffer 경계 테스트)가 모두 의도한 목적을 정확히 충족한다. A1은 동작 동일성을 유지하며 DB 라운드트립을 절반으로 줄인다; A3는 동계열 Memory 필드와 widget 타입 일관성을 맞춘다; B3는 기존 describe 블록에 `runningSummary!=undefined` 경로와 `budget==currentTokens` 정확 경계를 커버하는 테스트 2건을 추가한다. spec 모순은 없으며, SPEC-DRIFT 1건(offset 초과 시 total=0 동작 미기술)은 코드가 올바르고 spec만 갱신이 필요한 경우이다. 금지 항목(마이그레이션·서비스분리·page.tsx 분해) 없음.

## 위험도

LOW

BLOCK: NO
