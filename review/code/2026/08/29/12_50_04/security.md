# 보안(Security) 코드 리뷰

## 변경 개요

본 diff 는 5개의 실 코드/문서 파일 변경과, 이전 리뷰 라운드(`11_58_35`, `12_23_45`)의 산출물(RESOLUTION/SUMMARY/각 리뷰어 리포트/meta.json 등, 22개 파일)이 신규 커밋으로 함께 포함된 구성이다.

실 코드/문서 변경 5건:

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — `captureThrown` 헬퍼 추출 + `ExpressionError` 4개 하위클래스(Syntax/Reference/Type/Function)를 `it.each` 로 순회하며 `cause` 의 enumerable own key 가 비민감 화이트리스트(`code`/`name`/`position`)를 벗어나지 않음을 잠그는 **C2 캐너리** 확장. 프로덕션 코드 변경 없음.
2. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `preserve-caught-error` eslint-disable 사유를 보강하는 **주석 5줄 추가뿐**. `decryptSecret` 실패 시 원본 crypto 에러(`cause`)를 부착하지 않고 일반화된 `'Secret decryption failed'` 만 던지는 기존 로직(C1 미충족 → cause 비부착)은 변경되지 않았다. 원본 상세는 `logger.error` 로 ref+workspaceId 만 남긴다(SS-SE-05).
3. `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — `captureRejected` 헬퍼 추출 + `isolated-vm` 컴파일 예외의 `cause` 가 enumerable own 속성을 하나도 갖지 않음(`[]`)을 잠그는 **C2 캐너리**. 프로덕션 코드 변경 없음.
4. `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (신규) — `errors.ts` 가 export 하는 `ExpressionError` 하위 클래스 **전부**(6종)를 열거해 각각 `Object.keys()` 가 화이트리스트를 벗어나지 않는지 잠그는 전수성 캐너리. 새 하위 클래스가 추가되면 전수성 단언이 먼저 RED 를 낸다.
5. `plan/in-progress/deps-peer-gating-and-eslint10.md` — 위 작업 완료·뮤테이션 검증 결과를 기록하는 plan 문서 갱신(코드 아님).

즉 프로덕션 로직을 바꾸는 변경은 없고, 전부 기존 에러-래핑 보안 정책(spec `5-system/3-error-handling.md` §6.3.1, C1 AND C2: "래핑된 message 가 원본을 담고, `cause` 는 message·name 밖의 민감 정보를 속성으로 갖지 않는다")을 **주석에서 런타임 단언으로 승격**하는 회귀 테스트 강화다. 방향성 자체가 정보 노출(정보 누설, OWASP A09 Security Logging/A05 Security Misconfiguration 인접) 방지를 강화하는 쪽이라 순증(net positive) 변경이다.

## 발견사항

이번 diff 범위 안에서 신규로 도입된 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지 민감정보 노출 결함은 발견되지 않았다. 하드코딩 시크릿 패턴(API 키·비밀번호·토큰·`BEGIN PRIVATE KEY` 등)을 diff 전체에서 grep 했으나 매치 없음(파일명·주석상의 "secret-resolver" 문자열만 검출).

- **[INFO]** C2 캐너리가 고정하는 축은 "enumerable own key" 로 명시적으로 한정되어 있다
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (전수 클래스 캐너리), `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`(C2 `it.each` 블록), `codebase/backend/src/nodes/data/code/code.handler.spec.ts`(C2 `it()` 블록)
  - 상세: 테스트와 인접 주석이 "이 축이 non-enumerable(`message`/`stack`)을 의도적으로 잡지 않는다"는 근거(`JSON.stringify`/object spread 가 enumerable 만 직렬화)를 명시하고 있어 결함이 아니라 스코프를 정확히 문서화한 설계다. 이후 어떤 코드가 `cause` 에 새 **non-enumerable** 민감 속성을 얹으면 이 캐너리는 잡지 못한다는 사각지대가 남는다 — `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 가 이를 별도 후속 항목("`cause` 비노출 불변식의 계측 지점", `GlobalExceptionFilter` 대상)으로 이미 추적 중이며 이번 diff 가 새로 만든 갭이 아니다.
  - 제안: 조치 불요 — 이미 plan 추적 중.

- **[INFO]** `secret-resolver.service.ts` 의 신규 주석이 §6.3.1 판정축을 더 명확히 한다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (`resolve()` catch 블록, diff 게이트 95~99번 줄)
  - 상세: 로직 변경 없음. "서버 로그에만 남는 것도 아니다"(`#814` SSRF 메시지 일반화 근거)라는 서술이 C1 판정의 보조 근거일 뿐 판정축이 아님을 명시해, §6.3.1 이 명시적으로 기각한 "소비처가 직렬화하는가" 기준과 혼동될 소지를 없앴다. crypto 에러 상세(`Unsupported state or unable to authenticate data` 등)를 사용자 노출 경로(Activity API)로 흘리지 않고 서버 로그(ref+workspaceId 만, plaintext 미기록)에만 남기는 기존 방어는 그대로 유지된다.
  - 제안: 조치 불요.

- **[INFO]** 신규 test fixture(`{{ unknownFn() }}`, `this is ( not valid js` 등)는 샌드박스 내부 유효성 테스트일 뿐 인젝션 벡터가 아니다
  - 위치: `expression-resolver.service.spec.ts` C2 `it.each` fixture, `code.handler.spec.ts` C2 `it()` fixture
  - 상세: 두 값 모두 각 엔진의 자체 evaluator(`resolveConfig`)/`isolated-vm` 샌드박스에 정적으로 하드코딩된 테스트 입력이며, 사용자 입력 경로나 외부 신뢰 경계를 새로 여는 코드가 아니다. 확인 결과 이번 diff 로 새로 추가된 실행 경로·권한 상승·이스케이프 벡터는 없다.
  - 제안: 조치 불요.

## 요약

이번 변경분은 프로덕션 로직을 건드리지 않고, 이미 확립된 에러-래핑 보안 정책(§6.3.1 C1 AND C2)을 실제로 강제하는 회귀 테스트(캐너리)를 소비처 4개 클래스 경로 + 패키지 레벨 전수 클래스 열거로 확장하고, `secret-resolver.service.ts` 의 비부착(C1 미충족) 판정 근거 주석을 명확히 한 것이다. 하드코딩된 시크릿, 신규 인젝션 벡터, 인증/인가 우회, 안전하지 않은 암호화, 평문 전송, 에러 메시지의 신규 민감정보 노출은 발견되지 않았다. 캐너리가 명시적으로 스코프 밖에 둔 "non-enumerable cause 속성" 사각지대는 이번 PR 이 만든 것이 아니라 이미 plan 에 후속 계측 항목으로 추적 중이다. 전체적으로 정보 노출 방지 회귀 가드를 순증시키는 보안 관점 긍정적 변경이다.

## 위험도

NONE
