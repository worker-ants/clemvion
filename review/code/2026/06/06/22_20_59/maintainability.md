# 유지보수성(Maintainability) 리뷰

**대상 PR**: kb-unsearchable-warning (KB 검색 불가 신호화 + 목록 경고)
**검토 파일**: 17개 (백엔드 4, 프론트엔드 4, plan/review 문서 9)
**날짜**: 2026-06-06

---

## 발견사항

### [WARNING] `withUnsearchable` 헬퍼 함수 — 이름이 동작을 충분히 설명하지 못함
- **위치**: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` +207~210행
- **상세**: `withUnsearchable(r: SearchWithMetaResult): SearchWithMetaResult` 는 "unsearchable 목록이 있으면 결과에 병합한다"는 동작인데, 이름만 보면 "unsearchable 여부를 검사한다"는 predicate로 오독될 수 있다. 비슷한 패턴의 `withRerank`, `withGraphTraversal` 류가 코드베이스 다른 곳에 없어 일관성 선례도 없다. 인라인 클로저인 점과 맞물려 로컬 함수 범위는 좁지만, `searchWithMeta` 함수 내에서 4번 호출되므로 의도 명확화가 권장된다.
- **제안**: `attachUnsearchable` 또는 `mergeUnsearchable` 로 이름 변경. 또는 호출부마다 짧게 인라인 스프레드(`unsearchable.length ? { ...r, unsearchable } : r`)로 분산해 헬퍼 자체를 제거하는 것도 고려.

---

### [WARNING] `diagnosticCount` / `unsearchableCount` — 필드 이름이 역할을 충분히 전달하지 못함
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` +373~374행 (`RagAccumulator` 클래스)
- **상세**: `diagnosticCount`는 "KB tool 호출 횟수"를, `unsearchableCount`는 "그중 unsearchable로 판정된 횟수"를 셈한다. `diagnosticCount`라는 이름은 "진단 데이터 항목 수"로 폭넓게 해석될 수 있어 카운터의 셈 대상이 모호하다. 상단 주석이 의도를 보충하고 있으나, 이름 자체가 의도를 담아야 한다.
- **제안**: `kbToolCallCount` / `unsearchableKbCallCount` 또는 `totalKbCalls` / `unsearchableKbCalls` 로 변경.

---

### [WARNING] `unsearchableHit` 조건 분기 — `results.length === 0` 가드의 필요성이 불명확
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` +546~547행
- **상세**: `if (unsearchableHit && results.length === 0)` 에서 `results.length === 0` 조건이 왜 필요한지 코드만 보면 알기 어렵다. `unsearchable`에 kbId가 포함된다면 이미 searchableKbs 필터에서 제외됐으므로 `results`에 해당 kbId 결과가 들어올 경로가 없다. 이 방어 코드가 실제 가능한 race 경로를 막는 것인지, 아니면 단순 defensive 코딩인지 의도가 불명확하다. 독자가 "이 케이스가 실제로 발생하는가"를 확인해야 하는 인지 부하가 생긴다.
- **제안**: 이 조건이 방어적으로만 존재한다면 인라인 주석 한 줄로 이유를 명시. 실제로 `results.length > 0`이면서 `unsearchableHit`가 있는 경로가 불가능하다면 `results.length === 0` 조건을 제거하고 assertion으로 대체하는 것이 의도를 더 명확히 전달한다.

---

### [WARNING] 프론트엔드 `page.tsx` — `reembedStatus` 조건이 인라인 JSX에 2회 중복
- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` +869~884행
- **상세**: `kb.reembedStatus === "in_progress"` 조건이 `className` 템플릿 리터럴과 아이콘 선택, 텍스트 선택에서 총 3회 등장한다. 단일 상태값에 따른 3가지 파생값을 각각 인라인으로 계산하는 구조라 수정 시 3곳을 모두 바꿔야 한다. 동일 조건의 반복은 중복 코드(DRY 위반)이자 변경 취약점이다.
- **제안**: `<KbUnsearchableBadge reembedStatus={kb.reembedStatus} t={t} />` 와 같은 별도 컴포넌트로 추출하거나, 렌더 직전에 파생 변수(`const isInProgress = kb.reembedStatus === "in_progress"`)를 선언해 단일 참조점을 만든다.

---

### [INFO] `KbRowFixture` 인터페이스에 `reembedStatus: 'idle' | 'in_progress'` 리터럴 타입 하드코딩
- **위치**: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` +43행
- **상세**: 프로덕션 코드의 `KbRow` 인터페이스에도 같은 리터럴 유니온이 정의된다. 테스트 픽스처 타입과 프로덕션 타입이 동기화되지 않으면 미래에 상태값이 추가될 때 테스트가 컴파일 오류 없이 낡아질 수 있다.
- **제안**: 테스트 파일에서 `KbRow['reembedStatus']`를 직접 참조하거나, 공유 타입 파일에서 `ReembedStatus` 타입을 export하여 양쪽에서 import하는 방식을 고려.

---

### [INFO] `kb-tool-provider.ts` — `unsearchable` 변수 타입 선언이 `Awaited<ReturnType<...>>['unsearchable'] | undefined` 형태로 장황
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` +524~526행
- **상세**: `SearchWithMetaResult['unsearchable']` 으로 짧게 쓸 수 있는 타입이 `Awaited<ReturnType<RagSearchService['searchWithMeta']>>['unsearchable'] | undefined` 로 선언되어 있다. 이미 `SearchWithMetaResult`가 export된 타입이므로 직접 참조가 더 읽기 쉽다. 단, `rerankDiagnostics` 변수도 같은 패턴을 사용하고 있어 코드베이스 내 기존 스타일이 해당 패턴을 따르고 있을 가능성이 있다.
- **제안**: `SearchWithMetaResult['unsearchable']` 으로 단순화 또는 `rerankDiagnostics`도 함께 리팩터하되, 기존 패턴 통일이 목적이라면 주석으로 이유를 명시.

---

### [INFO] `kb-tool-provider.spec.ts` `kbCard` 헬퍼 함수 — 테스트 파일 내에만 정의되어 인접 테스트들과 분리됨
- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/__tests__/knowledge-bases-page.test.tsx` +598~612행
- **상세**: `kbCard` 헬퍼가 새 `describe` 블록 내부에 함수로 정의되어 있다. `KnowledgeBasesPage — pagination` 기술 블록의 인라인 픽스처 객체 패턴과 달리 헬퍼 함수를 쓰는 이유(필드 수가 많아 overrides 패턴이 필요)는 타당하다. 다만 `kbCard`라는 이름이 반환 타입을 암시하지 않아(`KbListItem` 등 더 명시적인 이름을 고려 가능), 이 파일이 커질 경우 함수 역할을 추론해야 하는 부담이 생긴다.
- **제안**: `makeKbListItem` 또는 `makeKbCard`처럼 factory 함수임을 이름으로 표현하거나, 파일 상단 테스트 유틸로 이동해 pagination 테스트와 공유. 현재 규모에서는 INFO 수준.

---

## 요약

변경 전체는 "silent 빈 결과"를 "명시적 unsearchable 신호"로 전환하는 단일 목적을 잘 달성하고 있으며, 코드 경로 분기가 `withUnsearchable` 헬퍼와 `searchableKbs` 필터로 명확하게 분리된 점은 긍정적이다. 주요 유지보수성 위험은 세 군데로 압축된다: (1) `withUnsearchable` 헬퍼 이름이 동작을 오독하게 할 수 있고, (2) `RagAccumulator`의 `diagnosticCount` 카운터명이 셈 대상을 특정하지 못하며, (3) 프론트엔드 `page.tsx`에서 `reembedStatus === "in_progress"` 조건이 3회 중복되어 변경 취약점이 생긴다. 이 세 항목은 기능 정확성에는 영향이 없으나 미래 수정자의 인지 부하를 높이므로 WARNING으로 분류한다. 나머지 발견은 읽기 편의 수준의 INFO이다.

## 위험도

LOW
