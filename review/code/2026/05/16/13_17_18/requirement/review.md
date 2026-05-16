# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: backend/src/migrations.spec.ts

- **[INFO]** 변경 내용은 코드 포매팅(줄 길이 정리) 전용이며 로직 변경 없음
  - 위치: 전체 diff
  - 상세: `findDuplicateVersions` 호출부의 인자를 prettier-style 줄바꿈으로 재포맷. 테스트 커버리지와 로직은 그대로 유지됨.
  - 제안: 이상 없음. 기존 커버리지(빈 입력, zero-padding drift, 3개 이상 중복, 다중 버전 중복, .conf 필터링)가 모두 존재하며 충분함.

- **[WARNING]** `findDuplicateVersions` — `VERSION_FROM_SQL_RE` 가 `.sql` 확장자를 내장하지 않으므로, `.sql` 이 아닌 파일이 regex를 통과할 수 있음
  - 위치: `migrations.spec.ts` L110-117 (`findDuplicateVersions` 함수)
  - 상세: 함수 첫 번째 가드 `if (!name.endsWith('.sql')) continue;` 가 있어 런타임에는 문제없으나, `VERSION_FROM_SQL_RE = /^V0*([0-9]+)__/` 자체는 `.sql` 을 검사하지 않는다. 만약 함수가 나중에 재사용될 경우 의도와 다르게 동작할 수 있음.
  - 제안: 함수 시그니처 JSDoc 에 `.sql` 파일만 대상임을 명시하거나, regex를 `/^V0*([0-9]+)__[a-z0-9_-]+\.sql$/` 로 교체해 guard 역할을 통합.

---

### 파일 2: backend/src/modules/integrations/third-party-oauth.controller.ts

- **[INFO]** 변경 내용은 `@ApiOkResponse` description 문자열의 줄바꿈 포맷 전용이며 로직 변경 없음
  - 위치: L236-237 diff
  - 상세: Prettier 스타일 줄바꿈 적용. 기능 영향 없음.

- **[WARNING]** `cafe24Install` — `req.url.split('?', 2)[1]` 을 사용한 rawQuery 추출이 URL 파편화에 취약
  - 위치: L359 `const rawQuery = req.url.includes('?') ? req.url.split('?', 2)[1] : '';`
  - 상세: `req.url`은 Express에서 path + query 만 포함하지만, 프록시를 통해 경로에 `?` 가 두 번 등장하는 비정상 요청이 들어오면 첫 번째 `?` 이후만 추출된다. 또한 `req.query`(Express가 이미 파싱한 원본 쿼리 문자열)를 쓰지 않고 raw URL을 직접 파싱하는 이유에 대한 주석이 없음.
  - 제안: `req.originalUrl` 또는 `req.query` + `querystring.stringify`를 사용하거나, raw 쿼리가 필요한 이유(예: HMAC 검증을 위한 raw string 보존)를 주석으로 문서화.

- **[WARNING]** `oauthCallback` — `catch` 블록에서 에러 코드가 없고 메시지만 HTML에 노출됨
  - 위치: L499-511
  - 상세: `catch` 블록에서 생성한 에러 payload는 `{ status: 'error', provider, error: message }` 이며, `error.code` 필드가 없다. `oauthCallback` JSDoc에 나열된 에러 코드 어휘(`OAUTH_TOKEN_EXCHANGE_FAILED` 등)가 catch 경로에선 무시되고 raw message만 전달됨. `handleCallbackWithErrorCapture` 가 이미 에러를 포착해 반환한다면 이 catch는 실제로 언제 실행되는지 불분명.
  - 제안: catch 경로도 `e.response?.code` 를 읽어 `error.code` 를 postMessage payload에 포함시키거나, `handleCallbackWithErrorCapture` 의 동작 보장을 주석으로 명시.

- **[INFO]** `isValidPostMessageOrigin` — `parsed.pathname !== '/'` 와 `!== ''` 둘 다 허용
  - 위치: L543
  - 상세: `new URL('https://example.com')` 의 `pathname` 은 `'/'` 이고, `new URL('https://example.com/')` 도 `'/'` 다. 빈 문자열 케이스는 실제로 발생하지 않으나, 방어 코드로 포함된 것은 적절.
  - 제안: 이상 없음.

- **[WARNING]** `cafe24Install` — `catch` 블록에서 Accept 헤더 분기 시 `application/json` 요청도 HTML을 받을 수 있음
  - 위치: L394-406
  - 상세: `acceptsHtml` 판단이 `acceptHeader.includes('text/html')` 에만 의존한다. `Accept: */*` (curl 기본값) 도 `text/html` 을 포함하지 않으므로 JSON envelope으로 응답된다. 그러나 `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*` 처럼 브라우저가 보내는 실제 accept 헤더는 `text/html` 을 포함하므로 브라우저는 HTML을 받는다. 의도된 동작이면 문서화 필요.
  - 제안: 이 분기 로직을 인라인 주석으로 설명하거나, 별도 헬퍼 함수 `acceptsHtmlResponse(req)` 로 추출해 테스트 가능하게 만들기.

---

### 파일 3: backend/src/nodes/integration/send-email/send-email.schema.spec.ts

- **[INFO]** 변경 내용은 expect 문의 Prettier 줄바꿈 포맷 전용이며 로직 변경 없음
  - 위치: L571-574 diff
  - 상세: 기능 영향 없음. 테스트 커버리지(4개 blocking error, 완전 설정 시 빈 배열)는 정상.

- **[INFO]** `validateSendEmailConfig` — 이메일 주소 형식 자체를 검증하지 않음
  - 위치: L776-815 (validateSendEmailConfig describe 블록)
  - 상세: `to` 가 비어있지 않은 문자열/배열인지만 검사하며 실제 이메일 형식(`@` 포함 여부)은 미검증. 이는 의도적 설계(handler/service 계층에서 SMTP 전송 시 검증)일 수 있음. 테스트도 형식 검증을 기대하지 않음.
  - 제안: 형식 검증이 다른 계층에 위임된 경우 주석으로 명시. 그렇지 않으면 기본 이메일 형식 정규식 추가 고려.

---

### 파일 4: backend/src/nodes/logic/if-else/if-else.schema.ts

- **[INFO]** 변경 내용은 escape sequence `\'` → 쌍따옴표 문자열로 변경한 스타일 정정
  - 위치: L161
  - 상세: `message: 'First condition\'s field must be entered.'` → `message: "First condition's field must be entered."`. 의미 동일.

- **[INFO]** `validateIfElseConfig` — `conditions` 가 비어있는 배열일 때 오류를 반환하지 않음
  - 위치: L981-1006
  - 상세: `validateIfElseConfig` 는 조건이 0개인 경우 빈 배열을 반환한다. "조건이 최소 하나 필요"한 비즈니스 규칙은 `warningRules` 의 declarative DSL로만 표현되어 있다. `validateConfig` 와 `warningRules` 의 책임 분리가 명확하게 주석으로 설명되어 있으므로 의도된 설계.
  - 제안: 이상 없음. 분리 원칙이 JSDoc에 명시됨.

---

### 파일 5: backend/src/nodes/logic/parallel/parallel.schema.spec.ts

- **[INFO]** 변경 내용은 expect 문 포맷 정리(줄바꿈 제거)이며 로직 변경 없음
  - 위치: L1056-1059 diff
  - 상세: 기능 영향 없음.

- **[WARNING]** `maxConcurrency` 경계값 테스트에서 상한값(16)과 초과값(17) 동시 테스트가 `handler.validate` 와 `validateParallelConfig` 간 불일치를 드러냄
  - 위치: L1127-1137 (`handler.validate` maxConcurrency 17 invalid) vs L1209-1215 (`validateParallelConfig` maxConcurrency=-1 에 대한 검증만 있고 17 에 대한 `validateParallelConfig` 테스트 없음)
  - 상세: `handler.validate({ branchCount: 4, maxConcurrency: 17 }).valid` 가 false 임을 검사하지만, `validateParallelConfig` 에서는 `maxConcurrency=17` 케이스 테스트가 없다. 두 경로가 동일 비즈니스 규칙을 검증한다면 둘 다 커버되어야 함.
  - 제안: `validateParallelConfig({ branchCount: 4, maxConcurrency: 17 })` 케이스를 imperative validate 테스트에 추가.

- **[INFO]** `maxConcurrency=100` raw echo 테스트 — 의도적 비클램핑 설계가 주석으로 명시됨
  - 위치: L1292-1309
  - 상세: CONVENTIONS Principle 7 인용으로 설계 근거가 명확함. 이상 없음.

---

### 파일 6: backend/src/nodes/logic/switch/switch.schema.spec.ts

- **[INFO]** 변경 내용은 expect 문 포맷 정리(줄바꿈 제거)이며 로직 변경 없음
  - 위치: L1331-1334 diff
  - 상세: 기능 영향 없음.

- **[INFO]** `id optional` 설계 의도가 테스트 주석으로 명확히 문서화됨
  - 위치: L1400-1407
  - 상세: schema 허용 → resolver fallback → handler runtime 검증의 3계층 책임 분리가 주석에 명시. 이상 없음.

- **[INFO]** reserved id 검증 — `'default'`, `'out'`, `'error'` 세 토큰 전체 정합성
  - 위치: L1587-1597
  - 상세: `it.each` 로 세 토큰 모두 커버. 양성 케이스(substring 포함 id 허용)도 검증됨. 이상 없음.

---

### 파일 7: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts

- **[INFO]** 변경 내용은 escape sequence `\'` → 쌍따옴표 문자열 스타일 정정
  - 위치: L1652
  - 상세: 의미 동일. 이상 없음.

- **[INFO]** `validateVariableDeclarationConfig` — type 필드의 enum 위반을 string 타입 체크로만 검사
  - 위치: L1753-1755
  - 상세: `if (!v.type || typeof v.type !== 'string')` 가 타입 자체는 검증하지만 `['string','number','boolean','array','object']` 범위 내인지는 검사하지 않는다. `varDefSchema` 가 enum으로 제한하므로 schema parse 경로에선 안전하지만, `validateVariableDeclarationConfig` 를 schema 없이 직접 호출하는 경우 `type: 'unknownType'` 이 통과됨.
  - 제안: `validateConfig` 내에서 type 값도 enum 허용 목록으로 검증하거나, 해당 함수 JSDoc에 "schema parse 이후 호출 전제" 를 명시.

---

### 파일 8: backend/src/nodes/logic/variable-modification/variable-modification.schema.ts

- **[INFO]** 변경 내용은 escape sequence `\'` → 쌍따옴표 문자열 스타일 정정
  - 위치: L1809
  - 상세: 의미 동일. 이상 없음.

- **[INFO]** `VALID_OPERATIONS` Set 과 `modOperationSchema` enum 이 중복 정의됨
  - 위치: L1931-1938
  - 상세: `validateVariableModificationConfig` 안에 `VALID_OPERATIONS` Set을 하드코딩하고 있으며, 함수 상단 주석에 "Mirror the handler's whitelist exactly" 라고 명시되어 있다. 그러나 `modOperationSchema.options` 를 직접 참조하면 단일 소스로 유지할 수 있음.
  - 제안: `const VALID_OPERATIONS = new Set(modOperationSchema.options)` 로 변경해 중복 유지보수 부담 제거. (`if-else.schema.ts` 의 `conditionOperatorSchema.options` 활용 패턴과 일관성 유지)

---

### 파일 9: backend/src/nodes/presentation/carousel/carousel.schema.spec.ts

- **[INFO]** 변경 내용은 expect 문 포맷 정리(줄바꿈 제거)이며 로직 변경 없음
  - 위치: L2011-2014 diff
  - 상세: 기능 영향 없음.

- **[INFO]** `validateCarouselConfig` — dynamic mode의 `itemButtons` 검증이 `mode` 필드 부재 시에도 실행되는지 불명확
  - 위치: L2265-2276
  - 상세: 테스트는 `mode: 'dynamic'` 명시 후 `itemButtons` 검증을 확인하지만, `mode` 미설정 시(기본값 `dynamic`) 동일 검증이 실행되는지는 테스트 없음.
  - 제안: `mode` 를 생략했을 때 `itemButtons` 검증이 동일하게 적용되는지 테스트 케이스 추가 고려.

---

## 요약

이번 변경의 97% 이상은 Prettier 포맷터 적용에 따른 줄바꿈 및 quote 스타일 정리이며 비즈니스 로직 수정은 없다. 실질적인 기능 완전성 관점에서 발견된 주요 관심 사항은 세 가지다. 첫째, `third-party-oauth.controller.ts` 의 `oauthCallback` catch 블록이 에러 코드(vocab)를 postMessage payload 에 포함하지 않아 JSDoc에 정의된 에러 코드 어휘와 실제 구현 간 괴리가 있다. 둘째, `variable-modification.schema.ts` 의 `VALID_OPERATIONS` Set이 `modOperationSchema` enum을 중복 정의하고 있어 향후 operation 추가 시 양쪽 동기화 오류가 발생할 수 있다. 셋째, `variable-declaration.schema.ts` 의 `validateVariableDeclarationConfig` 가 type 필드의 enum 범위를 직접 검증하지 않아 schema 우회 호출 시 잘못된 타입이 통과된다. 나머지 발견사항은 낮은 우선도의 보완 제안이다.

## 위험도

LOW
