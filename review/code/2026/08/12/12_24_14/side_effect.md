# 부작용(Side Effect) 리뷰 결과

델타 = backend lint warning 처분 시리즈(46→21→0, `--max-warnings 0` 게이트 도입) + 관련
소스 14파일 타입 강화 + `idempotency.interceptor.spec.ts` 회귀 테스트 5건 추가(직전 라운드
`12_05_39` WARNING #1 fix) + README 문구 정정(직전 라운드 WARNING #2 fix) + plan 문서 갱신 +
이전 두 리뷰 세션(`11_06_12`, `12_05_39`) 산출물 커밋.

## 검증 방법

이전 두 라운드(`11_06_12`, `12_05_39`)가 이미 프로젝트 실제 `tsconfig` 옵션을 이식한
`ts.transpileModule` emit 비교(md5)로 14개 소스 파일 전체를 검증해 두었다(결과: 12개 파일
emit 바이트 동일, 2개 파일(`chat-channel.dispatcher.ts`, `chat-channel-config.dto.ts`)은
여분 괄호 한 쌍만 차이 — 연산자 우선순위상 의미 동일). 이번 라운드는 그 결과를 그대로
승계하지 않고 다음을 직접 재확인했다:

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — `handlerConsumesWorkspaceId(cls, handler)` 로 바뀐 `cls` 가 실제로 위 `if (typeof cls !== 'function') continue;` 로 `Function` 으로 좁혀진 뒤라 `object` 파라미터에 `as` 없이도 대입 가능함을 소스 직접 열람으로 확인(:79, :89). 이 함수는 RolesGuard 의 워크스페이스 격리 판별을 지탱하는 보안 캐너리라 별도로 짚었다 — 로직 변경 없음.
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `logFn` 호출부(:202)가 문자열 인자 1개만 넘기는 것을 확인, 새 타입 단언 `(message: string) => void` 와 실제 호출 형태가 정확히 일치. 단언은 컴파일 타임에만 존재하므로 emit 에 영향 없음.
- `codebase/backend/package.json` 의 `lint` 스크립트를 참조하는 호출부를 저장소 전체에서 grep — `.github/workflows/backend-checks.yml:95`, `.claude/test-stages.sh:49` 두 곳뿐. 둘 다 이 게이트 강화의 의도된 대상이고, `--max-warnings` 를 다른 값으로 거는 병행 스크립트는 없음.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 의 신규 `responseOverride` 옵션·5개 테스트를 직접 열람 — `makeRedis()`/`makeContext()` 모두 테스트별로 새 객체를 만들어 반환하는 팩토리이고 module-level 공유 상태·실 Redis 연결이 없음을 확인. 테스트 간 상태 누수 소지 없음.
- `codebase/backend/README.md`(:19) 현재 텍스트를 직접 읽어 diff 와 일치함을 확인.

## 발견사항

- **[INFO]** `package.json` 의 `lint` 스크립트가 "정보성"에서 "게이팅"으로 인터페이스가 바뀐다
  - 위치: `codebase/backend/package.json:20`
  - 상세: `--max-warnings 0` 추가로 `pnpm --filter backend lint` 의 exit code 계약이 "warning 이 있어도 0" 에서 "warning 1건이라도 있으면 1" 로 바뀐다. 이 PR 의 명시적 목적(게이트 복구/강화)이므로 결함은 아니지만, 사이드이펙트 관점에서는 이 게이트가 코드뿐 아니라 **로컬 설치 상태**(예: stale `node_modules` 가 유발하는 유령 `prettier/prettier` warning — plan 문서가 이미 실측·기록)에도 반응한다는 점이 노출 빈도를 높인다. CI 는 매 실행 clean install 이라 영향 없음.
  - 제안: 조치 불요 — 이미 문서화됨(`plan/in-progress/backend-lint-gate-broken-on-main.md`).

- **[INFO]** `idempotency.interceptor.ts` 의 `getResponse<HttpResponseLike>()` 제네릭 인자는 반환 객체·기존 `typeof` 런타임 가드를 그대로 두고 타입만 좁힌다 — 부작용 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34`(인터페이스 선언), `:105`, `:128`(호출부)
  - 상세: `getResponse<T = any>()` 의 제네릭 인자는 소거되므로 런타임 반환값은 이전과 동일. 소비부의 `typeof res.status === 'function'` / `typeof res.statusCode === 'number'` 가드도 그대로 유지된다.
  - 판정: 문제 없음(확인 목적으로만 기재).

- **[INFO]** `workspace-reflection-canary.ts` 의 `as object` 제거는 보안 캐너리 로직을 건드리지 않는다
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:89`
  - 상세: 위 검증 방법 참조. `typeof cls !== 'function'` 가드로 이미 `Function` 타입인 `cls` 를 그대로 `handlerConsumesWorkspaceId(controllerClass: object, …)` 에 넘기는 것은 `Function extends object` 라 타입 레벨에서도 안전하고, 실행 경로·조건문 어느 것도 바뀌지 않았다.
  - 판정: 문제 없음.

CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 요약

이번 델타는 (1) `package.json` `lint` 스크립트의 exit code 계약을 "정보성"에서 "게이팅"으로 바꾸는 의도된 인터페이스 변경(호출부 2곳 모두 이 변경의 의도된 대상), (2) 14개 backend 소스 파일에서 라이브러리 경계(`EntityManager.query`, `Array.isArray` 의 `any[]` 좁힘, `.bind` 오버로드, `TransformFnParams.value`, `Map.Iterator.next().value`, `ExecutionContext.getResponse()`)에 새던 암묵적 `any` 를 타입 주석·제네릭 인자·타입 단언·설명 주석으로만 막은 수정, (3) 직전 라운드 WARNING 두 건에 대한 fix(`idempotency.interceptor.spec.ts` 응답 형태 방어 테스트 5건 추가, README 문구 명확화), (4) plan 문서·이전 리뷰 세션 산출물 커밋으로 구성된다. 함수 시그니처·공개 API·전역 상태·환경 변수 읽기/쓰기·파일시스템 부작용·네트워크 호출·이벤트/콜백 발생 어느 것도 실질적으로 바뀌지 않았다. 신규 테스트(`idempotency.interceptor.spec.ts`)는 테스트별로 fresh mock 을 생성해 상태 누수가 없고 실 Redis 연결도 없다. 유일하게 짚을 만한 항목은 `package.json` `lint` 게이트의 exit code 계약 변경인데, 이는 이 델타의 명시적 목적이자 이미 두 차례 리뷰에서 검토·수용된 사안이라 INFO 로만 기재한다.

## 위험도

NONE
