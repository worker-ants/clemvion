# Testing Review — 발견사항

## 발견사항

### [WARNING] 스냅샷 테스트가 실제 `defaultOptions` 구현을 검증하지 않음
- 위치: `/codebase/backend/src/common/cors/web-chat-cors.spec.ts` 라인 246–253 (새 describe 블록)
- 상세: 새로 추가된 테스트 블록은 describe 내부에서 `const defaultOptions = (): CorsOptionsLike => ({ ..., exposedHeaders: ['X-Deleted-Count'] })` 를 직접 인라인 선언한 뒤, 그 함수를 자기 자신이 호출한다. 실제 프로덕션 `defaultOptions` (앱 모듈에서 주입되는 구현체)와는 전혀 연결되지 않는다. 이 테스트는 언제나 PASS이며 "실제 배포된 CORS 설정에 `exposedHeaders: ['X-Deleted-Count']` 가 있는가"를 전혀 검증하지 않는다. 회귀 방지 의도(`AGM-13 회귀 방지`)와 실제 효과가 괴리된다.
- 제안: 실제 앱 초기화 경로(NestJS 모듈 or `AppModule` fixture)에서 `WebChatCorsDelegate` 를 resolve하고 `defaultOptions()` 의 `exposedHeaders` 를 assert하거나, 프로덕션 `defaultOptions` 팩토리를 공개 export해 spec 파일에서 직접 import·호출해야 실질적인 회귀 방지가 된다. 현재 구조대로라면 테스트가 항상 통과하므로 실제 코드에서 `exposedHeaders` 를 삭제해도 이 테스트는 붉어지지 않는다.

### [WARNING] `createWebChatCorsDelegate` 테스트에서 `exposedHeaders` 전파 검증 누락
- 위치: `/codebase/backend/src/common/cors/web-chat-cors.spec.ts` 라인 150–237 (`createWebChatCorsDelegate` describe)
- 상세: `createWebChatCorsDelegate` 위임자는 비-웹채팅 경로에서 `defaultOptions()` 를 그대로 cb에 넘긴다(`cb(null, deps.defaultOptions())`). 기존 테스트들은 `credentials` 전파만 검증하는데(`expect(opts.credentials).toBe(true)`), `defaultOptions` 가 `exposedHeaders` 를 포함했을 때 이것이 실제로 cb 응답에 포함되는지 검증하는 케이스가 없다. 또한 hooks 경로(`{ origin: true, credentials: false }`) 응답에도 `exposedHeaders` 가 필요한지 여부(없어야 한다면 없음을 assert)가 불분명하다.
- 제안: "비-웹채팅 경로에서 `defaultOptions` 가 `exposedHeaders` 를 포함하면 응답에 전파된다" 케이스를 `createWebChatCorsDelegate` describe 안에 추가한다.

### [INFO] hooks·external 경로 응답에 `exposedHeaders` 부재 의도적 명시 없음
- 위치: `/codebase/backend/src/common/cors/web-chat-cors.spec.ts` 라인 156–208
- 상세: `/api/hooks/*` 와 `/api/external/*` 경로는 `{ origin: ..., credentials: false }` 만 반환하고 `exposedHeaders` 를 포함하지 않는다(`web-chat-cors.ts` 라인 86, 101–104). 테스트 코드는 이 부재를 명시적으로 assert하지 않는다. `X-Deleted-Count` 는 internal API(`DELETE /agent-memories`) 응답 헤더이므로 external/hooks 경로에 불필요하지만, 의도적 부재임을 테스트로 문서화하면 향후 오해를 방지할 수 있다.
- 제안: hooks/external 케이스에 `expect(opts.exposedHeaders).toBeUndefined()` 를 선택적으로 추가한다(필수 아님, INFO 수준).

### [INFO] spec 변경(파일 2)은 테스트와 직접 연관 없음
- 위치: `spec/5-system/17-agent-memory.md`
- 상세: spec 문서 변경은 AGM-13 요구사항 ID에 `X-Deleted-Count` echo + CORS `exposedHeaders` 요건을 추가하고 테이블 셀을 단순화한 내용이다. spec 자체는 테스트 대상이 아니므로 테스트 관점에서 직접 이슈는 없다.

---

## 요약

이번 변경에서 핵심 테스트 이슈는 새로 추가된 `'CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)'` describe 블록이 자기 완결적 인라인 함수를 검증하는 형태라 실제 프로덕션 CORS 설정과 연결되지 않는다는 점이다. 이 테스트는 실제 배포 코드에서 `exposedHeaders` 를 삭제해도 PASS하므로 "회귀 방지"라는 목적을 달성하지 못한다. 기존 `createWebChatCorsDelegate` 테스트 suite 에 `defaultOptions`의 `exposedHeaders` 전파를 검증하는 케이스를 추가하고, 실제 앱 또는 실제 export된 `defaultOptions` 팩토리를 사용하도록 수정해야 spec AGM-13 CORS 요건에 대한 실질적인 회귀 방지가 이루어진다. 기존 테스트들(extractExternalExecutionId, isExternalOriginAllowed, parseWidgetOrigins, createWebChatCorsDelegate)은 변경과 무관하게 유효하다.

---

## 위험도

MEDIUM
