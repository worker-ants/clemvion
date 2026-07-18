### 발견사항

- **[INFO]** "AST 가드" ↔ "grep" 용어 병용은 본 변경 이전부터 존재하는 서술 습관이며, target 변경과 충돌하지 않는다
  - target 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (정규식 → TS AST 파싱 전환)
  - 충돌 대상: `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1(`system_error`/`rag` 행), §5 Rationale · `spec/conventions/conversation-thread.md` (system_error 단락)
  - 상세: `interaction-type-registry.md` 는 이 가드의 **1차 명칭을 처음부터("AST 가드", 최초 도입 커밋 `1305fdf03`) 일관되게 "AST 가드"로 불러왔다** — §1.2 rule 3, §2.1 의 `system_error`/`rag` 두 행, §5 Rationale ②(총 5회). 실제 구현이 그동안 정규식(`new RegExp`)이었다는 사실과 무관하게, spec 은 처음부터 이 명칭을 1차로 채택했고 "grep" 은 같은 문단 안에서 그 검증 방식(코드에서 문자열 리터럴을 스캔하는 동작)을 가리키는 **부차적·서술적 shorthand** 로 병용돼 왔다(`grep 대상 파일`, `grep 검증 대상`, `grep 가드`, `매트릭스 vs 코드 grep 결과` 등). 또한 `spec/conventions/conversation-thread.md` 도 동일 가드를 "frontend AST 가드"로 교차 참조한다 — 즉 cross-spec 상으로도 이미 "AST 가드"가 정본 명칭으로 통일돼 있다. 이번 변경(`ts.createSourceFile` 기반 실제 AST 파싱 도입)은 코드가 그동안 spec 이 불러온 이름에 **뒤늦게 수렴**하는 방향이며, 어떤 spec 문서의 진술과도 모순되지 않는다. 다만 "grep 대상 파일"·"grep 검증 대상" 같은 부차 표현은 AST 전환 후에도 "그 등록 사이트를 스캔해 등장 여부를 확인한다"는 의미로는 여전히 참이라 즉시 깨지는 진술은 없지만, 신규 개발자에게는 다소 오해 소지가 있다.
  - 제안: **cross-spec 충돌 아님** — spec 개정 의무 없음(project-planner 위임 불필요). 선택적으로(강제 아님) `interaction-type-registry.md` §1.2 rule 3 / §2.1 의 "grep 대상 파일"/"grep 검증 대상"/"grep 가드" 표현을 "(AST 스캔) 대상 파일" 등으로 다듬어 이름 일관성을 높일 수 있으나, 이는 본 impl-prep 변경의 필수 선행 조건이 아니다.

- **[INFO]** 동일 패턴을 인용하는 인접 가드(`ui-label-parity.test.ts`)는 영향 없음
  - target 위치: N/A (참고용 교차 확인)
  - 충돌 대상: `spec/conventions/i18n-userguide.md` §"자동 가드 (P3-B-1)"
  - 상세: 이 문서는 `interaction-type-registry.md` 를 "N 개 갱신 위치 동시 변경" 원칙의 선례로 인용하며, 그 가드 자체는 별도로 regex 기반임을 명시한다. target 변경은 `interaction-type-exhaustiveness.test.ts` 내부 구현만 건드리고 `ui-label-parity.test.ts` 나 그 spec 서술에는 영향이 없다.
  - 제안: 조치 불필요.

### 요약
target 은 `spec/conventions/interaction-type-registry.md` 의 frontmatter `code:` 에 등재된 단일 테스트 파일의 **내부 파싱 메커니즘**(정규식 → TypeScript AST)만 바꾸는 변경이며, 등록 사이트 목록·enum 값 목록·SoT 위치·매트릭스 구조는 그대로 유지한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌하지 않는다. 핵심 판정 질문("AST 가드"라는 명칭이 실제 정규식 구현과 어긋나던 것을 지금 고치는 것이 spec 개정이 필요한 의미 충돌인지)에 대해서는, `interaction-type-registry.md` 자체(최초 도입 커밋부터 5회) 와 `conversation-thread.md` 양쪽이 이미 이 가드를 일관되게 "AST 가드"로 불러왔으므로 — 이번 구현 변경은 (b) 기존 spec 명칭에 **수렴**하는 방향이다. "grep" 이라는 병용 표현은 검증 방식(대상 파일 스캔)에 대한 서술적 shorthand 로 남아도 즉시 거짓이 되지 않으므로, spec 개정은 의무가 아니라 선택적 다듬기 수준이다. developer 는 project-planner 위임 없이 코드 변경만으로 진행 가능하다는 것이 cross-spec 관점의 결론이다.

### 위험도
NONE
