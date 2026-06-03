# 신규 식별자 충돌 검토 결과

**검토 범위**: `spec/` diff vs `origin/main` (--impl-done 모드)
**변경 파일**: `spec/0-overview.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/1-logic/9-foreach.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/4-integration/2-database-query.md`, `spec/4-nodes/4-integration/3-send-email.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/6-presentation/5-template.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/5-expression-language.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/conventions/spec-impl-evidence.md`

---

## 발견사항

### 1. 신규 표현식 변수 `$itemIsFirst` / `$itemIsLast` — 기존 Loop 변수 패턴 대비 네이밍 비대칭

- **[INFO]** ForEach 전용 신규 top-level 변수 `$itemIsFirst` / `$itemIsLast` 도입
  - target 신규 식별자: `$itemIsFirst`, `$itemIsLast` (top-level 표현식 변수 — `spec/4-nodes/1-logic/9-foreach.md:68-69`)
  - 기존 사용처: Loop 노드의 대응 변수는 `$loop.isFirst` / `$loop.isLast` (nested 객체 형태, `/spec/4-nodes/1-logic/3-loop.md:86-87`). 기존 expression-language 표에는 `$loop.isFirst`/`$loop.isLast` 가 `$loop.*` 서브 속성으로 정의되어 있다 (`spec/5-system/5-expression-language.md:203-204`).
  - 상세: Loop 은 `$loop.isFirst` (nested) / ForEach 는 `$itemIsFirst` (top-level) 로 같은 의미를 다른 접근 패턴으로 표현한다. 명명 비대칭이나, foreach.md Rationale R-1 이 `$item` 이 primitive 일 수 있어 속성 부착 불가 → top-level 로 둔 설계 근거를 명시하고 있으므로 의도된 차이다. 이미 `spec/5-system/4-execution-engine.md:545` 에서 `$itemIsFirst`/`$itemIsLast` 가 ForEach 컨테이너 내부 변수로 명확히 분류돼 있고, `spec/3-workflow-editor/1-node-common.md:265` 에서도 자동완성 표에 두 변수가 등재됐다.
  - 충돌 여부: 기존 `$itemIsFirst`/`$itemIsLast` 이름이 사용된 다른 식별자는 발견되지 않았다. Loop 변수(`$loop.isFirst`)와는 이름이 다르므로 직접 충돌 없음. `$item.isFirst` 형태(spec 에서 명시적으로 기각)와도 구분된다.
  - 제안: 혼동 예방 차원에서 `spec/5-system/5-expression-language.md` 의 ForEach 행에 "Loop 의 `$loop.isFirst` 와 별개 — ForEach 전용 top-level 변수" 단문 주석 추가를 고려할 수 있다(선택사항).

---

### 2. `config.errorHandling` vs `config.errorPolicy` — 두 config 키의 동시 존재

- **[INFO]** `config.errorHandling.policy` (일반 노드 전용 nested 구조) vs `config.errorPolicy` (컨테이너 전용 flat key) 구분 명시
  - target 신규 식별자: `config.errorHandling = { policy, retryConfig?, defaultOutput? }` 및 `config.errorHandling.policy` enum(`stop_workflow`/`skip_node`/`use_default_output`/`retry`/`route_to_error_port`) — `spec/3-workflow-editor/1-node-common.md:169`
  - 기존 사용처: `config.errorPolicy` (`stop`/`skip`/`continue`) 는 Loop/ForEach/Map/Parallel 컨테이너 노드에서 이미 사용 중 (`spec/4-nodes/1-logic/0-common.md:91-95`, `spec/4-nodes/1-logic/7-map.md:21`, `spec/4-nodes/1-logic/10-parallel.md:24-28`, `spec/3-workflow-editor/2-edge.md:171`).
  - 상세: 두 키(`config.errorPolicy` vs `config.errorHandling.policy`)가 비슷한 의미를 가지나 서로 다른 enum 집합을 갖는다. 타겟 문서는 이 구분을 `spec/4-nodes/1-logic/0-common.md:95` 에 명시적 경고 블록으로 추가해 충돌 가능성을 사전 차단했다. Parallel 노드는 `config.errorPolicy` 우선 + `errorHandling.policy` 폴백 명시 (`spec/4-nodes/1-logic/10-parallel.md:28`).
  - 충돌 여부: 이름이 유사해 혼동 가능성이 있었으나, 이미 spec 에 구분 경고가 추가되어 있다. 기존 `config.errorHandling` 식별자가 다른 의미로 사용된 곳은 발견되지 않았다.
  - 제안: 충돌 없음. 경고 블록이 이미 등재되어 있으므로 추가 조치 불요.

---

### 3. `backoffMultiplier` 필드 — 기존 Retry 계약과의 관계

- **[INFO]** `config.errorHandling.retryConfig.backoffMultiplier` 신규 도입
  - target 신규 식별자: `backoffMultiplier` (Float, default 2) — `spec/3-workflow-editor/1-node-common.md:166`, `spec/5-system/3-error-handling.md:240-243`
  - 기존 사용처: 이전 spec 은 Retry 정책에서 `maxRetries`/`retryInterval` 만 언급했고 `backoffMultiplier` 는 없었다 (이전 버전에서 "UI 미구현 Planned" 상태였음).
  - 상세: `backoffMultiplier` 는 같은 retryConfig 객체 안에서 사용되며 다른 도메인에서 같은 이름을 사용하는 식별자가 발견되지 않았다. `spec/5-system/3-error-handling.md:240` 은 `config.errorHandling.retryConfig.*` 경로를 SoT 로 명확히 지정한다.
  - 충돌 여부: 없음.

---

### 4. 신규 `summaryTemplate` 포맷 식별자 — 기존 요약 포맷 정의와 일관성

- **[INFO]** `{{queryType|upper}}`, `{{to.length}} recipients · {{subject}}`, `{{language|upper}}`, `{{outputFormat}} · {{buttons.length}} buttons` 신규 summaryTemplate 포맷 정의
  - target 신규 식별자: Database Query → `{{queryType|upper}} · {{query}}`, Send Email → `{{to.length}} recipients · {{subject}}`, Code → `{{language|upper}}`, Template → `{{outputFormat}} · {{buttons.length}} buttons` — `spec/3-workflow-editor/0-canvas.md:402-410`
  - 기존 사용처: `summaryTemplate` DSL 및 기존 노드 포맷은 `spec/4-nodes/0-overview.md §1.4` 가 SoT. 기존에도 HTTP Request(`{{method|default:GET}} {{url}}`), Cafe24(`{{resource}} · {{operation}}`) 같은 패턴이 있었다.
  - 상세: 신규 포맷 식별자들(특히 `to.length`, `buttons.length`, `queryType`)이 schema config 키와 1:1 대응하는지 확인했다. `queryType` 은 `spec/4-nodes/4-integration/2-database-query.md:24` 에서 정의된 필드다. `outputFormat`, `buttons` 는 Template 노드 config 필드이며 `spec/4-nodes/0-overview.md:206` 에서 `template, outputFormat, helpers, buttons` 로 카탈로그됐다. 전부 기존 schema 키와 정합한다.
  - 충돌 여부: 없음. 포맷 식별자들은 각 노드 schema 의 기존 config 필드를 참조하는 것으로 새로운 이름 충돌이 없다.
  - 제안: 없음.

---

### 5. `EXCLUDE_BASENAMES` / `CATALOG_FIELD_FILE` — spec-impl-evidence 새 제외 규칙

- **[INFO]** 제외 규칙 명칭(`EXCLUDE_BASENAMES`) 을 spec 문서에 명시적으로 등재
  - target 신규 식별자: `EXCLUDE_BASENAMES` (상수명, `spec/conventions/spec-impl-evidence.md:43-44`)
  - 기존 사용처: 이 상수는 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:56` 에서 코드로 이미 정의된 상태다. spec 문서에는 이전에 단순히 "제외:" 항목 목록만 있었고 코드 상수명을 노출하지 않았다.
  - 상세: spec 문서가 구현 상수명(`EXCLUDE_BASENAMES`)을 직접 인용하는 것은 코드 SoT 역참조 방식으로, spec 문서와 구현 파일 간 이름 불일치는 없다. 단, spec 문서는 일반적으로 구현 상수명보다는 의미·규칙을 기술하는 경향이 있다.
  - 충돌 여부: 없음.

---

### 6. `spec/conventions/spec-impl-evidence.md` — `archived` vs `deprecated` 의미 분리 기술

- **[INFO]** `archived` (spec 문서 폐기 상태)와 Cafe24 카탈로그의 `deprecated` (외부 API endpoint 폐기)의 의미 분리를 spec 에 명기
  - target 신규 식별자: `archived` 상태값의 의미 범위 명확화 — `spec/conventions/spec-impl-evidence.md:79`
  - 기존 사용처: `archived` 는 `spec-impl-evidence.md` §3 에서 spec 문서 라이프사이클 enum 의 마지막 상태로 이미 존재했고, `deprecated` 는 `spec/conventions/cafe24-api-catalog/_overview.md §3` 에서 Cafe24 endpoint 폐기 상태로 별도 사용 중이었다.
  - 상세: 두 식별자가 서로 다른 도메인(spec lifecycle vs external API status)에서 사용되어 이름 충돌이 없음을 확인하는 주석을 추가한 것이다. 실제 충돌은 없으나 경계를 명확히 한 것.
  - 충돌 여부: 없음.

---

### 7. `section` / `page` metadata 필드 — DocumentChunk 메타데이터 세부화

- **[INFO]** DocumentChunk `metadata` JSONB 의 `section` (md heading) / `page` (pdf page) 구현 상태 업그레이드
  - target 신규 식별자: `metadata.section: string?` (md 파서 heading), `metadata.page: number?` (pdf 파서 1-based) — `spec/5-system/8-embedding-pipeline.md:144`
  - 기존 사용처: `spec/1-data-model.md §2.12.1 DocumentChunk` 에서 `metadata: JSONB` 는 이미 `{ page?: number, section?: string }` 으로 정의되어 있다. 임베딩 파이프라인 spec 은 과거 "항상 빈 `{}` 로 INSERT" 라고 기술했으나 이를 "파서가 채운다"로 업데이트한 것이다.
  - 상세: `page`/`section` 필드 이름은 데이터 모델 spec 과 동일하게 이미 정의된 상태였으므로 신규 이름 충돌이 아니다. 구현 상태 기술만 변경했다.
  - 충돌 여부: 없음.

---

## 요약

이번 변경에서 도입된 주요 신규 식별자(`$itemIsFirst`/`$itemIsLast` ForEach 표현식 변수, `config.errorHandling` nested 구조, `backoffMultiplier` retry 필드, 각 노드별 `summaryTemplate` 포맷 표현식)는 기존에 같은 이름으로 다른 의미가 사용된 사례가 발견되지 않았다. `$itemIsFirst`/`$itemIsLast` 는 Loop 의 `$loop.isFirst`/`$loop.isLast` 와 패턴이 다르나 이는 spec 내에서 설계 근거가 명시된 의도된 비대칭이며, 자동완성 표와 expression-language 표에 정합하게 등재되어 있다. `config.errorHandling.policy` 와 `config.errorPolicy` (컨테이너 전용)의 유사명 충돌 위험은 spec 에 경고 블록이 추가되어 사전 차단됐다. CRITICAL 또는 WARNING 급 식별자 충돌은 발견되지 않았다.

## 위험도

NONE

---

STATUS: OK
