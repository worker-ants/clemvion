### 발견사항

- **[INFO]** `buildDefaultCorsOptions` 신규 named export 도입
  - 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` L374-382
  - 상세: 기존 인터페이스에 새 export 를 additive 하게 추가. 기존 `createWebChatCorsDelegate`, `parseWidgetOrigins` 등의 시그니처는 무변경이며 기존 호출자에 영향 없음.
  - 제안: 추가 조치 불필요.

- **[INFO]** `main.ts` 의 `defaultOptions` 람다 인라인 → `buildDefaultCorsOptions` 위임으로 대체
  - 위치: `codebase/backend/src/main.ts` bootstrap 함수 내 `createWebChatCorsDelegate` 호출부
  - 상세: 런타임 동작 동일(`origin: corsOriginCallback`, `credentials: true`, `exposedHeaders: ['X-Deleted-Count']`). 이전 인라인 객체와 반환 형태가 1:1 대응하며, 팩토리는 순수 함수(입력 → 새 객체, 전역·외부 의존 없음)로 의도치 않은 상태 변경 없음.
  - 제안: 추가 조치 불필요.

- **[INFO]** 테스트 파일 describe 재편 — 동어반복 스냅샷 제거 + 실 팩토리 검증으로 교체
  - 위치: `codebase/backend/src/common/cors/web-chat-cors.spec.ts`
  - 상세: 테스트 파일은 프로덕션 런타임에 영향 없음. 테스트 내 `buildDefaultCorsOptions(() => {})` 호출은 순수 함수 호출이며 공유 상태·전역 변수·파일시스템·네트워크 영향 없음. 기존 `CORS exposedHeaders 스냅샷` describe 제거는 테스트 코드 정리이며 프로덕션 기능에 무영향.
  - 제안: 추가 조치 불필요.

### 요약

이번 변경은 `main.ts` 부트스트랩의 인라인 CORS 옵션 객체를 `web-chat-cors.ts` 의 순수 팩토리 함수 `buildDefaultCorsOptions` 로 추출한 리팩터링이다. 반환 객체의 내용(`origin`, `credentials`, `exposedHeaders`)이 이전과 동일하여 런타임 동작은 변화가 없다. 새 export 는 additive 변경이라 기존 import 사용자를 깨지 않는다. 팩토리는 전역 상태·파일시스템·네트워크·이벤트에 전혀 접근하지 않는 완전한 순수 함수이며, 테스트 변경도 테스트 코드 범위 안에서만 이루어진다. 의도치 않은 부작용은 발견되지 않는다.

### 위험도

NONE
