## 발견사항

해당 없음

변경된 코드는 다음으로 구성되어 있습니다:
- 순수 문자열 변환 함수 (`harmony-filter.ts`)
- React 렌더 컴포넌트 및 훅 (`assistant-message.tsx`, `assistant-panel.tsx`, `markdown-renderer.tsx`)
- LLM 프롬프트 빌더 함수 (`system-prompt.ts`, 순수 함수)
- 스펙 문서 및 테스트 파일

공유 가변 상태, 락, 비동기 연산, 스레드 간 자원 경쟁이 존재하지 않습니다.

한 가지 패턴을 짚어두자면, `harmony-filter.ts`의 모듈 수준 전역 정규식 상수 (`CHANNEL_BLOCK_RE`, `ROLE_HEADER_RE`, `STRAY_TOKEN_RE`) 는 `/g` 플래그를 갖습니다. `.exec()`·`.test()` 루프에서 사용하면 `lastIndex` 상태 오염이 발생하지만, 현재 코드는 `String.prototype.replace()`와 `matchAll()`을 사용하고 있어 **안전**합니다. `replace()`는 `lastIndex`에 의존하지 않고, `matchAll()`은 내부적으로 정규식을 복사하거나 `lastIndex`를 0으로 초기화합니다.

### 요약

모든 변경 코드는 브라우저의 단일 스레드 이벤트 루프와 React의 렌더링 모델 안에서만 동작합니다. `sanitizeAssistantText`는 외부 상태를 변경하지 않는 순수 함수이며, `useEffect` 기반의 자동 스크롤 로직은 표준 React 패턴을 따릅니다. 동시성 관점에서 위험한 코드 경로는 없습니다.

### 위험도
**NONE**