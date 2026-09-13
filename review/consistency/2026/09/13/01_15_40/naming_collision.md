# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-prep, plan: `guide-error-code-truth`)

## 조사 방법 메모

`--impl-prep` 번들은 `spec/5-system/` 15개 파일 중 3개(`3-error-handling.md`·`1-auth.md`·
`2-api-convention.md`)만 전문이 실렸고 나머지 15개(`4-execution-engine.md` 등)는 컨텍스트
예산 초과로 절단됐다. 절단된 파일 중 `plan/in-progress/guide-error-code-truth.md` §A(테스트
연결 실패 응답)가 직접 언급하는 `spec/5-system/7-llm-client.md` 는 관련성이 높아 별도로 `Read`
로 직접 열어 확인했다(§8.3 probe 표·§8.4 에러 매핑). 그 외 절단 파일은 이번 리뷰 범위 밖이며,
"여기 없다"를 "충돌 없다"의 근거로 쓰지 않았다.

또한 plan 자체가 `spec/5-system/*.md` 본문을 직접 수정한다고 명시하지 않는다 — 실제 변경
대상은 (a) 백엔드 `LlmService.testConnection`/`ModelTestConnectionResultDto`, (b)
`codebase/frontend/src/content/docs/**/*.mdx` 가이드 4쌍, (c) 신규 harness 가드 + 그 가드가
근거로 삼을 spec/fixture 다. 아래 발견사항은 이 plan 이 "새로 도입"하는 식별자·명명 결정을
대상으로 하며, 대부분은 **식별자 추가가 아니라 가이드를 실재 식별자에 맞추는 정렬(rename
아님, 오기 삭제)**이라 충돌 표면이 작다.

## 발견사항

- **[WARNING]** 신규 "가이드 에러코드 실재성 가드"가 기존 `<ImplAnchor>` 프레임워크와
  같은 문제 영역을 겹쳐 다루는데 plan 에 상호 참조가 없다
  - target 신규 식별자: plan §D 가 도입 예정인 "가이드가 적는 에러 코드 문맥 토큰 vs 실재
    코드" 검증 가드(이름 미확정)
  - 기존 사용처: `spec/conventions/user-guide-evidence.md` — `<ImplAnchor kind="ui-entry" |
    "component" | "api-endpoint" | "e2e-scenario">` + `impl-anchor-existence.test.ts` /
    `integrations-coverage.test.ts` / `triggers-coverage.test.ts` (`codebase/frontend/src/lib/docs/__tests__/`).
    이 컨벤션은 정확히 "가이드 본문이 약속한 코드 존재를 build-time 으로 강제" 라는, plan §D 와
    동일한 문제(가이드→코드 진실성)를 이미 SoT 로 갖고 있고, §2.1 에 다른 가드들과의 관계를
    표로 명시해 "두 가드가 보완 관계인지 대체 관계인지"를 매번 밝히는 관례를 세워 두었다.
  - 상세: plan §D 는 "판정 축을 에러 코드 문맥 토큰으로 좁히면 허용목록이 필요 없다"며
    독자적인 구조 스캔(FieldTable JSX·`{ error: { code } }` 코드펜스·산문 backtick)을
    설계하는데, `<ImplAnchor>` 의 4개 `kind` 값 어디에도 "에러 코드 카탈로그 대조"가 없다.
    설계 자체(수동 annotation 불필요·자동 구조 스캔)가 `<ImplAnchor>`(수동 annotation 필수)와
    달라 **완전한 대체는 아니지만**, 두 메커니즘이 "가이드가 거짓을 말하지 않는가"라는 같은
    개념을 서로 모르는 채 각자 이름 붙이면, 다음 사람이 "가이드 진실성을 누가 강제하는가"를
    두 곳에서 따로 재발견해야 한다 — `user-guide-evidence.md §2.1` 이미 이 위험을 경계해
    `registry.test.ts`/`impl-anchor-existence.test.ts`/`nodes-coverage.test.ts`/
    `spec-code-paths.test.ts` 네 가드의 관계를 명시한 선례가 있다.
  - 제안: 새 가드를 만들 때 (1) `user-guide-evidence.md §2.1` 표에 새 행을 추가해 관계를
    명시하거나, (2) `<ImplAnchor>` 의 `kind` enum 에 `error-code` 를 추가해 기존 프레임워크를
    확장하는 대안을 검토 기록으로 남긴다(채택하지 않더라도 "왜 별도 메커니즘인가"를 Rationale
    에 적는다). 파일명은 기존 `*-coverage.test.ts`(GUI-flow anchor 커버리지라는 확립된 의미)와
    혼동되지 않는 이름(예: `error-code-existence.test.ts`)을 쓴다.

- **[WARNING]** 신규 가드의 spec 문서를 `error-codes.md` 에 얹으면 그 문서 자신의 소유 범위
  선언과 충돌한다
  - target 신규 식별자: plan §D "가드 + spec + fixture" 의 spec 부분(문서화 위치 미정)
  - 기존 사용처: `spec/conventions/error-codes.md` Overview — "본 문서가 **유일하게
    소유**하는 것: ① 의미 기반 명명 원칙, ② rename 안정성 정책, ③ historical-artifact
    예외 레지스트리" 라고 스스로 범위를 좁게 선언한다(카탈로그·envelope·HTTP status·표기는
    모두 다른 문서가 SoT).
  - 상세: "가이드 문서가 실재하지 않는 에러 코드를 적지 못하게 막는 가드"는 위 세 범위(명명
    원칙/rename/historical-artifact) 어디에도 속하지 않는다 — 이것은 "가이드 정확성" 문제이지
    "코드 명명" 문제가 아니다. 만약 개발자가 이 가드의 존재를 문서화 편의상 `error-codes.md`
    본문에 추가하면, 그 문서가 스스로 그은 경계("본 문서가 유일하게 소유하는 것")를 위반하는
    새로운 dangling 서술이 생긴다 — 이 저장소의 다른 spec 들이 정확히 이런 "SoT 선언과 실제
    내용의 불일치"를 여러 차례 정정해 온 이력이 있다(`error-codes.md §4.2` 신설 경위 참고).
  - 제안: 가드 문서화는 `spec/conventions/user-guide-evidence.md`(가이드→코드 진실성 SoT)
    또는 그 자매 신규 파일에 두고, `error-codes.md` 에는 "가이드 정확성은
    `user-guide-evidence.md` 가 SoT" 라는 1줄 포인터만 남긴다.

- **[INFO]** `spec/5-system/7-llm-client.md` §8.3 probe 표가 `testConnection` 실패 shape 를
  전혀 문서화하지 않는다
  - target 신규 식별자: plan §A 가 통일할 필드명 `message`(이미 DTO·FE 에 존재하는 이름이라
    "신규 식별자"는 아니다)
  - 기존 사용처: `spec/5-system/7-llm-client.md` §8.3 표는 `{ success: true }` /
    `{ success: true, dimension? }` 성공 케이스만 적고, `success: false` 시 어떤 필드로
    사유를 전달하는지는 이 spec 어디에도 없다(직접 열람 확인, grep 0건).
  - 상세: 이것은 "이미 다른 의미로 쓰이는 이름과의 충돌"은 아니지만, plan §A 가 서비스
    반환을 `message` 로 통일한 뒤 이 spec 표에 실패 shape 를 추가하지 않으면 SoT 문서가
    여전히 침묵 상태로 남아, 다음 사람이 "실패 시 필드명이 무엇인가"를 다시 코드에서
    역추적해야 하는 이번 사고의 재발 조건을 그대로 둔다.
  - 제안: §A 구현 시 `spec/5-system/7-llm-client.md` §8.3 표에 실패 행(`{ success: false,
    message }`)을 추가해, 가이드(`models.mdx`)뿐 아니라 시스템 spec 도 같은 진실을 반영하게
    한다. (`spec_impact` 에 이 파일 추가 여부 확인 필요 — 현재 plan 체크리스트에는 미등재.)

- **[INFO]** 제거 대상 식별자(`MAKESHOP_API_ERROR`·`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·
  `LLM_ERROR`)는 신규 식별자 도입이 아니라 실재하지 않는 이름의 **삭제**이므로 이번 관점의
  충돌 표면이 아니다
  - `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 는 `3-error-handling.md §1.4` 가
    이미 "노드 수준 envelope 에 더 이상 사용하지 않는다"고 명시적으로 은퇴시킨 이름이다 —
    가이드만 뒤쳐져 있었다. `MAKESHOP_API_ERROR` 는 실재 코드(`MAKESHOP_404`/`_422`/`_4XX`/
    `_5XX`/`_CALL_FAILED`/`_AUTH_FAILED`/`_TRANSPORT_FAILED`/`_RATE_LIMITED`)와 이름이 겹치지
    않으므로 그 실재 코드들과의 충돌도 없다. 두 케이스 모두 "정정 후 남는 이름"이 이미 spec
    전체에서 정합적으로 쓰이고 있음을 `3-error-handling.md §1.4`·`conventions/error-codes.md`
    양쪽에서 확인했다.

## 요약

이 plan 은 대부분 "가이드가 지어낸/은퇴한 이름을 실재 이름으로 교체"하는 작업이라 순수한
신규 식별자 충돌 표면은 작다. `ModelTestConnectionResultDto` 의 `message` 필드 통일·
`latencyMs` 제거는 이미 존재하는 이름으로의 정렬이라 충돌이 없고, 제거 대상 4개 코드명도
기존 실재 코드와 겹치지 않는다. 다만 plan §D 의 신규 harness 가드는 `spec/conventions/
user-guide-evidence.md` 가 이미 소유한 "가이드→코드 진실성" 문제 영역과 겹치는데 plan 에
상호 참조가 없어, 이름·설계가 확정되는 시점에 기존 `<ImplAnchor>` 프레임워크와의 관계를
명시하지 않으면 두 개의 독립적인 "가이드 진실성 검증" 메커니즘이 서로 모른 채 공존하게 될
위험이 있다. 이 가드의 spec 문서화 위치도 `error-codes.md` 가 스스로 선언한 좁은 소유 범위
밖이라 그 문서가 아니라 `user-guide-evidence.md` 계열에 두는 것이 맞다. `spec/5-system/
7-llm-client.md` §8.3 은 testConnection 실패 shape 자체를 문서화하지 않고 있어 §A 구현과
함께 보강이 필요하다(신규 식별자 충돌은 아니나 이번 사고의 재발 방지와 직결).

## 위험도

LOW
