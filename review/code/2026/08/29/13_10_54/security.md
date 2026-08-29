# 보안(Security) 코드 리뷰

## 변경 개요

이번 diff 는 실질적으로 다음으로 구성된다.

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — `captureThrown` 헬퍼 추출 + `ExpressionError` 계열(`Syntax`/`Reference`/`Type`/`Function`) 4종이 `cause` 로 부착될 때 enumerable own key 가 비민감 화이트리스트(`code`/`name`/`position`)를 벗어나지 않음을 잠그는 **C2 캐너리** `it.each` 추가. 프로덕션 코드 변경 없음.
2. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `preserve-caught-error` eslint-disable 사유를 보강하는 **주석 5줄 추가뿐**. 로직·catch 블록 동작은 이전과 동일.
3. `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — `captureRejected` 헬퍼 추출 + `isolated-vm` 컴파일 예외의 `cause` 가 enumerable own 속성을 하나도 갖지 않음을 잠그는 C2 캐너리 추가. 프로덕션 코드 변경 없음.
4. `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (신규) — `ExpressionError` 하위 클래스 **전수**(6종: Syntax/Reference/Type/Function/Timeout/DepthExceeded)를 export 목록에서 열거해, 각각의 enumerable own key·클래스↔`ErrorCode` 매핑을 잠그는 회귀 테스트. 프로덕션 코드 변경 없음.
5. `plan/in-progress/deps-peer-gating-and-eslint10.md`, `review/code/2026/08/29/{11_58_35,12_23_45,12_50_04}/**` — 이전 세 리뷰 라운드의 산출물(SUMMARY/RESOLUTION/agent reports/meta)과 plan 추적 갱신. 코드 아님.

즉 프로덕션 런타임 동작을 바꾸는 변경은 **없다**. 전부 기존 에러-래핑 정책(spec `5-system/3-error-handling.md` §6.3.1, C1 AND C2: "래핑된 message 가 원본을 담고, `cause` 는 message·name 밖의 민감 정보를 속성으로 갖지 않는다")을 **런타임 단언으로 강제**하는 회귀 테스트 추가와 그 판단 근거를 명확히 하는 주석 보강이다. 방향성 자체가 정보 노출(정보 유출) 방지를 강화하는 쪽이라 보안 관점에서는 순증(net positive) 변경이다.

## 독립 검증

- `codebase/packages/expression-engine/src/errors.ts` 를 직접 열어 확인 — `ExpressionError` 및 6개 하위 클래스 모두 인스턴스 속성은 `code`(readonly)·`position`(readonly, optional)뿐이고 생성자에서 `this.name = '...'` 을 설정한다. 즉 enumerable own key 는 정확히 `['code', 'name', 'position']` 이며, 원본 crypto/HTTP/DB 상세를 담을 필드가 없다 — 신규 캐너리의 화이트리스트 주장과 일치함을 소스에서 확인했다.
- `secret-resolver.service.ts::resolve()` 의 catch 블록을 직접 열어 확인 — `logger.error` 에는 `ref`/`workspaceId`/`err.message` 만 남기고(plaintext 미기록, SS-SE-05), 호출자에게는 `cause` 없이 `new Error('Secret decryption failed')` 만 던진다. 이번 diff 는 그 주변 **주석만** 추가했고 catch 블록의 실제 코드(로깅 필드, throw 문, eslint-disable 대상 줄)는 변경 전과 동일하다.

## 발견사항

이번 diff 범위 안에서 신규로 도입된 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지 민감정보 노출 결함은 발견되지 않았다. `review/**` 로 새로 추가된 이전 라운드 산출물(markdown/json)에도 하드코딩된 API 키·비밀번호·토큰·인증서 패턴은 없었다(전수 grep 확인).

- **[INFO]** C2 캐너리가 고정하는 축은 "enumerable own key" 로 명시적으로 한정되어 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (C2 캐너리 `it.each` 블록, 게이트 199~229번 줄), `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (C2 캐너리 `it()` 블록, 게이트 252~260번 줄), `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (전수 캐너리, 게이트 79~92번 줄)
  - 상세: 테스트와 인접 주석이 "이 축이 non-enumerable(`message`/`stack`)을 의도적으로 잡지 않는다"는 근거(`JSON.stringify`/object spread 가 enumerable 만 직렬화)를 명시하고 있어 이는 결함이 아니라 스코프를 정확히 문서화한 설계다. 다만 향후 어떤 하위 클래스나 `code.handler.ts` 경로가 `cause` 에 **non-enumerable** 속성(예: `Object.defineProperty(..., {enumerable:false})`)으로 민감 정보를 얹으면 이 캐너리 3곳 모두 그것을 잡지 못하는 사각지대가 남는다. `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 가 이미 이 갭을 별도 후속 항목("`cause` 비노출 불변식의 계측 지점")으로 추적 중임을 확인했다.
  - 제안: 별도 조치 불요 — plan 추적을 유지. 계측 지점을 추가할 때는 `Object.getOwnPropertyNames` 축도 함께 검사하는 편이 이 사각지대를 닫는다.
- **[INFO]** `SecretResolverService.resolve()` 의 `preserve-caught-error` eslint-disable 사유가 이번 diff 에서 주석으로만 보강됨.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (`resolve()` 의 `catch` 블록 내부, diff 게이트 95~99번 줄)
  - 상세: 로직 변경 없음. 원본 crypto 에러 상세("Unsupported state or unable to authenticate data" 등)를 `cause` 로 감싸지 않고 `logger.error`(ref + workspaceId 만)로만 남기는 기존 설계를 유지한다 — Activity API 를 통한 사용자 노출 방지 근거가 정확하다. 새 문단은 "서버 로그에만 남는 것도 아니다"라는 보조 근거가 판정축(C1)과 혼동되지 않도록 명확히 하는 것으로, 방향은 개선 쪽이다.
  - 제안: 조치 불요.

## 뮤테이션 검증 관련 코멘트

- 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 확인, INFO/WARNING 검증은 소스 직접 열람 + `errors.ts` static 분석만으로 충분했다). 되돌릴 대상 없음.
- 이전 세 라운드(RESOLUTION.md `11_58_35`/`12_23_45`/`12_50_04`)가 각각 독립적으로 수행한 뮤테이션(민감 속성 주입 → RED, 클래스↔코드 맞바꿈 → RED, 신규 하위 클래스 추가 → 전수성 단언 RED)이 보안 관점에서 요구하는 정확한 실험 축(정보 노출 여부)과 일치함을 확인했다 — 별도로 재실행하지 않았다.

## 요약

이번 변경분은 프로덕션 로직을 전혀 건드리지 않고, 이미 확립된 에러-래핑 보안 정책(§6.3.1 C1 AND C2)을 실제로 강제하는 회귀 테스트(캐너리)를 추가하고 관련 주석의 판정 근거를 명확히 한 것이다. 캐너리 화이트리스트는 `packages/expression-engine/src/errors.ts` 소스 대조로 정확함을 확인했고, `secret-resolver.service.ts` 의 crypto 에러 비노출 설계도 코드 레벨에서 그대로 유지되고 있다. 새로운 인젝션·시크릿 하드코딩·인증 우회·평문 노출 벡터는 발견되지 않았으며, 캐너리가 명시적으로 스코프 밖으로 둔 "non-enumerable cause 속성" 사각지대는 이미 plan 에 후속 항목으로 추적되고 있어 이번 PR 범위에서 추가 조치가 필요하지 않다. 3라운드에 걸친 이전 리뷰들도 동일하게 NONE 위험도로 수렴했고, 이번 최종 diff 에서도 그 판정을 뒤집을 근거는 발견되지 않았다.

## 위험도

NONE
