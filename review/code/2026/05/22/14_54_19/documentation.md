# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: Cafe24 `constraints` 조건부 필수 — backend 구현 전체 (Phase B)
**리뷰 일시**: 2026-05-22

---

## 발견사항

### [INFO] `checkOne` 내부 함수에 독스트링 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.ts` — `checkOne` 함수
- **상세**: `validateCafe24Constraints` (공개 API) 는 충실한 JSDoc 을 가지고 있다. 그러나 내부 dispatch 함수 `checkOne` 은 단순히 `// implies` 한 줄 인라인 주석만 있고 각 분기(`oneOf` / `allOrNone` / `implies`)의 판정 로직에 설명이 없다. 함수 자체는 단순하지만, `allOrNone` 분기의 "부분적으로 존재하는 경우만 위반" 로직이나 `implies` 의 "if 가 absent 이면 then 미검사" 조건은 비직관적인 편이다.
- **제안**: `checkOne` 상단에 2-3줄 요약 JSDoc 추가. 혹은 최소한 `allOrNone` 분기 조건(`present.length > 0 && present.length < c.fields.length`)에 한 줄 인라인 주석을 보충하면 충분하다. 현재 공개 API 문서화는 완비되어 있으므로 INFO 등급.

---

### [INFO] `buildToolDescription` / `constraintToSuffixLine` 의 `export` 이유 미명시
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` — `buildToolDescription`, `constraintToSuffixLine`
- **상세**: 두 함수 모두 파일 하단에 `export function` 으로 선언되어 있다. JSDoc 에는 spec 참조와 description 조립 순서가 명시되어 있어 충분히 읽힌다. 다만 두 함수가 모듈 외부로 export 되는 이유(테스트 목적인지, 다른 모듈에서 실제로 사용하는지)가 JSDoc 에 언급되어 있지 않다. 현재 diff 에서는 테스트 파일이 이 함수들을 직접 import 하지 않고 `buildTools()` 통합 테스트를 통해 간접 검증한다.
- **제안**: `@internal` JSDoc 태그를 달거나, "테스트에서 직접 단언 가능하도록 export" 라는 한 줄 설명을 JSDoc 에 추가. 기능에 영향 없으나 외부 API 표면에 불필요한 export 가 늘어나는 것을 방지하기 위해 문서화하면 유용하다.

---

### [INFO] `cafe24.handler.ts` 신규 블록에 인라인 주석이 spec 참조를 제공하지만, constraint 종류별 에러 메시지 포맷이 주석에 미기재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` — 추가된 "2b." 블록 (`constraintViolation` 체크)
- **상세**: `// 2b. Conditional constraints check (spec §2 "constraints 의 의미"). Reuses CAFE24_MISSING_FIELDS ...` 주석은 에러 코드 재사용 의도를 충분히 설명한다. 그러나 `constraintViolation` 문자열에 resource·operationId 를 덧붙이는 로직 (`${constraintViolation} (for ${resource}.${operationId})`) 이 MCP 경로(`cafe24-mcp-tool-provider.ts`)와 다른 메시지 포맷을 생성한다는 점이 주석에 언급되지 않았다. 두 경로의 에러 메시지가 다를 수 있다는 사실은 디버깅 시 혼란 요소가 될 수 있다.
- **제안**: `throw new IntegrationError(...)` 줄 위에 "MCP 경로는 suffix 없이 constraintViolation 만 반환 — handler 경로는 `(for resource.operationId)` suffix 추가" 와 같이 한 줄 차이 설명을 추가.

---

### [INFO] `customer.ts` constraints 주석이 한국어로만 작성됨
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts` — `constraints` 필드 상단 주석
- **상세**: `// cafe24 docs 본문 박스: "회원 ID · 가입 시작/종료일 · 회원 등급 번호 중 한 가지는 반드시 입력하셔야 합니다" — requiredFields (AND) 로 표현 불가한 OR 제약. spec/conventions/cafe24-api-metadata.md §2 "constraints 의 의미".` 주석은 의도를 잘 전달한다. 해당 파일의 나머지 description 문자열은 모두 영문으로 작성되어 있다. 주석 자체는 역할을 충분히 한다.
- **제안**: 변경 불필요. 한국어 인용은 원본 docs 에서 직접 인용한 것임을 맥락상 이해할 수 있고, spec §2 cross-reference 가 있어 출처가 명확하다.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md` — 현재 파일이 git diff 에 Modified 로 표시되어 있으나 본 리뷰 페이로드에 포함되지 않음
- **위치**: git status 상 `M spec/conventions/cafe24-api-metadata.md`
- **상세**: git status 에 따르면 `spec/conventions/cafe24-api-metadata.md` 가 수정 상태이나, 본 리뷰 페이로드에는 해당 파일의 diff 가 포함되지 않았다. 따라서 §2 constraints 정의, §7 pseudo-code 갱신(W-1 처리), §5.3 cross-reference(I-4 처리), §9 CHANGELOG 타임스탬프(I-5 처리) 등이 실제로 커밋되었는지 직접 검증하지 못했다. 이 점은 문서화 완전성 관점에서 추적이 필요하다.
- **제안**: spec 파일 diff 가 최종 PR 에 포함됨을 확인. 특히 §9 CHANGELOG 에 2026-05-22 `constraints` 신설 항목이 기재되어 있는지(변경 이력 관점), §7 pseudo-code 가 `buildToolDescription` / `buildJsonSchema` 위임 구조를 반영하고 있는지 확인 권장.

---

### [WARNING] CHANGELOG / 변경 이력 — spec 파일 §9 미확인
- **위치**: `spec/conventions/cafe24-api-metadata.md` §9 CHANGELOG (리뷰 페이로드 외부)
- **상세**: 이번 변경은 `Cafe24OperationMetadata` 인터페이스에 신규 필드(`constraints?: Cafe24FieldConstraint[]`)와 신규 타입(`Cafe24FieldConstraint`)을 추가하고, `validateCafe24Constraints` 공유 헬퍼를 신설하며, `customer_list` 에 첫 번째 실제 constraint 를 적용한 중요한 변경이다. spec 컨벤션 파일의 §9 CHANGELOG 에 이 변경 항목이 기재되어 있어야 한다. consistency-check SUMMARY (I-5) 에서 `<timestamp>` placeholder 를 `12_43_01` 로 교체 처리 완료라고 기록되어 있으나, 최종 반영 여부는 본 리뷰에서 확인 불가하다.
- **제안**: PR merge 전 `spec/conventions/cafe24-api-metadata.md §9 CHANGELOG` 에 다음 항목이 존재하는지 확인:
  - 날짜: 2026-05-22
  - 내용: `Cafe24FieldConstraint` 타입 신설 (`oneOf` / `allOrNone` / `implies`), `Cafe24OperationMetadata.constraints?` 필드 추가, `customer_list` 첫 constraint 적용, `validateCafe24Constraints` 헬퍼 신설

---

### [INFO] 테스트 파일 헬퍼 함수(`op`)의 JSDoc 품질 — 양호
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts` — `op` 헬퍼
- **상세**: `op` 헬퍼 함수에 JSDoc이 있으며 "validator 가 `fields` 와 `constraints` 만 참고하고 `id`/`label`/등은 무시한다"는 핵심 정보가 명시되어 있다. 테스트 파일로서 충분히 적절한 수준이다.
- **제안**: 변경 불필요.

---

### [INFO] `plan/complete/cafe24-conditional-required-impl.md` — plan 문서 완성도 양호
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/plan/complete/cafe24-conditional-required-impl.md`
- **상세**: plan 문서는 §1-§4 체크박스가 모두 `[x]` 이고 commit 해시(`d932cff9`)도 기재되어 있다. "비포함" 섹션에 Phase C (18 resource audit) 및 frontend UI 힌트가 명시적으로 out-of-scope 처리되어 있어 향후 작업과의 경계가 명확하다. `plan/complete/` 로 이미 이동된 상태이며 이력 관리가 올바르게 이루어지고 있다.
- **제안**: 변경 불필요.

---

### [INFO] `plan/in-progress/cafe24-backlog-residual.md` G-1 항목 — 블로커 및 후속 작업 문서화 양호
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-conditional-required-audit-28fb28/plan/in-progress/cafe24-backlog-residual.md` — `G-1` 항목
- **상세**: G-1 항목에 블로커(WebFetch SPA 렌더링 미지원), 우선순위(customer → order → product → ...), 작업 단위(resource batch 마다 commit 분리) 가 문서화되어 있다. spec §6 step 5 를 SoT 로 명시한 것도 적절하다.
- **제안**: 변경 불필요.

---

## 요약

전반적으로 이번 변경의 문서화 수준은 높다. 핵심 신규 타입 `Cafe24FieldConstraint` 와 `Cafe24OperationMetadata.constraints?` 필드에 충실한 TSDoc(spec 참조·invariant·3-kind 설명)이 작성되어 있고, `validateCafe24Constraints` 공개 API 에도 반환 타입·first-only 정책·사용 맥락이 JSDoc 에 명시되어 있다. `buildToolDescription` / `constraintToSuffixLine` 헬퍼에도 spec 섹션 참조와 description 조립 순서가 문서화되어 있다. 인라인 주석은 비자명한 로직(`allOf+anyOf` 래핑 결정, `allOrNone`/`implies` 의 JSON Schema 미변환 이유)에 집중적으로 달려 있어 독자 이해를 돕는다. 개선이 권장되는 사항은 모두 INFO 등급이며, 주된 관심사는 spec 파일의 §9 CHANGELOG 최종 반영 여부(WARNING) 로, PR merge 전 확인이 필요하다.

---

## 위험도

LOW

---

STATUS: success
