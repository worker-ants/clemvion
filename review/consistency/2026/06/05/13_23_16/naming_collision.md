# 신규 식별자 충돌 검토

- 검토 범위: `git diff 7afa9ae0..HEAD` (worktree: memory-backlog-a2-fe9c8f)
- 검토 일시: 2026-06-05
- 검토자: naming-collision-checker

---

## 발견사항

신규 식별자 충돌 없음.

---

### 세부 확인 항목

**플랜 파일명 — `plan/in-progress/memory-backlog-grooming.md`**

- `plan/in-progress/` 전체 목록 및 `plan/complete/` 내 중복 없음 확인.
- 기존 유사 파일(`ai-context-memory-*.md`, `rag-rerank-*.md` 등) 과 이름이 겹치지 않음.

**SQL CTE 이름 — `grouped`**

- `agent-memory.service.ts` 내 단일 쿼리 문자열 안에서만 사용되는 SQL CTE 별칭.
- TypeScript 코드 레이어에서는 변수명으로 노출되지 않음.
- 동일 파일 외 다른 서비스에서 `grouped` 를 SQL CTE 이름으로 사용하는 곳 없음 (검색 결과: JS/TS 지역 변수로만 존재, SQL CTE 형태 0건).
- 다른 모듈(`sessions.service.ts`, `integrations.service.ts`)에서 `const grouped = new Map()` 형태의 TypeScript 로컬 변수가 존재하나, SQL 문자열 내 CTE 식별자와 언어 레이어·스코프가 완전히 분리되어 충돌 없음.

**레코드 반환 필드 — `total: string`**

- `agent-memory.service.ts` `listScopes` 의 내부 raw row 타입에 `total: string` 필드 추가.
- 해당 타입은 함수 내부 inline 타입이며 외부로 export 되지 않음. 기존 반환 DTO(`AgentMemoryScope[]` + `total: number`) 는 변경 없음 — 최종 매핑 레이어에서 `Number(rows[0]?.total ?? 0)` 으로 변환.
- 외부 API 계약·DTO 명 변경 없음.

**스키마 필드 변경 — `embeddingModel` widget `'text'` → `'expression'`**

- 새 식별자를 도입하지 않음. 기존 `embeddingModel` 필드의 `ui.widget` 속성값을 교체.
- `'expression'` 은 `ai-agent.schema.ts` 내 다수 기존 필드(`memoryKey`, 모델 선택 필드 등)에서 이미 사용 중인 값이며, 이번 변경이 새 widget 타입을 도입하지 않음.

**spec 추가 문장 — `페이지네이션(scopes)` 불릿**

- `spec/5-system/17-agent-memory.md` §6 에 `total` 동작 설명 불릿 1개 추가.
- 신규 요구사항 ID(AGM-xx) 부여 없음. 기존 `AGM-12` 의 동작 세부 명세 보완이므로 ID 충돌 없음.
- main spec 의 `AGM-` 시리즈는 AGM-01~AGM-11 까지 존재. AGM-12/13 은 이 worktree 에서 도입한 식별자로, main spec 에는 아직 없으며 다른 의미로 선점된 사례 없음.

**review 파일 경로 — `review/code/2026/06/05/12_57_57/`**

- 기존 `review/code/` 하위 타임스탬프 디렉토리 명명 컨벤션 준수.

---

## 요약

이번 변경(diff 7afa9ae0..HEAD)이 도입하는 신규 식별자는 플랜 파일명 `memory-backlog-grooming.md`, SQL CTE 별칭 `grouped`, 내부 raw row 타입 필드 `total: string` 이 전부다. 세 식별자 모두 동일 이름이 다른 의미로 기존에 사용된 사례가 없으며, 스코프 분리가 명확하다. 요구사항 ID(AGM-)는 신규 부여 없이 기존 식별자(AGM-12 § 세부 보완)만 참조한다. 나머지 변경(widget 값 교체, SQL 쿼리 내부 최적화, 테스트 보강)은 식별자를 새로 도입하지 않는다.

---

## 위험도

NONE

---

BLOCK: NO
