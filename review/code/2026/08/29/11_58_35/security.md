# 보안(Security) 코드 리뷰

## 변경 개요

본 diff 는 4개 파일로 구성된다.

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — `ExpressionError` 계열이 던지는 `cause` 의 enumerable own key 가 비민감 화이트리스트(`code`/`name`/`position`)를 벗어나지 않음을 잠그는 **C2 캐너리 테스트** 추가 (프로덕션 코드 변경 없음).
2. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `preserve-caught-error` disable 사유를 보강하는 **주석 5줄 추가뿐**(로직 변경 없음).
3. `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — `isolated-vm` 컴파일 예외의 `cause` 가 enumerable own 속성을 하나도 갖지 않음을 잠그는 **C2 캐너리 테스트** 추가 (프로덕션 코드 변경 없음).
4. `plan/in-progress/deps-peer-gating-and-eslint10.md` — 위 작업 완료를 기록하는 plan 문서 갱신(코드 아님).

즉 실질적으로 프로덕션 코드의 동작을 바꾸는 변경은 **없고**, 전부 기존 에러-래핑 정책(spec `5-system/3-error-handling.md` §6.3.1, C1 AND C2: "래핑된 message 가 원본을 담고, `cause` 는 message·name 밖의 민감 정보를 속성으로 갖지 않는다")을 **런타임 단언으로 강제**하는 회귀 테스트 추가와 그 판단 근거를 명확히 하는 주석 보강이다. 방향성 자체가 정보 노출 방지를 강화하는 쪽이라 보안 관점에서는 순증(net positive) 변경이다.

## 발견사항

이번 diff 범위(4개 파일) 안에서 신규로 도입된 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지 민감정보 노출 결함은 발견되지 않았다.

- **[INFO]** C2 캐너리가 고정하는 것은 "enumerable own key" 축으로 명시적으로 한정되어 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (C2 캐너리 `it()` 블록, diff 게이트 177~200번 줄) / `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (C2 캐너리 `it()` 블록, diff 게이트 244~261번 줄)
  - 상세: 테스트 자체와 인접 주석이 "이 축이 non-enumerable(`message`/`stack`)을 의도적으로 잡지 않는다"는 근거(JSON.stringify/object spread 가 enumerable 만 직렬화)를 명시하고 있어, 이는 결함이 아니라 스코프를 정확히 문서화한 설계다. 다만 이후 다른 개발자가 `cause` 에 새 non-enumerable 속성을 얹는 코드를 작성할 경우 이 캐너리는 그것을 잡지 못한다는 사각지대가 남는다 — plan 문서(§2 체크리스트, "`cause` 비노출 불변식의 계측 지점" 미완료 항목)가 이미 이 갭을 인지하고 별도 후속 항목으로 추적 중이다.
  - 제안: 별도 조치 불요 — 이미 plan 에 추적 중인 후속 항목(계측 지점, `GlobalExceptionFilter`/공용 직렬화 유틸 대상)으로 남겨 두는 현재 처리가 적절하다.

- **[INFO]** `SecretResolverService.resolve()` 의 `preserve-caught-error` eslint-disable 사유가 이번 diff 에서 주석으로만 보강됨.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (해당 `catch` 블록 내부, diff 게이트 95~99번 줄)
  - 상세: 로직 변경은 없다. 이 자리는 원본 crypto 에러 상세("Unsupported state or unable to authenticate data" 등)를 `cause` 로 감싸지 않고 `logger.error`(ref + workspaceId 만)로만 남기는 기존 설계를 유지한다 — Activity API 를 통한 사용자 노출 방지라는 근거가 정확하다. 새 주석은 "서버 로그에만 남는 것도 아니다"라는 보조 근거가 판정축(C1)과 혼동되지 않도록 명확히 하는 것이라 보안적으로 개선 방향이다.
  - 제안: 조치 불요.

## 요약

이번 변경분은 프로덕션 로직을 건드리지 않고, 이미 확립된 에러-래핑 보안 정책(§6.3.1 C1 AND C2)을 실제로 강제하는 회귀 테스트(캐너리)를 추가하고 관련 주석의 근거를 명확히 한 것이다. 두 캐너리 모두 화이트리스트를 실측(4개 오류 종류를 직접 호출)에 근거해 고정했고, vacuity 방지 단언(reject 하지 않으면 실패)도 포함되어 테스트 자체의 신뢰도도 양호하다. 새로운 인젝션·시크릿 하드코딩·인증 우회·평문 노출 벡터는 발견되지 않았으며, 캐너리가 명시적으로 스코프 밖으로 둔 "non-enumerable cause 속성" 사각지대는 이미 plan 에 후속 항목으로 추적되고 있어 이번 PR 범위에서 추가 조치가 필요하지 않다.

## 위험도

NONE
