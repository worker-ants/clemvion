### 발견사항

- **[INFO]** 변경 범위 내 신규 외부 의존성 없음
  - 위치: 전체 diff
  - 상세: `shadow-workflow.ts`와 `system-prompt.ts` 모두 기존 import 목록 변경 없음. 신규 `labelLookalikeHint` 메서드는 동일 파일 내 `sanitizeLlmProvidedString`과 `LABEL_HINT_MAX_LEN` 상수만 참조.
  - 제안: 해당 없음

- **[INFO]** 내부 모듈 의존 관계 정합성 확인
  - 위치: `shadow-workflow.ts` — `labelLookalikeHint` 메서드
  - 상세: `sanitizeLlmProvidedString`은 동일 파일 하단에 export된 함수이며, `LABEL_HINT_MAX_LEN`도 동일 파일 상수(`= 80`). 외부 모듈로의 추가 커플링 없음.
  - 제안: 해당 없음

- **[INFO]** `node:crypto` (randomUUID) — 기존 사용 패턴 유지
  - 위치: `shadow-workflow.ts` 기존 import
  - 상세: 이번 변경에서 Node.js 내장 모듈 사용 방식에 변화 없음. 이미 존재하던 의존 관계.
  - 제안: 해당 없음

---

### 요약

이번 변경은 `labelLookalikeHint` 메서드 추가와 시스템 프롬프트 텍스트 보강으로 구성되며, 외부 패키지 추가·버전 변경·내부 모듈 간 새로운 커플링이 전혀 없다. 모든 신규 코드는 동일 파일 내 기존 유틸리티(`sanitizeLlmProvidedString`, `LABEL_HINT_MAX_LEN`)만 참조하며, 의존성 관점에서 리스크 요인이 없는 순수 로직 추가다.

### 위험도
**NONE**