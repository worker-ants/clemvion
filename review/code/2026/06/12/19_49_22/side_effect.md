# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 4·5: production-guards.ts / main.ts — `isSwaggerEnabled` 신규 export

- **[INFO]** `isSwaggerEnabled` 함수 신규 export (공개 API 추가)
  - 위치: `codebase/backend/src/common/config/production-guards.ts:731`
  - 상세: 순수 함수로 `env` 맵만 읽으며 전역 상태·파일시스템·네트워크 어느 것도 변경하지 않는다. `process.env` 를 기본값으로 갖는 파라미터 패턴은 기존 `assertProductionConfig`·`isFlagOn` 과 동일한 패턴이므로 일관성 있다. 기존 호출자가 없는 신규 심볼이라 호환성 문제 없음.
  - 제안: 이상 없음.

- **[INFO]** `main.ts` — `isSwaggerEnabled` 를 부팅 시 두 곳에서 호출
  - 위치: `codebase/backend/src/main.ts:1027`, `1250`
  - 상세: `setupSwagger(app)` 조건부 래핑과 부팅 로그 게이팅에서 각각 `isSwaggerEnabled(process.env)` 를 호출한다. 두 호출 사이에 `process.env.NODE_ENV`·`process.env.ENABLE_SWAGGER_IN_PROD` 가 바뀔 수는 없으므로(Node.js 단일 스레드 동기 부팅 플로우) 결과 불일치 위험 없음. 부작용 없음.
  - 제안: 이상 없음.

---

### 파일 7: websocket.gateway.ts — `authorize` 시그니처 변경

- **[WARNING]** 내부 타입 `channelAuthorizers` 의 `authorize` 시그니처를 `(channel, workspaceId: string)` → `(channel, ctx: {workspaceId: string; userId: string})` 로 변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:83`
  - 상세: `channelAuthorizers` 는 클래스 내부 private 멤버 배열이며 외부로 export 되지 않는다. 시그니처 변경의 영향 범위는 동 파일의 authorizer 객체 리터럴들(execution/workflow/notifications/kb/background — 모두 이번 diff 에서 같이 업데이트됨)과 `handleSubscribe` 내 단일 호출부로 제한된다. 모든 호출자가 이번 diff 에서 일괄 업데이트됐으므로 런타임 호환성 문제 없음.
  - 제안: 이상 없음.

- **[INFO]** `WorkflowsService` DI 추가 — 생성자 파라미터 확장
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:97`
  - 상세: `@Inject(forwardRef(() => WorkflowsService))` 를 생성자에 추가한다. NestJS DI 컨테이너가 이를 해소하며, `WebsocketModule` 에 `forwardRef(() => WorkflowsModule)` 임포트가 함께 추가됐다. 기존 `KnowledgeBaseService` 와 동일한 forwardRef 패턴이므로 순환 참조 위험이 낮으나, 계획 파일에서 "실 부팅/e2e 확인 필요" 주석이 달려 있어 이 점은 부작용 관점이 아닌 통합 검증 이슈다.
  - 제안: e2e 또는 실 부팅 테스트로 DI 순환 해소 여부를 확인할 것(기 계획 파일에 TODO 기재).

---

### 파일 10: condition-evaluator.util.ts — `safeRegex` 라이브러리 import + `compileUserRegex` 신설

- **[INFO]** `import safeRegex from 'safe-regex'` — 새 런타임 의존성 도입
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts:1`
  - 상세: `safe-regex@2.1.1` 은 순수 JS 패키지(네이티브 바인딩 없음)이며 `regexp-tree` 를 내부 의존성으로 갖는다. `package.json` `dependencies` 에 추가됐으므로 프로덕션 번들에 포함된다. 외부 네트워크 호출 없고 전역 상태를 수정하지 않으며 파일시스템도 건드리지 않는다. 부작용 없음.
  - 제안: 이상 없음.

- **[INFO]** `compileRegexCache` 동작 변경 — 기존 invalid/too-long 스킵에 **unsafe 스킵** 추가
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts:249`
  - 상세: 기존 동작과 비교하면 "길이 초과·문법 오류 → 캐시 미등록(no-match)" 에 더해 "ReDoS-unsafe → 동일하게 캐시 미등록"이 추가된다. 이전까지는 `(a+)+$` 같은 패턴도 컴파일·캐싱됐다면 이제 캐싱되지 않고 no-match 로 처리된다. 이는 의도된 동작 변경(보안 강화)이며 기존 안전한 패턴(`^foo\d+$` 등)에는 영향 없다. 잠재적으로 현재 배포 중인 워크플로우에 ReDoS-unsafe 패턴이 설정된 경우 해당 조건이 항상 false 가 되는 **기능 변경**이다. 이는 의도된 것이며 계획 파일에도 명시돼 있다.
  - 제안: 이상 없음 (의도된 동작 변경).

---

### 파일 12·15: transform.handler.ts / filter.handler.ts — `safeCompileRegex` / `getRegex` 위임

- **[INFO]** `transform.handler.ts` — 로컬 `MAX_REGEX_LENGTH` 상수 제거, `safeCompileRegex` 를 `compileUserRegex` 위임으로 대체
  - 위치: `codebase/backend/src/nodes/data/transform/transform.handler.ts:32–36`
  - 상세: `MAX_REGEX_LENGTH` 가 로컬에서 제거됐으나 chokepoint(`compileUserRegex`)에서 여전히 동일 값(200)을 기준으로 검사한다. `safeCompileRegex` 의 반환 타입(`RegExp | null`)은 변경되지 않아 호출자 side-effect 없음. 파일시스템·전역 상태·네트워크 변경 없음.
  - 제안: 이상 없음.

- **[INFO]** `filter.handler.ts` — `MAX_REGEX_LENGTH` import 제거, `compileUserRegex` 직접 사용
  - 위치: `codebase/backend/src/nodes/logic/filter/filter.handler.ts:93–118`
  - 상세: `getRegex` 내부 구현이 `compileUserRegex` 위임으로 통일됐다. 기존 `regexCache.set(pattern, null)` 로 실패를 표시하던 방식과 동일하게 유지돼 재컴파일 방지 캐싱 로직에 변화 없다. `invalidRegexPatterns` 에 ReDoS-unsafe 패턴이 추가 보고되는 점만 새로운데, 이는 의도된 가시화 확장이다. 공유/전역 상태 변경 없음.
  - 제안: 이상 없음.

---

### 파일 13: condition-eval.util.ts (logic/_shared) — `compileUserRegex` re-export 추가

- **[INFO]** `compileUserRegex` 를 코어에서 re-export
  - 위치: `codebase/backend/src/nodes/logic/_shared/condition-eval.util.ts:26`
  - 상세: 기존 `compileRegexCache` re-export 와 동일한 패턴으로 추가됐다. 외부 부작용 없음.
  - 제안: 이상 없음.

---

### 파일 17: safe-html.ts — DOMPurify 설정 변경 (블랙리스트 → 화이트리스트)

- **[WARNING]** `DOMPurify.sanitize` 옵션을 `USE_PROFILES.html` + `FORBID_*` 에서 `ALLOWED_TAGS` + `ALLOWED_ATTR` + `ALLOWED_URI_REGEXP` 로 교체 — 기존 클라이언트 렌더 결과 변경
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts:87`
  - 상세: 이 변경은 클라이언트 렌더 출력의 부작용을 의도적으로 변경한다. 기존에는 DOMPurify 기본 안전 태그셋(`USE_PROFILES.html`)이 적용돼 `abbr`, `address`, `article`, `aside`, `details`, `summary`, `time`, `figure`, `figcaption`, `header`, `footer`, `main`, `nav`, `section` 등 HTML5 시맨틱 태그가 허용됐으나, 이제 `ALLOWED_TAGS` 에 없으면 제거된다. 만약 봇 또는 사용자 메시지가 위 태그를 포함하고 있다면 화면 출력이 달라진다.
  - 제안: 이 부작용은 의도된 보안 강화이다. 다만 `ALLOWED_TAGS` 목록이 `marked`(GFM) 산출 태그 기준이므로 **직접 HTML 입력 포맷(`format="html"`)으로 들어오는 시맨틱 태그(예: `<details>`, `<summary>`, `<abbr>` 등)는 이전에 렌더됐으나 이제 제거**될 수 있다. 실제 채팅 메시지에 이런 태그가 사용되는지 확인할 것을 권장한다.

- **[INFO]** 모듈 수준 `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP` 상수 신설
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts:3–17`
  - 상세: 모듈 스코프 `const` 로 선언돼 모듈 로드 시 1회 초기화된다. 전역 변수가 아니며(모듈 private), 외부에서 수정되지 않는다. `ALLOWED_URI_REGEXP` 는 정규식 리터럴로 `RegExp` 객체를 생성하는데 안전한 패턴이다(`^(?:...)` 앵커, 반복 없음). 부작용 없음.
  - 제안: 이상 없음.

- **[INFO]** `ALLOWED_URI_REGEXP` 의 `tel:` / `sms:` / `ftp:` scheme 제거
  - 위치: `codebase/channel-web-chat/src/lib/safe-html.ts:17`
  - 상세: DOMPurify 기본 URI regexp 는 `tel:`, `sms:`, `ftp:` scheme 도 허용한다. 이번 변경으로 이들이 제거돼 `tel:` href 가 있는 링크는 href 속성이 제거된다. 채팅 메시지에 전화번호 링크(`<a href="tel:+82-10-...">`)가 사용 중이라면 기능 변경이 된다.
  - 제안: 비즈니스 요건상 `tel:` scheme 이 필요하다면 `ALLOWED_URI_REGEXP` 에 추가할 것.

---

### 파일 1·2: package-lock.json / package.json — 의존성 추가

- **[INFO]** `safe-regex@^2.1.1` (`dependencies`)·`@types/safe-regex@^1.1.6` (`devDependencies`) 추가
  - 위치: `codebase/backend/package.json:195`, `203`
  - 상세: 런타임 의존성 변경으로 인한 lock 파일 갱신. 함께 `uglify-js` 에 `"dev": true` 플래그가 추가됐고, `@nestjs-modules/mailer` 중첩 하위에 `chokidar`/`glob-parent`/`readdirp` (optional peer) 가 추가됐다. 이는 `safe-regex` 설치 후 npm 이 peer 의존성을 재계산하는 과정에서 발생한 lock 파일 변동으로 보이며, 모두 `optional: true`, `peer: true` 플래그를 달고 있어 프로덕션 번들에 강제 포함되지 않는다. 전역 상태·파일시스템·네트워크 부작용 없음.
  - 제안: 이상 없음.

---

## 요약

이번 변경은 보안 강화를 목적으로 한 refactor 04 세트로, 전반적으로 부작용 관리가 잘 돼 있다. 신규 함수(`isSwaggerEnabled`, `compileUserRegex`)는 모두 순수 함수로 전역 상태를 변경하지 않으며, 내부 인터페이스 변경(`authorize` 시그니처)은 동 diff 내에서 모든 호출자가 일괄 업데이트돼 불일치가 없다. 주목할 부작용은 두 가지다. 첫째, `compileRegexCache` / `getRegex` / `safeCompileRegex` 에서 이전에 컴파일되던 ReDoS-unsafe 패턴이 이제 no-match 로 처리되는데, 이는 의도된 동작 변경이다. 둘째, `safe-html.ts` 의 DOMPurify 옵션이 화이트리스트로 전환되면서 기존에 렌더됐던 HTML5 시맨틱 태그나 `tel:` scheme 링크가 제거될 수 있다. 이 두 부작용 모두 의도된 것이나, 실제 배포 환경에서 이전에 허용됐던 콘텐츠 패턴이 있는지 확인이 권장된다. `WorkflowsService` forwardRef DI 의 순환 해소 여부는 실 부팅/e2e 로 검증이 필요하며 계획 파일에 TODO 로 기록돼 있다.

## 위험도

LOW
