# 보안(Security) Review — backend lint warning 전량 처분 델타

## 조사 방법

프롬프트의 unified diff(파일 1~14, 실제 코드/설정/plan 변경분)를 전수 확인하고, 보안 민감 지점은
`Read`/`Grep` 으로 현재 워크트리 소스를 직접 열어 대조했다:

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — cross-tenant 가드
  캐너리(`#1103` 결함 클래스)의 `handlerConsumesWorkspaceId(cls, handler)` 호출부와
  `handlerConsumesWorkspaceId(controllerClass: object, ...)` 시그니처를 직접 대조.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 전체 파일을
  읽어 `HttpResponseLike` 타입과 `typeof` 런타임 가드가 그대로 살아 있는지, idempotency 키 검증
  로직(SHA-256 bodyHash, 409 충돌, 4xx 캐시 제외)이 이 diff 로 흔들리지 않았는지 확인.
- `codebase/backend/src/scripts/migrate-node-output-refs.ts` — 정규식 콜백에 타입만 붙었는지,
  패턴 자체가 중첩 정량자 없는 선형 형태인지(ReDoS 배제) 확인.
- `review/code/2026/08/12/{11_06_12,12_05_39}/security.md` (같은 델타의 직전 두 라운드 security
  리뷰 산출물) — 결론을 그대로 승계하지 않고 핵심 주장(admission-control shape 미검증,
  `SetupResult` 신뢰 경계, `as object` 제거 안전성)을 위 직접 대조로 재확인.

이번 델타(파일 1~14)는 `no-unsafe-*`/`no-unnecessary-type-assertion` ESLint warning 처분을
위해 타입 주석·제네릭 인자·타입 단언만 추가한 것이고, 두 차례의 side_effect 리뷰가 실제
TypeScript 컴파일러로 emit 바이트를 before/after 비교해 로직 무변경을 이미 실증했다(12개 대상
파일 중 10개 emit 완전 동일, 2개는 삼항식을 감싸는 괄호 한 쌍만 차이 — 의미 동일). 이번 검토는
그 전제를 코드 읽기로 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** admission-control 쿼리 결과가 여전히 런타임 shape 검증 없이 신뢰된다 (신규 위험
  아님, 이미 plan/이전 라운드에 유예 기록됨)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2911` (게이트
    번호 기준, `m.query<{ id: string }[]>(...)`)
  - 상세: `EntityManager.query()`가 실제로 이 shape을 반환한다는 것은 컴파일 타임 단언일 뿐 런타임
    검증(`Array.isArray` 등)이 없다. 다만 이 diff는 기존에도 암묵 `any`로 곧바로 `.length`를
    읽던 자리에 제네릭 타입 인자와 설명 주석 2줄만 추가했을 뿐이라 **이번 변경이 만든 위험이
    아니다**. 실패 방향도 fail-closed다 — shape이 어긋나면 `rows.length`가 `undefined`가 되어
    `undefined === 1`은 `false`이므로 동시 실행 상한(admission)이 **거부**되지, 우회되지 않는다.
  - 제안: 필수 수정 아님. 하드닝 원한다면 `Array.isArray(rows)` 가드를 추가해 shape 불일치 시
    명시적 throw(트랜잭션 롤백)로 만드는 것을 고려할 수 있으나, 이는 이 델타가 아니라 후속
    세션의 범위다(plan 문서에 이미 기록됨).

- **[INFO]** `idempotency.interceptor.ts`의 `HttpResponseLike` 도입 — 방어 가드가 정적으로
  죽지 않도록 설계됨 (긍정적 확인)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37`
    (신규 `interface HttpResponseLike`), `:106`, `:129-130` (사용부)
  - 상세: `status`/`statusCode`를 optional로만 선언해 뒤이은
    `typeof res.status === 'function'`(:106)과 `typeof res.statusCode === 'number'`(:130) 가드가
    실제로 분기하는 코드로 남는다. express `Response`를 직접 타입으로 박았다면 이 두 `typeof`가
    정적으로 항상 참이 되어 방어가 죽은 코드가 됐을 것이다. `getResponse<T>()`의 제네릭 인자는
    컴파일 타임에만 영향을 주므로 idempotency key 검증(SHA-256 bodyHash 비교, 같은 key+다른
    body→409, 4xx 캐시 제외 — Spec EIA §R8) 로직 자체는 이 diff에서 1바이트도 바뀌지 않았다.
  - 판정: 문제 없음(발견 아님, 확인 목적).

- **[INFO]** `workspace-reflection-canary.ts`의 `as object` 제거가 cross-tenant 가드 캐너리의
  판별 로직에 영향 없음 — 시그니처 직접 대조로 확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:89` (함수
    `countWorkspaceIdConsumingRoutes` 내부 `handlerConsumesWorkspaceId(cls, handler)` 호출부)
  - 상세: `cls`는 바로 위(`:79`) `if (typeof cls !== 'function') continue;`로 이미 `Function`으로
    좁혀져 있다. `handlerConsumesWorkspaceId`의 첫 파라미터는
    `controllerClass: object`(`workspace.decorator.ts:66`)이고 `Function`은 구조적으로 `object`의
    서브타입이므로 `as object` 단언 제거가 타입 안전성·런타임 인자 값 어느 쪽도 바꾸지 않는다.
    이 파일은 `RolesGuard` cross-tenant 멤버십 검증 대상(`@WorkspaceId()` 소비 라우트) 판별을
    지키는 fail-closed 캐너리(`#1103` 결함 클래스)라 조금이라도 판별 로직이 바뀌면 CRITICAL
    후보였으나, 실제로는 순수 `no-unnecessary-type-assertion` 정리다.
  - 판정: 문제 없음(발견 아님, 확인 목적).

- **[INFO]** `migrate-node-output-refs.ts`의 정규식 콜백 — ReDoS/인젝션 표면 없음
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts` (`replace` 콜백 6곳, Pass
    1~6, 게이트 246~495 부근)
  - 상세: 모든 정규식이 `\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\....` 형태의 중첩 정량자 없는
    선형 패턴이고, 이번 diff는 콜백 파라미터에 타입(`match: string`, `dbl/sgl: string |
    undefined`, `field: string`)만 붙였을 뿐 정규식·치환 로직은 변경하지 않았다. 이 스크립트는
    사용자 입력이 아니라 저장소 내부 마이그레이션 대상 문자열(노드 표현식)만 처리하는 1회성 CLI
    스크립트라 외부 공격 표면이 아니다.

- **[INFO]** 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회 패턴 — 미검출
  - 위치: 전체 diff (파일 1~14)
  - 상세: 시크릿 리터럴 패턴 grep 결과 0건. SQL은 기존 파라미터 바인딩(`$1`)을 그대로 유지하며
    문자열 결합 추가 없음. `triggers.service.ts`의 `let result: SetupResult`는 어댑터가 외부 응답
    필드를 명시 매핑해 구성하는 리터럴 객체 타입일 뿐 새 신뢰 경계를 만들지 않는다(secret rotate
    에 쓰이는 `issuedInboundSigning`은 외부 입력이 아니라 Telegram 어댑터가 `randomBytes`로 자체
    생성). `RolesGuard`/`@Roles()`/멤버십 검증 코드는 이 diff에서 전혀 수정되지 않았다.

- **[INFO]** `package.json`의 `--max-warnings 0` 도입 + README 갱신 — 보안 관점에서 중립
  - 위치: `codebase/backend/package.json:20`, `codebase/backend/README.md:19`
  - 상세: lint 게이트를 warning 도 실패시키도록 강화하는 빌드 정책 변경으로, 인젝션/인증/암호화
    등 보안 표면과 무관하다. 오히려 향후 `no-unsafe-*` 류 경고(검증 안 된 값 흐름 신호)가
    조용히 누적되는 것을 막는 방향이라 장기적으로는 긍정적.

## 요약

이 델타는 TypeScript 컴파일러 경계(`Array.isArray`의 `any[]` 좁힘, `EntityManager.query`의
`Promise<any>`, `.bind` 오버로드, `Map.Iterator.next().value`, `TransformFnParams.value`,
`getResponse<T=any>()`, `Object.getPrototypeOf` 반환 타입)에서 새던 암묵적 `any`를 명시 타입·
제네릭·구조적 인터페이스로 막는 순수 타입 강화 작업이며, 두 차례의 이전 리뷰 라운드가 emit
바이트 비교로 이미 실증한 "런타임 미접촉" 전제를 코드 직접 대조로 재확인했다. 새로운 인젝션·
하드코딩 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출 패턴은 발견되지 않았다.
cross-tenant 격리에 직결되는 `workspace-reflection-canary.ts`의 단언 제거와 idempotency 재생
로직이 걸린 `HttpResponseLike` 도입 모두 시그니처·가드를 직접 대조해 런타임 행위 불변을
확인했다. 유일하게 실질적 판단이 필요했던 자리(`execution-engine.service.ts`의 admission-control
`m.query` 결과 shape 미검증)는 이 델타가 만든 위험이 아니고, 실패 방향이 fail-closed이며, 이미
plan 문서에 하드닝 제안이 유예 기록으로 남아 있어 이번에도 INFO로만 남긴다. 전반적으로 이 델타가
도입한 새로운 보안 위험은 없다.

## 위험도

NONE

STATUS: OK
