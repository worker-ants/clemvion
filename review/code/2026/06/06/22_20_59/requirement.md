# 요구사항(Requirement) 리뷰 결과

**대상**: KB 검색 불가(재임베딩 필요/진행 중) 신호화 + 목록 경고 (PR #508, `kb-unsearchable-warning`)
**Spec 기준 문서**: `spec/5-system/9-rag-search.md` (§2.2 / §3.1 / §4.2 / §5 / §6), `spec/2-navigation/5-knowledge-base.md` (§2.1 / §2.2.1)
**리뷰 일시**: 2026-06-06

---

## 발견사항

### **[INFO]** `unsearchableHit` 가드 조건 — `results.length === 0` 의 필요성

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` line 289 (`if (unsearchableHit && results.length === 0)`)
- **상세**: `KbToolProvider.execute` 는 단일 KB(`[kbId]`)로만 `searchWithMeta` 를 호출한다. 해당 KB 가 `unsearchable` 에 포함됐다면, `searchableKbs` 에서 이미 제외돼 실제 검색을 타지 않으므로 `results` 는 항상 빈 배열이다. 따라서 `results.length === 0` 조건은 논리적으로 항상 참이다. 코드가 틀린 것은 아니며 방어적 가드이지만, 조건이 영원히 false 가 될 수 있는 흑마법 분기처럼 읽힐 수 있다. 상황이 변해서 searchable 인 KB 에 unsearchable 엔트리가 부수적으로 섞이면 오작동 가능성이 있다.
- **제안**: 주석에 "단일 KB 호출이라 results.length 는 항상 0이지만 방어적 guard 유지" 한 줄 추가로 의도 명문화. 코드 변경 필수는 아님.

---

### **[INFO]** `withUnsearchable` 래퍼가 `catch` 경로를 타지 않는다

- **위치**: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `try/catch` 블록 (line 271–275)
- **상세**: `catch` 분기는 `{ results: [] }` 를 그대로 반환하고 `withUnsearchable` 로 래핑하지 않는다. 즉 pgvector/임베딩 API 오류가 발생하면 `unsearchable` 정보가 유실된다. 실제로 오류가 발생하면 KB 메타 조회 자체가 성공한 뒤 vector 쿼리에서 실패하는 경로인데, 이 시점에는 이미 `unsearchable` 목록이 만들어져 있으므로 유실이 발생한다. spec §6 은 "임베딩 API / pgvector 쿼리 실패 → `error:'search_failed'`" 와 "`not_searchable`은 별개"를 명시하고 있으므로, catch 경로에서 `unsearchable` 을 노출할 의무는 spec 상 없다. 이는 의도적 설계이나 주석이 없어 불명확하다.
- **제안**: `catch` 블록 위에 "오류 발생 시 unsearchable 메타는 손실 — §6 search_failed 경로는 별도" 한 줄 주석 추가.

---

### **[INFO]** `RagAccumulator.getDiagnostics()` — `attempted===true` 이지만 `diagnosticCount===0` 인 이론적 경로

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `getDiagnostics()` (line 465–473)
- **상세**: `this.attempted` 는 `pushDiagnostic` 호출 시 true 로 세팅되며, `this.diagnosticCount` 도 동일 메서드에서 1씩 증가한다. 즉 `attempted===true` 이면 `diagnosticCount >= 1` 이 항상 성립한다. 따라서 `diagnosticCount > 0` 조건은 사실상 항상 true 이다. 이는 안전하지만 내부적으로 중복 조건이다. 논리 흐름을 오해할 소지 없음.
- **제안**: 없음 (방어적 코드이며 스펙 동작에 이상 없음).

---

### **[INFO]** 프론트엔드 카드 경고 조건 — `embeddingDimension == null` 이면서 `reembedStatus` 가 `'idle'` / `'in_progress'` 외의 값인 경우

- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` (line 183–185)
- **상세**: 현재 코드는 `embeddingDimension == null` 조건에서 `reembedStatus === 'in_progress'` 가 아니면 모두 "재임베딩 필요 · 검색 불가" 경고 배지를 표시한다. DB 스키마 상 `reembed_status` 가 `'idle' | 'in_progress'` 외의 값을 가질 수 없다면 무방하지만, 미래에 새로운 상태가 추가되면 잘못된 배지가 표시될 수 있다.
- **제안**: spec `§2.2.1` 테이블이 두 상태만 정의하므로 현재는 spec 준수. 향후 상태 추가 시 명시적 `else if` 분기로 방어.

---

### **[INFO]** [SPEC-DRIFT] `spec/2-navigation/5-knowledge-base.md §2.2.1` 목록 — 경고 배지 색상 spec 미반영

- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` (line 170–172)
- **상세**: spec `§2.2.1` 표는 `in_progress → 진행색`, `idle → 경고색` 만 명시했다. 구현은 `in_progress` 에 `--primary/0.12` (진행/primary 계열), `idle` 에 `--destructive/0.12` (빨강/경고색)를 사용한다. 이는 디자인 토큰 선택이며 spec 이 token 이름까지 규정하지 않으므로 코드가 틀린 것은 아니다. 그러나 spec 목업의 "재임베딩 중"이 `🔄` (amber/스피너)를 암시하는데, 구현은 `--primary` 계열을 사용해 테마에 따라 amber 가 아닐 수 있다.
- **제안**: 코드 유지. spec 에 토큰 이름 구체화가 필요하다면 `project-planner` 경로로 spec 반영.

---

### **[INFO]** `kb-tool-provider.spec.ts` 혼합 케이스(mixed) 테스트 미존재 — `KbToolProvider` 레벨

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.spec.ts`
- **상세**: `rag-search.service.spec.ts` 는 `mixed` 케이스(일부 searchable, 일부 unsearchable)를 테스트한다. 그러나 `KbToolProvider` 는 항상 단일 KB 로 호출하므로 `mixed` 는 `searchWithMeta` 레벨에서만 발생하며 `KbToolProvider` 레벨 테스트가 없어도 기능 상 문제없다.
- **제안**: 없음 (단일 KB 호출 설계 의도에 부합).

---

## 기능 완전성 점검

| 항목 | 결과 |
|------|------|
| `embedding_dimension IS NULL` KB 를 vector/rerank/graph 쿼리에서 사전 차단 | 구현됨 (`searchableKbs` 필터) |
| `reembedStatus='in_progress'` → `reembedding_in_progress` 이유 | 구현됨 |
| `reembedStatus='idle'` + NULL → `reembedding_required` 이유 | 구현됨 |
| `not_searchable` 봉투 (`status`, `reason`, `note`, `results:[]`) | 구현됨, spec §2.2 JSON 예시와 필드·값 일치 |
| `ragDiagnosticsDelta.unsearchable: true` delta | 구현됨 |
| `skipReason='kb_unsearchable'` — 모든 호출이 unsearchable 인 경우에만 | 구현됨 (`diagnosticCount === unsearchableCount`) |
| 우선순위 `empty_kb_list → kb_unsearchable → no_results` | 구현됨 (spec §4.2 기술과 일치) |
| `search_failed` 와 `not_searchable` 분리 (top-level `status` 미설정) | 구현됨 |
| 프론트엔드 카드 경고 배지 3종 (정상, in_progress, idle) | 구현됨, 테스트 3건 |
| i18n ko/en 키 추가 (`reembeddingRequired`, `reembeddingInProgress`) | 구현됨 |
| `reembed_status` SQL 조회 (`reembed_status AS "reembedStatus"`) | 구현됨 |
| 혼합 케이스 — searchable KB 는 정상 검색 + unsearchable 별도 반환 | 구현됨, 테스트 커버 |

---

## Spec Fidelity 점검

### spec/5-system/9-rag-search.md

**§2.2 — `not_searchable` 봉투 필드 점검**

spec 예시:
```json
{ "kb":"요금제 안내", "query":"요금제 종류", "status":"not_searchable",
  "reason":"reembedding_required",
  "note":"This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding (or that it is in progress); do not claim the KB is empty or fabricate an answer.",
  "results":[] }
```

구현 (`kb-tool-provider.ts` line 292–298):
```json
{ "kb":"...", "query":"...", "status":"not_searchable",
  "reason":"...",
  "note":"This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding (or that it is in progress); do not claim the KB is empty or fabricate an answer.",
  "results":[] }
```

spec 과 구현의 필드명·순서·note 문자열이 완전 일치한다. `reason` 값은 `reembedding_required` / `reembedding_in_progress` 이며 spec §2.2 `reason` 설명과 일치한다.

**§2.2 봉투 판별 우선순위** (`error → status → grounding → 정상 results`):
- `search_failed` 는 `catch` 분기에서 `error:'search_failed'` 로 반환 (우선 1)
- `not_searchable` 은 `unsearchableHit` 조건에서 반환 (우선 2)
- `grounding:'none'` 은 그 다음에 처리됨 (우선 3)
- 정상 results 는 마지막 (우선 4)

구현 순서가 spec 봉투 판별 우선순위와 일치한다.

**§4.2 — `skipReason` 필드명·값·우선순위**

spec:
> `skipReason` | `empty_kb_list` / `kb_unsearchable` / `no_results` — 정상 시 생략
> 우선순위 `empty_kb_list → kb_unsearchable → no_results`

구현 (`ai-agent.handler.ts` `getDiagnostics()`):
- `initialKbCount === 0` → `empty_kb_list` (1순위)
- `diagnosticCount > 0 && unsearchableCount === diagnosticCount` → `kb_unsearchable` (2순위)
- 그 외 → `no_results` (3순위)

spec 의 우선순위 및 `resultCount === 0` 일 때만 세팅 조건이 구현에 정확히 반영됐다.

**§4.2 — `kb_unsearchable` 적용 조건**:
spec: "호출된 KB 가 전부 검색 불가(`embedding_dimension` NULL)면"
구현: `unsearchableCount === diagnosticCount` (모든 호출이 unsearchable 일 때)

혼합 케이스(일부만 unsearchable, 나머지는 정상 검색됐지만 결과 0건)에서:
- `resultCount` 는 0
- `unsearchableCount < diagnosticCount`
- → `skipReason = 'no_results'` 로 분기됨

이는 spec 의 "전부 검색 불가인 경우에만 `kb_unsearchable`" 조건에 부합한다.

### spec/2-navigation/5-knowledge-base.md

**§2.2.1 — 카드 경고 조건 테이블**

spec:
| 조건 | 카드 표시 |
|------|-----------|
| `embeddingDimension == null` & `reembedStatus === 'in_progress'` | 🔄 "재임베딩 중" (진행색) |
| `embeddingDimension == null` & `reembedStatus === 'idle'` | ⚠️ "재임베딩 필요 · 검색 불가" (경고색) |

구현 (`page.tsx` line 167–187):
- `kb.embeddingDimension == null` 조건 시 배지 렌더
- `kb.reembedStatus === 'in_progress'` → Loader2 아이콘 + `t("knowledgeBases.reembeddingInProgress")` (en: `"Re-embedding…"`)
- 그 외 → AlertTriangle 아이콘 + `t("knowledgeBases.reembeddingRequired")` (en: `"Re-embedding required · not searchable"`)

i18n 키 값 (en):
- `reembeddingInProgress`: `"Re-embedding…"` — spec: `"재임베딩 중"` (진행색 배지 텍스트)
- `reembeddingRequired`: `"Re-embedding required · not searchable"` — spec: `"재임베딩 필요 · 검색 불가"` (경고색 배지 텍스트)

영문 레이블이 spec 의 한국어 의미 구조를 정확히 영문화했으며, 한국어 dict 도 spec 텍스트와 정확히 일치한다.

---

## 에러 시나리오 점검

| 에러 경로 | 처리 방식 | Spec 일치 |
|-----------|-----------|-----------|
| `searchWithMeta` throw → catch | `error:'search_failed'`, `status:'error'`, `ragDiagnosticsDelta` 반환 | spec §6 일치 |
| KB 전부 unsearchable → `searchableKbs.length === 0` | `withUnsearchable({ results: [] })` 반환 (vector/rerank/graph 쿼리 미실행) | spec §3.1 일치 |
| KB 일부 unsearchable, 일부 searchable | searchable 만 쿼리 + unsearchable 배열 포함해 반환 | spec §3.1 일치 |
| `embeddingDimension != null` → 정상 검색 | `unsearchable` undefined (withUnsearchable 가 r 그대로 반환) | 정상 |

---

## 요약

이 변경은 `embedding_dimension IS NULL` 인 KB 를 기존 조용한 0건 반환에서 명시적 `not_searchable` 신호로 전환하는 기능을 완전하게 구현했다. `spec/5-system/9-rag-search.md §2.2`의 봉투 필드·값·note 문자열, §4.2의 `skipReason` 우선순위·적용 조건, §6의 오류 구분 정책이 코드에 line-level 로 정확히 반영됐다. `spec/2-navigation/5-knowledge-base.md §2.2.1`의 카드 경고 조건 테이블도 구현과 일치한다. 발견된 사항은 모두 INFO 등급의 방어적 코드 명확화 수준이며 기능 누락·오구현·spec 위반은 없다.

---

## 위험도

NONE
