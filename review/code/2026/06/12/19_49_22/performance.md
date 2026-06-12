# 성능(Performance) Review

## 발견사항

### **[INFO]** `compileUserRegex` 호출마다 `safeRegex()` 정적 분석 실행 — 캐시 부재
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` — `compileUserRegex` 함수 및 `compileRegexCache`
- 상세: `safe-regex` 라이브러리(`safeRegex(source)`)는 정규식 AST 파싱 + 백트래킹 분석을 수행한다. `compileRegexCache`(switch/if-else/transform array_filter 경로)는 workflow 실행마다 conditions 배열을 재분석하는데, 동일 패턴에 대해 매번 `safeRegex`가 재실행된다. Filter의 `getRegex`는 이미 `regexCache`로 중복 컴파일을 방지하지만, `compileRegexCache`에는 해당 캐시가 없다.
- 제안: `compileRegexCache`의 내부 캐시 미스는 실제로는 노드 실행 단위(workflow 실행 1회당 1번 호출)라 반복 우려가 낮다. 동일 workflow 노드를 짧은 간격으로 반복 실행하는 경우를 대비해 모듈 레벨의 `Map<string, RegexCompileResult>`에 결과를 메모이제이션하는 것을 고려할 수 있다. 현재 패턴 수(조건 당 최대 수십 개)와 `safe-regex`의 연산 비용(ms 이하) 수준에서는 실질 영향 낮음.

---

### **[INFO]** `safe-regex`를 production dependencies에 포함 — 런타임 패키지 크기
- 위치: `codebase/backend/package.json` — `dependencies` 섹션
- 상세: `safe-regex@^2.1.1`이 devDependencies가 아닌 dependencies에 추가됐다. `regexp-tree`를 런타임 의존성으로 포함시켜 Node.js 배포 번들 크기가 소폭 증가한다. `@types/safe-regex`는 devDependencies에 올바르게 배치돼 있다. `safe-regex`는 정적 분석 도구 성격으로, 빌드 타임 린트/테스트 단계에서만 사용할 수 있다면 devDependencies가 적합할 수 있으나, 런타임 `compileUserRegex` 함수에서 직접 호출하므로 현재 배치는 기능상 필수이다.
- 제안: 현재 사용 방식(런타임 호출) 기준으로는 문제 없음. 번들 크기 최소화가 필요하다면, `compileUserRegex`를 빌드 타임에 pre-compile된 안전 패턴 집합과 비교하는 방식으로 리팩터링해 devDependency로 이전하는 것을 장기적으로 검토할 수 있다.

---

### **[INFO]** WebSocket `workflow:` authorizer — subscribe마다 DB 조회
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `workflow:` authorizer 블록
- 상세: `WorkflowsService.findById(workflowId, workspaceId)` 는 subscribe 이벤트마다 DB 조회를 수행한다. 소켓 연결 수명 동안 동일 클라이언트가 같은 `workflow:` 채널을 재구독하거나(새로고침/재연결) 다수 workflow 채널을 구독할 경우 조회가 누적된다. 이는 기존 `execution:` 및 `kb:` authorizer와 동일한 패턴으로, 본 변경이 새 문제를 도입한 것은 아니다. 비-UUID 사전 차단으로 불필요한 DB 진입은 방어됨.
- 제안: authorizer 결과를 소켓 세션 단위(`enriched.authorizedChannels: Set<string>`)로 메모이제이션하면 재구독 시 DB 조회를 생략할 수 있다. 단, 워크플로우 삭제/소유권 변경 시 캐시 무효화 전략이 필요하므로 현재 단순 조회 방식이 안전하다. 트래픽 규모가 충분히 커질 경우에만 검토할 것.

---

### **[INFO]** `isSwaggerEnabled(process.env)` 부팅 시 2회 호출
- 위치: `codebase/backend/src/main.ts` — `bootstrap` 함수 내 2곳
- 상세: `isSwaggerEnabled(process.env)`가 `setupSwagger(app)` 조건과 console.log 조건 두 곳에서 독립적으로 호출된다. 함수 자체는 2번의 문자열 비교에 불과해 성능 영향은 무시할 수준이다.
- 제안: 부팅 1회 실행이므로 실질 영향 없음. 가독성 개선 목적으로 `const swaggerEnabled = isSwaggerEnabled(process.env)`로 한 번만 평가하는 것은 선택 사항.

---

### **[INFO]** `safe-html.ts` — DOMPurify 설정 상수가 모듈 레벨에 올바르게 정의됨
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP` 상수
- 상세: `ALLOWED_TAGS`(배열), `ALLOWED_ATTR`(배열), `ALLOWED_URI_REGEXP`(RegExp)는 모두 모듈 레벨 상수로 선언돼 재할당 없이 동일 참조가 `renderTemplateHtml` 호출마다 전달된다. DOMPurify 내부에서 매 호출마다 이 배열을 참조하지만 객체 자체가 재생성되지 않으므로 메모리 할당 오버헤드 없음. 현재 구현이 최적.
- 제안: 변경 불필요.

---

## 요약

이번 변경은 보안 강화(ReDoS 방어, IDOR 차단, Swagger 게이팅, HTML 화이트리스트)를 목표로 하며 성능 관점에서 구조적 결함은 없다. 주요 성능 관련 고려 사항은 두 가지다: (1) `compileUserRegex` 내 `safe-regex` 정적 분석이 동일 패턴에 대해 반복 실행될 수 있으나, 실제 호출 빈도(노드 실행 단위)와 `safe-regex`의 낮은 연산 비용을 고려하면 실질 병목이 아니다. (2) WebSocket `workflow:` authorizer의 subscribe마다 발생하는 DB 조회는 기존 채널 authorizer 패턴과 동일하며, 비-UUID 사전 차단으로 불필요한 DB 진입은 방지된다. 전반적으로 성능 위험을 유발하는 변경은 없다.

## 위험도

NONE
