# 부작용(Side Effect) Review — `12_40_58` (누적 델타, origin/main..HEAD 8 commits)

## 조사 방법

`git diff origin/main --stat` 로 실제 변경 파일 전수(50개, 코드 14 + plan 1 + 이전 리뷰
라운드 산출물 35)를 확인하고, 프로덕션/테스트 코드 12개 파일의 실제 diff 를 `git diff`
로 직접 열람했다(프롬프트가 크기 제한으로 일부 diff 를 생략한 파일 포함). 이번 델타는
이전 3개 리뷰 라운드(`11_06_12`/`12_05_39`/`12_24_14`)가 이미 여러 번 검증한 내용을
포함하므로, 그 라운드들이 남긴 실측(emit md5 비교 등)을 신뢰 근거로 삼되 마지막 커밋
(`b0b57366f`, 이번 라운드 직전 fix)은 별도로 직접 대조했다.

## 점검 관점별 판정

1. **의도치 않은 상태 변경 / 전역 변수**
   - 코드 diff 전체(14개 소스 파일)를 확인한 결과 모듈 스코프 `let`/전역 mutable 상태를
     새로 도입하거나 기존 전역 상태의 쓰기 지점을 바꾼 곳이 없다. 전부 타입 주석·제네릭
     인자·`as` 단언·로컬 interface 선언이다.
   - `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` —
     `handlerConsumesWorkspaceId(cls as object, handler)` → `handlerConsumesWorkspaceId(cls, handler)`.
     함수 상단 `countWorkspaceIdConsumingRoutes` 에서 `cls` 는 이미 `typeof cls !== 'function'`
     가드를 통과해 `Function` 으로 좁혀진 뒤이므로 `object` 파라미터에 캐스트 없이도
     할당 가능하다 — 전달되는 값(`cls`) 자체는 바뀌지 않았다. 이 함수는 부트 시
     `@WorkspaceId()` 소비 라우트 수를 세어 0 이면 throw 하는 fail-closed 보안 캐너리인데,
     넘기는 인자 값이 동일하므로 카운트 로직에 영향 없음을 직접 확인했다.

2. **파일시스템 부작용**
   - 프로덕션 코드 어디에도 새 파일 I/O 호출이 추가되지 않았다. 이번 세션 이력에서
     `revert(backend): 리뷰어가 워크트리에 남긴 8파일을 내가 git add -A 로 커밋했다 —
     되돌린다`(`ba93680ab`) 커밋이 있었는데, 이는 **이전 리뷰 라운드가 워크트리에 남긴
     부산물을 실수로 커밋했다가 되돌린 것**이고 현재 HEAD 에는 반영되어 있지 않다 —
     현재 diff 에 파일시스템 부작용 없음.

3. **시그니처 변경 / 호출자 영향**
   - `triggers.service.ts:1077` `let result;` → `let result: SetupResult;`, `execution-engine.service.ts:2911`
     `m.query(...)` → `m.query<{ id: string }[]>(...)`, `executions.service.ts` 의
     `.keys().next().value as string | undefined` — 전부 **로컬 변수/호출식**에 타입을
     붙인 것으로 export 되는 함수/메서드 시그니처는 하나도 바뀌지 않았다. 외부 호출자에게
     보이는 공개 시그니처 변경 없음.
   - `idempotency.interceptor.ts` 의 `context.switchToHttp().getResponse()` →
     `getResponse<HttpResponseLike>()` 도 제네릭 타입 인자 추가일 뿐, `getResponse<T = any>()`
     시그니처 자체(Nest 프레임워크 정의)는 바뀌지 않는다.

4. **인터페이스 변경**
   - 신규 로컬 `interface HttpResponseLike { status?: ...; statusCode?: unknown }` 은
     파일 내부(`idempotency.interceptor.ts`)에서만 쓰이고 export 되지 않는다(직접 확인 —
     `export` 키워드 없음). 공개 API 표면 변경 없음.
   - `chat-channel-config.dto.ts` 의 `@Transform` 콜백은 함수 형태·반환값이 동일하고
     구조분해 파라미터에 `{ value: unknown }` 타입만 부여했다 — DTO 의 직렬화/검증 동작(class-transformer
     런타임)에 영향 없음.

5. **환경 변수**
   - 해당 없음. 이번 델타에 `process.env` 읽기/쓰기 추가가 없다.

6. **네트워크 호출**
   - 해당 없음. 새 외부 서비스 호출 없음 (`dependency.md`/`security.md` 교차 확인 결과와
     일치).

7. **이벤트/콜백**
   - `chat-channel.dispatcher.ts` — `logFn` 삼항식에 `as (message: string) => void` 단언을
     추가했다. 실제 호출부(`:202` 부근)를 직접 열람해 `logFn(` 단일 문자열 인자 `)` 형태로만
     호출됨을 확인 — 새 단언 타입과 실제 호출 형태가 정확히 일치하므로 콜백 실행에 영향
     없음. `this.logger.debug.bind(this.logger)` / `this.logger.warn.bind(this.logger)` 를
     삼항으로 고르는 로직 자체(분기 조건 `isSubFilterNull`)도 diff 밖 — 어떤 로그 레벨이
     호출될지의 판단 기준은 변경되지 않았다.
   - `migrate-node-output-refs.ts` 의 7개 `String.replace` 콜백은 파라미터 타입 주석만
     추가됐고 콜백 본문(정규식 매치 처리·`hits.push` 호출 시점과 인자)은 1바이트도
     바뀌지 않았다 — 콜백이 호출되는 시점·횟수·인자는 이전 라운드가 emit md5 비교로
     실증했고 이번 라운드에서 재확인해도 diff 자체가 순수 파라미터 타입 표기라 결론이
     달라질 근거가 없다.

## 테스트 파일의 부작용(격리) 점검 — 이번 라운드 신규 관점

`idempotency.interceptor.spec.ts` 에 추가된 신규 `describe('IdempotencyInterceptor
(캐시 히트 · 응답 형태 방어)')` 블록(9개 테스트, `git diff` 로 전문 대조)을 부작용
관점에서 별도로 점검했다:

- 각 테스트가 `makeRedis()`·`new IdempotencyInterceptor(...)`·`res`/`responseOverride`
  객체를 **매 테스트마다 새로 생성**한다 — 모듈 스코프 mutable 공유 상태나 `beforeEach`
  누락으로 인한 테스트 간 상태 누출 소지가 없다.
- `redis.get.mockResolvedValue(...)` 등 mock 설정도 각 `it` 블록 로컬 변수에만
  적용되며 이전 테스트의 mock 잔여가 다음 테스트로 전이되는 구조가 아니다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 직전 라운드가 이미 자기
  진술("캐시 히트 경로 **전체**를 메웠다")을 스스로 반박·정정한 이력이 남아 있다
  (`12_24_14` testing WARNING → 손상 캐시 JSON `catch` 분기 테스트 추가로 해소). 문서와
  실제 diff(`git diff`)를 대조한 결과 그 정정 내용과 현재 코드가 일치한다 — 잔존
  불일치 없음.

## `package.json` lint 게이트 변경 — 의도된 동작 변경(부작용 아님)

`"lint": "eslint ... --max-warnings 0"` 은 `npm run lint`/`pnpm --filter backend lint`
의 exit code 를 "warning 있어도 0" 에서 "warning 1건도 1" 로 바꾸는 **실질적 동작
변경**이다. 이것은 side-effect 관점에서 "의도치 않은" 것인지 확인이 필요한 항목이었으나:

- 커밋 메시지·plan 문서(§후속 마지막 항목)가 이 변경을 목적으로 명시하고, 로컬/CI
  게이트가 `backend-checks.yml:95` 를 통해 같은 스크립트를 공유하므로 drift 가 없다.
- 이전 라운드(`12_05_39`)가 이 변경으로 인한 README 문서 불일치(WARNING)를 이미 찾아
  고쳤고, 이번 델타에 그 수정(`README.md:19`)이 포함되어 있다 — 문서와 동작이 다시
  일치한다.

의도된, 그리고 문서화된 CI/로컬 동작 변경이라 "예상치 못한" 부작용으로 분류하지 않는다.

## 발견사항

없음. CRITICAL/WARNING 대상 없음.

## 요약

이번 델타(누적 8개 커밋)의 프로덕션 코드 변경은 라이브러리 경계(`EntityManager.query()`,
`Array.isArray` 좁힘, `TransformFnParams`, `.bind`, `Map.Iterator.next().value`,
`ExecutionContext.getResponse()`, 불필요한 `as object`)에서 새던 암묵적 `any` 를 타입
주석·제네릭 인자·구조적 interface·단언으로 막은 컴파일타임 전용 변경이며, 직접 대조한
결과 전역 상태·파일시스템·네트워크·환경 변수·공개 시그니처·공개 인터페이스 어느 표면도
바뀌지 않았다. 유일한 실질 콜백/이벤트 표면 변경(`chat-channel.dispatcher.ts` 의
`logFn` 단언)은 실제 호출부와 타입이 정확히 일치함을 직접 확인했다. 신규 추가된
`idempotency.interceptor.spec.ts` 테스트 9건은 각 테스트가 독립된 mock/인스턴스를
쓰므로 테스트 간 상태 누출 등 부작용 소지가 없다. `package.json` 의
`--max-warnings 0` 은 CI/로컬 게이트를 실질적으로 바꾸는 변경이지만 의도되고 문서화된
것이며 관련 README 불일치는 이전 라운드에서 이미 해소됐다. `plan/in-progress/backend-lint-gate-broken-on-main.md`
자신이 밝힌 "7파일 중 2파일은 emit md5 가 완전 동일하지 않고 괄호 한 쌍만 다르다"는
사실도 직접 diff 로 대조한 결과 의미상 동등한(ternary 를 감싸는 괄호 유무) 차이일 뿐
런타임 부작용으로 볼 근거가 없다.

## 위험도

NONE
