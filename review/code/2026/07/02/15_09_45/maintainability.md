# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** `const resumeState = state as ResumeState;` narrowing 이 파일 내 3곳(2107, 2449~, 2921~ 부근)에서 동일 패턴으로 반복
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (조건-라우트 헬퍼, 메인 continue 루프, `buildMultiTurnFinalOutput` 진입부)
  - 상세: 세 메서드 모두 `state: Record<string, unknown>` 파라미터를 받아 각자 로컬에서 `ResumeState` 로 재단언한다. 각 diff 주석도 "state 는 재할당되지 않음" 이라는 동일 전제를 반복 서술한다. 기능적으로는 문제 없으나(파라미터 타입이 공개 핸들러 인터페이스 제약이라 시그니처 변경이 어렵다는 점은 주석에 설명되어 있음), 동일한 3줄 캐스트+설명 패턴이 반복된다.
  - 제안: 현재로선 스코프가 각기 다른 메서드라 리팩터링 압박은 낮음(INFO). 추후 4번째 지점이 생기면 `narrowResumeState(state)` 같은 작은 헬퍼로 추출해 캐스트 근거 주석을 한 곳에 모으는 것을 고려.

- **[INFO]** `resumeState` 변수명이 이미 `ResumeState` import 별칭(`state`) 과 함께 쓰여 다소 장황
  - 위치: `ai-turn-executor.ts` 전역 (`resumeState.turnDebugHistory`, `resumeState.allPresentations` 등 다수)
  - 상세: `state`(원본 `Record<string, unknown>`)와 `resumeState`(좁혀진 타입) 두 변수가 같은 스코프에 공존한다. 의도적 구분(공개 인터페이스 파라미터명 유지 vs 로컬 narrowing)이며 주석으로 명확히 설명되어 있어 가독성 저하는 크지 않음. 다만 두 변수를 혼용하는 실수(state 로 직접 접근해 이전처럼 `as` 캐스트를 다시 쓰는 회귀) 가능성은 코드 리뷰 시 주의가 필요.
  - 제안: 특별한 조치 불요. 향후 동일 패턴 추가 시 `state`/`resumeState` 사용처 구분 원칙("raw read 는 state, allow-list 필드는 resumeState")을 주석 또는 컨벤션 문서에 1회 명시하면 좋음.

- **[INFO]** 스키마 주석 밀도가 높아 일부 라인 압축률 저하
  - 위치: `resume-state.schema.ts` L43-47, L57-59, L201-203
  - 상세: `z.custom<T>()` 도입 근거(런타임 미검증 유지)를 세 지점에서 유사한 문구로 반복 설명한다. 각 라인 자체는 정확하고 향후 오독(예: "z.custom 이 검증한다"는 오해)을 막기 위한 의도적 중복으로 보이나, 동일 설명이 파일 상단 큰 doc-comment(L84-91)에도 이미 있어 3중 반복이다.
  - 제안: 파일 상단 doc-comment 에 "왜 custom 인지" 원칙을 1회 정리하고, 필드별 주석은 "여기 필드가 그 원칙의 적용 사례"라는 짧은 참조로 축약하면 유지보수 시 문구 동기화 부담이 줄어든다. 다만 현재도 문서 품질은 높고 혼란을 줄 수준은 아니므로 강제성 낮음.

- **[INFO]** `z.custom<ChatMessage>()` / `z.custom<unknown[]>()` / `z.custom<PresentationPayload[]>()` 세 스타일이 공존
  - 위치: `resume-state.schema.ts` L48, L64-65 / diff 상
  - 상세: `messages` 는 `z.array(z.custom<ChatMessage>())`(원소 단위 custom), `turnDebugHistory`/`allPresentations` 는 `z.custom<unknown[]>()`/`z.custom<PresentationPayload[]>()`(배열 전체 단위 custom)로 스타일이 다르다. 둘 다 "런타임 미검증, 타입만 sharpen" 이라는 동일 목적이지만 표현 방식이 다르면 다음에 필드를 추가하는 개발자가 어떤 스타일을 따라야 할지 헷갈릴 수 있다.
  - 제안: 주석에 "배열 원소 각각의 도메인 타입이 유의미하면 `z.array(z.custom<T>())`, 배열 자체를 단일 opaque 타입으로 다루면 `z.custom<T[]>()`" 같은 선택 기준 한 줄을 남기면 향후 필드 추가 시 일관성 유지에 도움이 된다.

## 요약

두 파일 모두 이미 매우 상세한 도메인 주석과 spec 참조를 갖춘 성숙한 코드베이스이며, 이번 M-7 변경은 `z.unknown()` → `z.custom<T>()` 전환과 그에 따른 소비처의 `as ChatMessage[]` 류 캐스트 제거라는 좁고 명확한 범위의 리팩터링이다. 새로운 함수·조건 분기·매직 넘버는 도입되지 않았고, 기존에 3곳에서 반복되던 `(state.X as Y)` 캐스트가 `resumeState.X`로 단순화되어 오히려 가독성이 개선되었다. 유일하게 눈에 띄는 점은 narrowing 변수 선언과 관련 주석이 파일 내 여러 메서드에 유사하게 반복된다는 것과 스키마 주석이 다소 장황하다는 것인데, 둘 다 기능적 결함이 아니라 문서 압축 여지에 가깝다. 전반적으로 유지보수성 관점에서 개선(회귀 위험 낮음, 캐스트 제거로 타입 안전성 향상)에 해당한다.

## 위험도
NONE
