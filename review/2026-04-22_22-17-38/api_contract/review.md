### 발견사항

해당 없음

이 변경사항은 HTTP API 엔드포인트, REST 경로, 외부 API 스키마와 무관하다. 변경 범위는 다음과 같다:

- `buildSystemPrompt(nodeDefs, snapshot, activePlanContext?)` 함수의 **시그니처 불변** — 기존 호출부에 대한 breaking change 없음
- 내부 프롬프트 문자열 조립 순서 재구성 (정적 블록 앞, 동적 블록 뒤)
- 테스트 파일의 구조 검증 케이스 추가
- 메모리 문서 추가

LLM 툴 호출 규약(`propose_plan`, `finish`, `add_node` 등)이 프롬프트 텍스트로 기술되어 있으나, 이는 실제 API 스키마가 아닌 LLM에 대한 지시문이며 실제 툴 정의는 별도 모듈에 위치한다.

### 요약

이번 변경은 내부 함수 `buildSystemPrompt`의 출력 텍스트 구조를 재편한 리팩토링으로, 공개 API 계약(함수 시그니처, HTTP 엔드포인트, 응답 스키마)에 영향을 주지 않는다. API 계약 관점에서 검토할 대상이 존재하지 않는다.

### 위험도

NONE