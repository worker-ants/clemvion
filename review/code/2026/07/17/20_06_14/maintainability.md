# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 테스트 주석이 내부 구현 변수명에 직접 결합됨
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` 신규 3개 테스트 (line 40-96, 파일 내 실제 위치는 735-791)
  - 상세: 각 테스트의 "고립 조건" 주석이 `hasLegacyMessages`, `outputInteraction`, `hasConvConfig`, `metaInteraction`, `isCanonicalWaiting` 등 `output-shape.ts` 내부 지역 변수명을 그대로 인용한다. 테스트 자체는 fixture shape 로만 동작해 변수명 리네이밍에 안전하지만, 주석은 소스가 리팩터링(변수명 변경)될 때 수동으로 동기화하지 않으면 조용히 stale 해진다. mutation-testing 의도를 명확히 설명하는 좋은 관행이지만, "왜 이 분기가 격리되는지"를 조건식 자체(예: `output.interactionType` 존재/부재)로 서술하고 변수명은 참고용 각주로 격리하면 리팩터링 내성이 더 커진다.
  - 제안: 변수명은 "(내부적으로 `hasConvConfig`)" 식의 부기로 남기고, 본문 설명은 조건 그 자체(존재/부재하는 필드)로 서술을 우선.

- **[WARNING]** 주석 내 하드코딩된 라인 번호 참조가 이미 근접 드리프트 상태
  - 위치: `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` line 1362 (`result-timeline.tsx:168`)
  - 상세: 실제로 `buildConvConfigFromStructured(rawForConv)` 호출은 `result-timeline.tsx:180`에 있고, 168번 라인은 그 위 설명 주석의 중간 줄이다 — 즉 참조 자체가 이미 약 12줄 어긋나 있다. 컴파일러/린터가 검증하지 않는 매직 라인 번호라 향후 해당 파일이 조금만 편집돼도 조용히 더 어긋난다. 이 PR 이 다루는 근본 결함(`#959`: 손으로 베낀 목록이 SoT 와 drift)과 동일한 유형의 "출처 참조가 코드보다 stale 해지는" 패턴이라는 점에서 지적할 가치가 있다.
  - 제안: 라인 번호 대신 함수명(`buildConvConfigFromStructured`) 또는 앵커 주석(예: `// MAXTURNS_MERGE_ANCHOR`)으로 참조해 라인 이동에 강건하게 만들 것.

- **[INFO]** 동일한 "why" 설명이 두 파일(JSDoc·테스트 주석)에 독립적으로 존재
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` line 986-994 (신규 "No known producer" 단락) ↔ `output-shape.test.ts` line 36-39, 731-734 (동일 취지의 "OR-체인 분기 고립" 설명)
  - 상세: 두 설명은 서로를 산문으로 참조("삭제하면 그 테스트가 red 로 드러난다")하지만 툴링으로 강제되지 않는 이중 SoT 다. 향후 `isConversationOutput` 의 분기가 추가/변경될 때 JSDoc 만 갱신되고 테스트 주석은 갱신되지 않거나 그 반대가 될 위험이 있다. 다만 이 PR 이 의도한 "mutation 무방비 상태 해소"라는 목적에는 부합하고, 코드(테스트 자체)는 여전히 실측 가드 역할을 하므로 실질적 위험은 낮다.
  - 제안: 필요시 JSDoc 쪽에서 "격리 테스트 목록은 `__tests__/output-shape.test.ts` 의 `OR-체인 분기 고립` 절 참고"라는 단일 지시어만 남기고 세부 조건 나열은 한쪽에만 두는 것도 고려.

- **[INFO]** JSDoc 내 언어 전환(영어 → 한국어)이 한 주석 블록 안에서 발생
  - 위치: `output-shape.ts` line 959-994 (`isConversationOutput` 함수 JSDoc)
  - 상세: 기존 JSDoc 은 영어 산문으로 시작하는데, 이번 변경으로 추가된 "No known producer" 단락은 한국어로 이어붙어 같은 주석 블록 안에서 언어가 전환된다. 파일의 다른 곳(예: RAG 타입 재export 주석, 대화 종결 사유 주석)은 이미 한국어 단독 주석이 많아 리포지토리 전체 컨벤션과 충돌하는 것은 아니지만, 동일 JSDoc 블록 내 혼용은 가독성 측면에서 약간의 인지 부담을 준다.
  - 제안: 사소한 사항이라 강제할 필요는 없음 — 다만 향후 이 함수의 JSDoc 을 다시 손볼 때는 언어를 통일하거나 단락 전환 지점에 명확한 구분(예: 별도 헤더)을 두는 것을 권장.

## 요약

이번 변경은 순수하게 회귀 테스트 3건 추가(OR-체인 분기 고립을 통한 mutation coverage 보강)와 그에 대응하는 JSDoc/주석 갱신(각 분기의 실제 producer 유무를 전수 확인해 문서화)으로, 로직 변경이 전혀 없는 문서화·테스트 강화 PR 이다. 새 테스트는 기존 파일의 스타일(단일 `it` + 인라인 fixture + 상세 한국어 주석)을 그대로 따르고 테스트명도 무엇을 검증하는지 명확해 가독성·일관성 문제는 없다. 다만 테스트 주석이 내부 변수명에 다소 강하게 결합돼 있는 점, `result-timeline.tsx:168` 처럼 이미 실제 위치에서 벗어난 하드코딩 라인 번호 참조, 그리고 동일한 설명이 두 파일에 독립 SoT 로 존재하는 점은 향후 리팩터링 시 조용한 문서 drift 위험으로 남는다. 모두 차단 사유는 아니고 경미한 개선 여지에 해당한다.

## 위험도
LOW
