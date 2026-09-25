# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `assertCanRotate` 삭제 후 남은 JSDoc 이 고아가 되어 무관한 메서드 위에 붙었고, 락 전/락 안 이중 판정
  근거가 새 `assertCanModify` 문서로 옮겨지지 않았다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1185-1189` (`mergeAndValidateCredentials`
    바로 위). 원래 `private assertCanRotate(...)` 를 설명하던 블록이었고, 그 메서드는 이번 PR 에서 `assertCanModify` +
    `throwAdminRequired` 로 대체되며 삭제됐다(diff `@@ -1097,19 +1186,6 @@`). 그런데 블록 자체(3줄, "조직 스코프 통합은
    admin 만 회전할 수 있다. 락 전(요청 시작 시점 스냅샷)·락 안(재읽은 행) 두 지점에서 같은 조건·에러코드로 호출된다 —
    보안 직결 코드라 한 곳에서만 고치면 drift 가 난다.")은 삭제되지 않고 그대로 남아, 실제로는 `mergeAndValidateCredentials`
    를 설명하는 다음 JSDoc(1189행 `/**`) 바로 앞에 위치하게 됐다. 두 개의 `/** ... */` 블록이 연달아 있고 앞 블록이 가리키는
    대상이 없다.
  - 상세: 이 orphan 블록이 담고 있던 "락 전/락 안 두 지점에서 같은 조건·에러코드로 호출된다 — drift 방지" 라는 설계
    근거는 실제로 여전히 유효하다 — `rotate()` 가 요청 시작 시점(`assertCanModify(entity, userRole, 'rotate')`)과
    pessimistic lock 재읽기 이후(`assertCanModify(fresh, userRole, 'rotate')`) 두 번 같은 검사를 호출하는 패턴은 이번
    PR 에서도 그대로 유지된다(같은 파일 `rotate()` 본문). 하지만 이 PR 이 새로 쓴 `assertCanModify` 의 JSDoc
    (`private assertCanModify(...)` 바로 위)에는 이 "이중 호출·drift 방지" 근거가 옮겨지지 않았고, 대신 무관한
    `mergeAndValidateCredentials` 앞에 방치되어 다음 사람이 읽으면 혼란스럽다.
  - 제안: 고아 블록(1185-1188행)을 삭제하고, 그 내용("두 지점에서 같은 조건·에러코드로 호출 — drift 방지")을
    `assertCanModify` 의 JSDoc 에 한 문장으로 합친다.

- **[INFO]** `buildFakeCafe24Integration` 의 새 JSDoc 이 `scope`/`createdBy` 두 필드의 공통 동작을 설명하지만 위치상
  `scope` 필드에만 붙어 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` — 함수
    `buildFakeCafe24Integration` 의 `overrides` 타입 정의부(diff `@@ -82,6 +82,9 @@`, 추가된
    `/** 생략하면 행에 싣지 않는다(= personal 이 아니므로 누구에게나 보인다 — 기존 케이스의 기본값). */` 바로 다음 줄이
    `scope: string;`, 그다음 줄이 `createdBy: string;`).
  - 상세: TSDoc 관례상 프로퍼티 앞 주석은 그 프로퍼티 하나를 문서화한다. 이 주석은 "생략하면"(둘 다 생략 시의 동작)을
    설명하므로 `scope`·`createdBy` 두 필드 모두에 해당하는데, 배치상 `scope` 만 문서화된 것처럼 보인다. 기능상 문제는
    아니지만(코드는 실제로 두 필드 모두 조건부 spread 로 생략 처리한다), IDE 에서 `createdBy` 에 hover 했을 때 이 설명이
    뜨지 않는다.
  - 제안: 주석을 두 필드를 감싸는 위치(예: `}> = {},` 앞이 아니라 두 필드 묶음 전체를 설명하는 블록 주석)로 옮기거나,
    필드마다 한 줄씩 나눠 적는다.

- **[INFO]** `CandidateLookupService` 클래스 상단 문서가 새로 추가된 "요청자에게 보이는 통합만" 필터를 언급하지 않는다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` — 클래스 선언 바로 위
    JSDoc(`/** Spec ED-AI-39 (§4.3.1) ... */`, 전체 파일 컨텍스트 14-31행). `integration-selector`·`mcp-server-selector`
    행이 "connected Integration ... 만 필터" 라고만 적혀 있다.
  - 상세: 이번 PR 이 `lookupIntegrations`/`lookupMcpServers` 각각에 "요청자에게 보이는 통합만 — 남의 personal 은
    후보에서 빠진다(spec 통합 §8)" 한 줄 JSDoc 을 잘 붙였다(110행, 166-168행 인접). 다만 파일 맨 위에서 "spec §4.3.1
    표를 그대로 구현한다" 며 5개 위젯의 스코프를 요약하는 클래스 docstring 은 그대로라, 이 요약만 읽는 사람은 새로
    추가된 가시성(§8) 교차 관심사를 놓칠 수 있다.
  - 제안: 클래스 docstring 에 "integration-selector · mcp-server-selector 는 추가로 요청자에게 보이는 것만(남의
    personal 제외, spec 통합 §8)" 한 문장을 보탠다.

- **[INFO]** cafe24/makeshop precheck 스펙의 fake-integration 빌더 두 개가 `scope`/`createdBy` 기본값 처리 방식이
  달라졌는데, 그 차이를 설명하는 주석은 한쪽에만 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 의
    `buildFakeCafe24Integration`(이번 PR 이 `scope`/`createdBy` 를 **미지정 시 키 자체를 생략**하도록 조건부 spread 로
    추가, 새 주석 포함) vs `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts` 의
    `buildFakeMakeshopIntegration`(이미 `createdBy: overrides.createdBy ?? 'u-1'`, `scope: overrides.scope ?? 'personal'`
    로 **항상 기본값을 채워 넣는** 기존 패턴, 주석 없음).
  - 상세: 두 빌더는 거의 동일한 역할(precheck 대상 fake row 생성)을 하는 자매 파일인데, 하나는 "생략 = 필드 자체
    없음"(비-personal 취급), 다른 하나는 "생략 = `scope:'personal', createdBy:'u-1'`"(항상 personal 취급) 로 반대
    방향의 기본값을 가진다. cafe24 쪽에만 이 동작을 설명하는 JSDoc 이 새로 붙어서, 두 파일을 오가며 작업하는 사람이
    makeshop 쪽 기본값(왜 항상 `personal`/`u-1` 인지)을 오해하기 쉽다.
  - 제안: `buildFakeMakeshopIntegration` 에도 왜 `scope`/`createdBy` 가 항상 기본값을 갖는지(혹은 두 빌더의 스타일을
    통일할지) 한 줄 주석을 남긴다.

## 요약

이 PR 은 문서화 관점에서 전반적으로 높은 수준이다 — 새로 만든 `integration-visibility.ts`·`pickPrecheckConflict`·
`requireVisible`·`assertCanModify`·`requireModifiable` 등 공개/내부 함수 전부에 spec 조항(§8)을 인용하는 JSDoc 이
붙어 있고, Swagger `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 문구는 실제 라우트 가드·서비스 판정과 정확히
일치하도록 갱신됐으며(update/rotate/remove 의 `editor + Organization Admin`, reauthorize/requestScopes 의
`member + Organization Admin`, updateScope 의 `member + Admin` 등을 직접 코드와 대조해 확인), CHANGELOG 최상단
항목과 spec(`spec/2-navigation/4-integration.md` §8·Rationale)·프런트엔드 사용자 가이드(en/ko MDX) 세 곳이 서로
모순 없이 같은 규칙(남의 personal=404, Organization 변경=Admin 이상)을 기술한다. 유일한 실질적 결함은 리팩터
과정에서 삭제된 `assertCanRotate` 의 JSDoc 블록이 고아로 남아 무관한 메서드 앞에 붙었고, 그 안에 있던 "락 전/락
안 이중 호출 — drift 방지" 라는 유효한 설계 근거가 새 `assertCanModify` 문서로 옮겨지지 않은 것이다(WARNING 1건).
나머지는 스타일·완결성 수준의 INFO 3건이다.

## 위험도

LOW
