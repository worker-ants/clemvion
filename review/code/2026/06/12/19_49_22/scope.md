# 변경 범위(Scope) 리뷰 결과

## 발견사항

범위를 벗어난 항목이 발견되지 않았다. 아래는 참고용 INFO 수준 관찰이다.

**[INFO]** `main.ts` — `setupSwagger` 함수 추출 (리팩토링 동반 변경)
- 위치: `codebase/backend/src/main.ts` 전체 diff
- 상세: Swagger 설정 블록을 `bootstrap()` 에서 `setupSwagger(app)` 으로 추출한 리팩토링이 포함된다. 이는 `isSwaggerEnabled` 게이팅(04 M-1) 구현의 필수 선행 단계다 — 조건부 호출을 위해 함수 경계를 먼저 만들어야 한다. 독립적 리팩토링이 아니라 기능 변경에 종속된 구조 변경이므로 범위 내로 판단한다.
- 제안: 없음

**[INFO]** `websocket.gateway.ts` — `authorize` 시그니처를 `(channel, workspaceId)` → `(channel, { workspaceId, userId })` 로 변경
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 인터페이스 정의 부근
- 상세: `notifications:` 채널 authorizer(04 M-6) 추가로 `userId` 컨텍스트가 새로 필요해졌다. 기존 `execution:`·`kb:`·`background:run:` authorizer 들도 시그니처를 맞추기 위해 `{ workspaceId }` 디스트럭처링으로 변경됐다. 내부적으로 동일 값을 사용하므로 동작 변화가 없다. 신규 기능 추가에 따른 필수 계약 변경으로 범위 내다.
- 제안: 없음

**[INFO]** `filter.handler.ts` 및 `condition-evaluator.util.ts` — 주석·JSDoc 갱신
- 위치: `codebase/backend/src/nodes/logic/filter/filter.handler.ts`, `codebase/backend/src/nodes/core/condition-evaluator.util.ts`
- 상세: 거부 동작이 실제로 확장됐으므로(ReDoS-unsafe 패턴 추가 거부) 주석·JSDoc 갱신은 정당하다.
- 제안: 없음

**[INFO]** `package-lock.json` — `@nestjs-modules/mailer` 간접 의존성 및 `uglify-js "dev": true` 자동 기록
- 위치: `codebase/backend/package-lock.json` diff 내 `chokidar`·`glob-parent`·`readdirp`·`uglify-js` 항목
- 상세: `npm install` 실행 시 npm 이 기존에 미기록된 peerDep 트리를 함께 해석·기록하고 `uglify-js` 분류를 재평가한 결과다. 수동 변경이 아니라 도구 자동 생성 항목이므로 범위 위반으로 분류하지 않는다.
- 제안: 없음

---

## 요약

모든 변경은 "refactor 04" 보안 작업(M-1 Swagger 게이팅, M-3 ReDoS 가드, M-6 WebSocket IDOR 차단)의 의도된 범위 내에 있다. `main.ts` 의 `setupSwagger` 함수 추출은 조건부 게이팅을 위한 필수 구조 변경이고, authorizer 시그니처 확장은 `notifications:` 채널 추가의 필연적 결과이며, 주석·JSDoc 갱신은 실제 동작 변경을 정확히 반영한다. lock 파일의 간접 의존성 추가는 npm 도구가 자동 생성한 항목이다. 의도와 무관한 파일·코드 영역 수정, 불필요한 리팩토링, 기능 확장, 포맷팅만을 위한 변경은 발견되지 않았다.

## 위험도

NONE
