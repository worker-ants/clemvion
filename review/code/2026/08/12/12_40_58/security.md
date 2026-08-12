# 보안(Security) Review — `origin/main...HEAD` (backend lint `no-unsafe-*` 처분 + `--max-warnings 0` 게이트 + 리뷰 산출물 커밋)

## 조사 방법

`git diff origin/main...HEAD --stat` 로 실제 코드 diff 범위(14개 소스 파일, 약 +140/-29줄)와
리뷰 산출물(`review/code/2026/08/12/{11_06_12,12_05_39,12_24_14}/**`, 36개 파일) 범위를 분리해
확인했다. 코드 diff 대상 파일 전부를 직접 `Read`/`git diff`로 열어, 프롬프트가 요약한 "타입
주석만 추가" 라는 주장을 개별 재검증했다:

- `idempotency.interceptor.ts` 전체 + `idempotency.interceptor.spec.ts` 신규 diff(220줄) 전문
- `execution-engine.service.ts` admission-control 트랜잭션 블록(파라미터화 SQL 확인)
- `triggers.service.ts` 의 `SetupResult`/`sanitizeChatChannelForResponse`/secret rotate 경로
- `workspace-reflection-canary.ts` (RBAC/cross-tenant 가드의 boot-time 캐너리)
- 테스트·스크립트 파일(`migrate-node-output-refs.ts` 등)에서 하드코딩 시크릿 여부 grep

이 델타는 이전 세 라운드(`11_06_12`→`12_05_39`→`12_24_14`)에서 이미 security 리뷰어가 반복
분석했고(모두 LOW/NONE, WARNING 0), 그 결론을 그대로 승계하지 않고 소스를 직접 재대조했다.

## 발견사항

- **[INFO]** Idempotency 캐시 제외 조건이 Spec EIA §R8 보다 넓다 (선재 결함, 이 델타가 만든 것 아님)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:131` (`if (statusCode >= 400) return;`)
  - 상세: Spec EIA §R8 은 "4xx 중 `400 VALIDATION_ERROR` 만 캐시 제외, 그 외(2xx/409/410)는 캐시" 를 명시하는데, 구현은 `statusCode >= 400` 전체를 캐시에서 제외해 409·410 응답도 캐시되지 않는다. 그 범위에서 동일 `Idempotency-Key`+body 재요청 시 캐시 재생 대신 downstream 이 매번 재실행돼 `EIA-RL-02`(24h 동일 응답 재현)를 위반한다. 이 델타(코드 diff)는 이 자리에 `HttpResponseLike` 제네릭 타입만 추가했을 뿐 `>= 400` 비교 자체는 2026-05-21 원본(`35ff9c19b`)부터 불변이며, `idempotency.interceptor.spec.ts` 에 이 동작을 명시적으로 캐너리(`409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리`)로 고정해 두었다(`idempotency.interceptor.spec.ts:198` 부근). `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 spec 인용과 함께 백로그로도 등재됨을 확인했다.
  - 제안: 이번 PR 범위(타입 전용, 런타임 미접촉)에서 고칠 사안은 아니다. 후속 세션에서 spec 확인 후 캐시 제외 조건을 `VALIDATION_ERROR` 케이스로 좁히는 작업이 필요 — 단 `=== 400` 으로 단순 치환하면 400 의 다른 에러코드를 캐시하게 되고 5xx 도 캐시되어 오히려 R8 을 더 어길 수 있으므로 주의(리뷰 산출물 `12_24_14/RESOLUTION.md` 도 동일 경고).

- **[INFO]** admission-control 이 SQL 결과 shape 을 런타임 검증 없이 신뢰 (선재 패턴, 이 델타가 새로 만든 위험 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2911`(`m.query<{ id: string }[]>(...)`), `:2922`(`return rows.length === 1;`)
  - 상세: `EntityManager.query()` 의 반환은 컴파일 타임 단언(제네릭)일 뿐 TypeORM 이 런타임 shape 을 검증하지 않는다. 이 델타 이전에도 암묵적 `any` 로 곧바로 `.length` 를 읽고 있었으므로 신뢰 경계 자체는 변경 전과 동일하다. `UPDATE ... RETURNING id` 쿼리는 파라미터 바인딩(`$1`~`$5`)을 사용하는 것을 직접 확인했고 문자열 결합으로 조립되는 부분이 없어 SQL 인젝션 소지는 없다. 실패 방향도 비대칭적으로 안전하다 — shape 이 어긋나 `rows`가 배열이 아니면 `.length` 접근에서 예외가 나 트랜잭션이 롤백되거나(TypeError), 우연히 `undefined`가 되어도 `undefined === 1`은 `false`라 admission **거부**(fail-closed)로 귀결되며 동시성 상한 우회(fail-open)로 이어지지 않는다.
  - 제안: 필수 아님. 방어 심층화를 원하면 `Array.isArray(rows)` 런타임 가드 추가를 고려(3라운드 연속 INFO 로 유예되고 plan 에 등재된 항목).

- **[INFO]** `SetupResult`/secret rotate 경로 — 외부 응답을 그대로 신뢰하는 패턴 아님 (직접 대조 확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1077`(`let result: SetupResult;`), `:1091-1095`(`result.issuedInboundSigning` 을 `this.secrets.rotate(...)` 인자로 사용)
  - 상세: `let result;`(암묵적 `any`) → `let result: SetupResult;` 로 바뀐 것은 `ChatChannelAdapter.setupChannel(): Promise<SetupResult>` 인터페이스가 이미 컴파일 타임에 보장하던 반환 타입을 로컬 변수에 명시한 것뿐이라 새 신뢰 경계를 만들지 않는다. `result.issuedInboundSigning`(secret rotate 인자)은 외부 채널 응답 필드가 아니라 Telegram 어댑터가 `randomBytes(24)`로 자체 생성한 값이라(다른 라운드 side_effect/security 리뷰가 어댑터 소스로 확인) "검증 없이 외부 입력을 신뢰"하는 사례로 보기 어렵다. `sanitizeChatChannelForResponse`(`triggers.service.ts:523-550`)의 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 기반 secret strip 로직도 이 델타에서 건드리지 않았다(`Object.getPrototypeOf(trigger) as object` 캐스팅만 추가).
  - 판정: 문제 없음(확인 목적으로만 기재).

- **[INFO]** RBAC 캐너리(`workspace-reflection-canary.ts`) 로직 불변 확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:89`
  - 상세: `if (typeof cls !== 'function') continue;` 로 이미 `Function` 으로 좁혀진 `cls` 를 `as object` 없이 그대로 `handlerConsumesWorkspaceId(controllerClass: object, …)` 에 넘기도록 캐스팅만 제거했다. `Function extends object` 라 타입 레벨에서도 안전하고, cross-tenant 격리 판별의 실제 로직(`handlerConsumesWorkspaceId` 위임 호출, 0건 시 boot fail-closed)은 1바이트도 바뀌지 않았다.
  - 판정: 문제 없음.

- **[INFO]** 하드코딩 시크릿 없음 / 신규 인젝션 표면 없음
  - 상세: 코드 diff 14개 파일 전체(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`, `execution-engine.service.ts`, `triggers.service.ts`, `chat-channel.dispatcher.ts`, `chat-channel-config.dto.ts`, `workspace-reflection-canary.ts`, `executions.service.ts`, `ai-agent.schema.ts`, `render-tool-provider.ts`, `migrate-node-output-refs.ts`/`.spec.ts`, `README.md`, `package.json`)를 대상으로 API 키/비밀번호/토큰 패턴을 grep 했으나 신규 하드코딩 시크릿 없음. `migrate-node-output-refs.ts:542` 의 `process.env.DB_PASSWORD ?? 'workflow_dev'` (로컬 fallback 비밀번호)는 이 델타가 건드리지 않은 기존 코드(diff hunk 밖)라 이 리뷰의 범위 밖이다. `String.replace` 콜백 6곳(`migrate-node-output-refs.ts`)은 콜백 파라미터에 타입만 붙었고 정규식·치환 로직은 변경 없음 — 새로운 문자열 조립·경로 처리·명령 실행 표면이 생기지 않았다.

## 요약

이 델타의 실질 코드 변경은 `no-unsafe-*` ESLint warning을 없애기 위해 라이브러리 경계(`EntityManager.query`, `Array.isArray`가 좁힌 `any[]`, `.bind` 오버로드, `TransformFnParams.value`, `Map.Iterator.next().value`, `ExecutionContext.getResponse()`)에 타입 주석·제네릭 인자·지역 인터페이스(`HttpResponseLike`)·`as` 단언만 추가한 것으로, 세 차례 선행 리뷰가 emit 바이트 비교로 실증한 대로 런타임 로직은 변하지 않는다. 직접 재검증한 결과 SQL은 전부 파라미터 바인딩이라 인젝션 소지가 없고, 하드코딩 시크릿·평문 노출 신규 사례도 없으며, RBAC 캐너리·secret rotate 경로의 로직도 불변이다. 유일하게 안전 관점에서 의미 있는 두 항목 — idempotency 캐시 제외 범위가 Spec EIA §R8 보다 넓은 것(409/410 미캐시)과 admission-control 쿼리 결과의 런타임 shape 미검증 — 은 둘 다 이 델타 이전부터 있던 선재 상태이고, 실패 방향이 위험을 키우는 쪽(fail-open)이 아니라 안전한 쪽(재실행/거부)이며, 이미 캐너리 테스트와 plan 백로그로 명시 추적되고 있어 이 델타를 막을 사유가 아니다. 신규 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 위험도

LOW
