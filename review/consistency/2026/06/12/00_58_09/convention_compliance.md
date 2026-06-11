# Convention Compliance Review

**검토 대상**: `spec/conventions/` 변경 파일 + 연관 spec 파일 (diff-base: origin/main)

변경된 파일:
- `spec/conventions/error-codes.md` — §3.1 내부 전용 legacy 코드 표 추가
- `spec/conventions/node-output.md` — D4 note 내 anchor 링크 수정
- `spec/conventions/chat-channel-adapter.md` — HTTP_TIMEOUT 미발행 주석 추가
- `spec/5-system/3-error-handling.md` — HTTP_TIMEOUT 미발행 주석 추가
- `spec/4-nodes/4-integration/1-http-request.md` — dry-run SSRF 생략 명시, Usage 로그 매트릭스 주석, deprecated 필드 명시
- `spec/4-nodes/5-data/2-code.md` — 2단 async 래퍼, 라인 오프셋, vars copy-out, meta.durationMs 예시

---

## 발견사항

### [INFO] error-codes.md — status: implemented code: 경로가 §3.1 구현 경로를 미반영
- **target 위치**: `spec/conventions/error-codes.md` frontmatter `code:` 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 시 `code:` ≥1 매치 의무 (빌드 차단은 기존 경로 1개로 통과하나 참조 완결성 문제)
- **상세**: §3.1 에 추가된 Code 노드 내부 정규화 매핑의 구현체 `codebase/backend/src/nodes/data/code/code.handler.ts` 가 `code:` 목록에 없다. 기존 단일 경로 `codebase/backend/src/nodes/core/error-codes.ts` 만으로 빌드 차단은 발생하지 않지만, 본 문서가 code.handler.ts 의 `classifyCodeNodeError`·`LEGACY_TO_NORMALIZED` 동작을 규정하는 SoT 임을 감안하면 경로 누락이다.
- **제안**: `code:` 에 `codebase/backend/src/nodes/data/code/code.handler.ts` 추가 고려. 단 error-codes.ts 단일 경로가 의도적 설계(에러 코드 enum 파일 한정 책임)라면 현행 유지 가능.

### [WARNING] error-codes.md §3 — §3.1 절이 "Historical-artifact 예외 레지스트리" 섹션 아래 놓여 독자 혼선 가능
- **target 위치**: `spec/conventions/error-codes.md` §3 도입문 vs §3.1 내부 코드 절
- **위반 규약**: `spec/conventions/error-codes.md §3` 자체 범위 선언 ("원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다")
- **상세**: §3 의 표에 등재된 코드는 "§1 UPPER_SNAKE_CASE 위반"이거나 "의미 부정확"한 **외부 노출 코드**들이다. §3.1 에 등재된 내부 분류 코드(`EXECUTION_TIMEOUT` 등)는 클라이언트 비노출이라 §1 적용 범위 밖이다. 그러나 §3 제목("Historical-artifact 예외 레지스트리") 아래 위치해 있어 독자가 §3.1 코드들도 §1 위반 artifact 라고 오해할 수 있다. 즉 §3 의 현재 섹션 구조는 "§1 위반 외부 노출 코드"와 "§1 비적용 내부 코드"를 같은 h2 아래 묶는다.
- **제안 (두 가지 중 택일)**: (A) §3.1 을 §3 외부로 분리해 독립 `## 4. 내부 전용 분류 코드 (정규화 후 발행)` 절로 이동. (B) §3 도입문을 "§1을 따르지 않는 기존 코드, 및 §1 적용 범위 외 내부 분류 코드"로 확장. 규약 자체 갱신이 적절하다면 (A) 채택.

### [INFO] node-output.md — anchor 링크 정확성 확인 필요
- **target 위치**: `spec/conventions/node-output.md` D4 blockquote anchor `#58-d4-handlervalidate-실패만-throw-나머지-모두-53-으로-라우팅`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` (build 차단) heading slug 대조
- **상세**: `1-http-request.md` 에 `## 5.8` 절이 실제로 존재하고 해당 heading 의 GitHub-slugger slug 가 정확히 `58-d4-handlervalidate-실패만-throw-나머지-모두-53-으로-라우팅` 임을 빌드 테스트가 검증한다. 테스트 통과가 확인되면 이상 없음.
- **제안**: `npm test` 또는 CI 에서 `spec-link-integrity.test.ts` 통과 확인.

### [INFO] 2-code.md — `meta.durationMs` 키 명칭과 node-output.md Principle 2 의 `duration` 표기 불일치 가능성
- **target 위치**: `spec/4-nodes/5-data/2-code.md` §5.3.3 응답 예시 JSON 및 note
- **위반 규약**: `spec/conventions/node-output.md Principle 2` — meta 필드 명칭 정의
- **상세**: 2-code.md 에 `"durationMs": 42` 가 추가됐고 note 에 "핸들러는 `meta: { success, logs }` 만 반환하고 엔진이 실행 시간을 덧붙인다"고 설명한다. node-output.md Principle 2 에는 `duration` 이라고만 기재돼 있고 `durationMs` 키 명칭 자체가 명시돼 있는지 불명확하다. 두 문서 간 키 명칭이 불일치하면 구현자 혼란 유발.
- **제안**: `node-output.md Principle 2` 에 `durationMs` 키 명칭을 명시적으로 등재(또는 기존 `duration` 표기를 `durationMs` 로 통일). 이미 통일돼 있다면 현행 유지.

### [INFO] cafe24-api-catalog/_overview.md — `_overview.md` prefix 규약 준수 확인 (변경 없음)
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md`
- **위반 규약**: CLAUDE.md 명명 컨벤션 — `_product-overview.md` / `_overview.md` 는 밑줄 prefix leaf 아닌 index 성격, `spec-frontmatter.test.ts` 제외 대상
- **상세**: `_overview.md` 는 `spec-impl-evidence.md §1` 제외 대상(`spec/<영역>/_*.md`)이라 frontmatter `id`/`status` 의무 없음. 이번 변경에서 `_overview.md` 자체는 수정되지 않았으므로 기존 준수 상태 유지.
- **제안**: 현행 유지.

---

## 요약

이번 변경은 `spec/conventions/error-codes.md` 에 Code 노드 내부 legacy 분류 코드 정규화 매핑(§3.1)을 추가하고, 여러 spec 파일에서 `HTTP_TIMEOUT` 이 미발행 코드임을 주석으로 명확히 하는 문서 정제 작업이다. 정식 규약 관점에서 빌드 차단을 야기하는 CRITICAL 위반은 없다. 주요 주의 사항은 (1) `error-codes.md §3.1` 절이 §3 "Historical-artifact 예외 레지스트리" 아래에 위치해 독자가 내부 코드를 §1 위반 코드로 오해할 수 있다는 점(WARNING — 규약 설명의 범위 모호성), (2) `node-output.md` 의 새 anchor 링크가 `spec-link-integrity.test.ts` 빌드 테스트에서 통과하는지 확인이 필요하다는 점이다. `2-code.md` 의 `durationMs` 키 명칭은 `node-output.md Principle 2` 와의 명칭 통일 여부 확인이 권장된다.

---

## 위험도

LOW
