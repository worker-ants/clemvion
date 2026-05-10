### 발견사항

- **[INFO]** `errorDurationMs` 측정 위치가 `truncateForErrorDetails()` 이후
  - 위치: `handler.ts` catch 블록 (diff +10)
  - 상세: `const truncatedInput = truncateForErrorDetails(inputField, 500)` 이후에 `Date.now() - callStartedAt`가 계산되므로 실제 LLM 호출 시간에 `truncateForErrorDetails` 실행 시간이 포함됨. 입력이 길수록 (최대 500자 cap 전 원문이 클수록) 미세한 오차 발생
  - 제안: `callStartedAt`과 별개로 catch 진입 즉시 `const catchEnteredAt = Date.now()`를 찍어 LLM 호출 종료 시각으로 쓰거나, 현재 순서(truncate → timestamp)를 반전해 timestamp를 catch 블록 최초 줄에 배치. 실용적 영향은 수 마이크로초 수준으로 무시 가능하나 spec §5.3의 "LLM 호출 throw 직전 측정" 정의와 미세하게 어긋남

- **[INFO]** `requestPayload`(시스템 프롬프트 포함) 전체가 에러 응답에 참조 포함
  - 위치: `handler.ts` 에러 return의 `llmCalls[0].requestPayload`
  - 상세: `requestPayload.messages[0].content`에는 카테고리 목록 + instructions로 구성된 시스템 프롬프트 전체가 들어 있음. 카테고리 수가 많거나 examples가 길면 수 KB에 달할 수 있고, 이 참조가 에러 응답 객체에 포함되어 직렬화(JSON 응답, 로그 등)될 때 그대로 복사됨. 성공 경로도 동일 구조를 이미 사용 중이므로 이번 diff에서 새로 도입된 문제는 아님
  - 제안: 현재 설계(디버그 트레이스 목적)상 허용 가능. 필요 시 `requestPayload` 직렬화 시점에 `messages[0].content`를 일정 길이로 cap하는 `sanitizeRequestPayload` 유틸 도입을 별도 개선으로 고려

- **[POSITIVE]** `errorDurationMs` 단일 계산 후 `meta.durationMs`와 `llmCalls[0].durationMs` 공유
  - 위치: `handler.ts` diff +10~+18
  - 상세: 별도 두 번의 `Date.now()` 호출 대신 하나의 값을 재사용하여 두 필드 간 타임스탬프 드리프트(수 마이크로초)를 원천 차단. 올바른 구현

- **[POSITIVE]** 에러 경로에서 `requestPayload` 재참조 (재생성 없음)
  - 위치: `handler.ts` try 블록 이전에 이미 생성된 객체를 catch에서 참조만 함
  - 상세: 에러 발생 시 모델명 등 메타를 얻기 위해 `requestPayload`를 재구성하지 않고 이미 할당된 객체를 참조하므로 추가 힙 할당 없음

---

### 요약

이번 변경은 에러 경로의 `meta: {}` → `meta: { durationMs, model, llmCalls }` 채우기로, 성능 관점의 실질적 영향은 `Date.now()` 한 번 추가 호출과 소형 객체 리터럴 생성 하나에 불과하다. `requestPayload` 재사용, 단일 타임스탬프 공유 등 구현 방식 자체는 효율적이다. 에러 응답에 시스템 프롬프트 전체가 참조 포함되는 점은 기존 성공 경로와 동일한 패턴이며, 이번 diff에서 새로 도입된 문제가 아니다. 테스트 파일의 추가 케이스는 단위 테스트 특성상 런타임 성능에 무관하다.

### 위험도

**LOW**