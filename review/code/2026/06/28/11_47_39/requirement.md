# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] `buildDefaultCorsOptions` 의 SoT 주석이 가리키는 spec 섹션에 `X-Deleted-Count` CORS 명세 부재 (`[SPEC-DRIFT]`)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/cors/web-chat-cors.ts` (신규 `buildDefaultCorsOptions` JSDoc), 같은 함수 내 `// SoT: spec/5-system/17-agent-memory §6 AGM-13`
- 상세: 코드 주석은 `spec/5-system/17-agent-memory §6 AGM-13` 을 `exposedHeaders: ['X-Deleted-Count']` 의 SoT 로 표기하지만, 해당 spec 섹션(§6)은 관리 API 엔드포인트(`DELETE /agent-memories/*`) 정의·editor+ 권한·hard delete·격리만 기술하며 CORS `exposedHeaders` 요구사항을 명문화하지 않는다. `spec/7-channel-web-chat/4-security.md §2` 도 `X-Deleted-Count` 나 `exposedHeaders` 를 언급하지 않는다. 즉 코드 동작(clearScope 삭제 건수를 cross-origin 으로 읽으려면 `X-Deleted-Count` 노출 필수)은 합리적이고 의도적이나 spec 본문에 해당 CORS 요구사항 행이 부재한 것이다.
- 제안: 코드 유지. `spec/5-system/17-agent-memory §6` 또는 `spec/7-channel-web-chat/4-security §2` 에 "scope 전체 삭제(`DELETE /agent-memories?scopeKey=`) 응답은 삭제 건수를 `X-Deleted-Count` 응답 헤더로 반환하고, cross-origin 브라우저가 이를 읽을 수 있도록 서버는 CORS `Access-Control-Expose-Headers: X-Deleted-Count` 를 설정해야 한다" 항목을 project-planner 가 추가해야 한다.

### [INFO] 기존 `createWebChatCorsDelegate` describe 의 `defaultOptions` 테스트 픽스처가 `exposedHeaders` 를 포함하지 않음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/cors/web-chat-cors.spec.ts` line 198-201 (`const defaultOptions = (): CorsOptionsLike => ({ origin: () => {}, credentials: true })`)
- 상세: 이 픽스처는 `exposedHeaders` 없는 최소 객체다. 신규 테스트 케이스("비-웹채팅 경로 → defaultOptions 의 exposedHeaders 를 응답에 전파")는 이 픽스처 대신 실제 `buildDefaultCorsOptions` 를 직접 주입해 검증하므로 전파 여부가 정확히 커버된다. 나머지 테스트들은 `credentials` · `origin` 동작만 검증하므로 픽스처에 `exposedHeaders` 누락이 오탐을 유발하지 않는다. 실질적 문제는 없으며 의도적 최소 픽스처다.
- 제안: 현행 유지. 필요 시 추후 `exposedHeaders`가 없는 케이스를 명시적으로 주석으로 표기하면 가독성 향상.

### [INFO] `buildDefaultCorsOptions` 위치가 `createWebChatCorsDelegate` 뒤에 있어 읽기 흐름이 역순
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/cors/web-chat-cors.ts` line 506-526 (함수 선언 순서)
- 상세: `createWebChatCorsDelegate` 내부에서 `deps.defaultOptions()` 를 호출하지만(line 502), `buildDefaultCorsOptions` 는 그 아래에 정의되어 있다. TypeScript 에서는 hoisting 이슈 없이 컴파일되므로 런타임 문제는 없다. 단 독자가 두 함수의 관계를 파악하려면 스크롤 다운이 필요하다.
- 제안: 선택적 개선. `buildDefaultCorsOptions` 를 `createWebChatCorsDelegate` 앞으로 이동하면 논리적 선언 순서와 일치하나 현재도 정상 동작이므로 차단 항목 아님.

## 요약

이번 변경은 `main.ts` 부트스트랩의 인라인 CORS 옵션 정의를 `buildDefaultCorsOptions(originCallback)` 순수 팩토리로 추출하고, 기존 동어반복(자가검증) 테스트를 실제 팩토리를 import 해 검증하는 테스트로 대체한 리팩터링이다. 기능 완전성 면에서 (1) `exposedHeaders: ['X-Deleted-Count']` 가 프로덕션 런타임에서 이전과 동일하게 적용되고, (2) 이제 단위 테스트가 실제 팩토리를 import 하여 해당 필드를 검증하므로 프로덕션 코드에서 제거 시 테스트가 진짜 실패한다는 회귀 방지 목적이 달성됐다. (3) delegate 경로로 `exposedHeaders` 가 전파되는지 추가 케이스도 커버한다. 에러 시나리오·엣지 케이스·반환값 경로 모두 기존과 동일하게 유지된다. 유일한 발견사항은 코드가 참조 SoT 로 표기한 `spec/5-system/17-agent-memory §6` 에 `X-Deleted-Count` CORS 노출 요구사항이 명문화되지 않은 spec 갱신 누락(SPEC-DRIFT)으로, 코드 버그가 아니라 spec 보완 과제다.

## 위험도

NONE
