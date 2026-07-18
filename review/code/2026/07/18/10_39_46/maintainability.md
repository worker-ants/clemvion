# 유지보수성(Maintainability) 리뷰 — `ResumableNodeHandler` 제네릭화 + 후속 WARNING fix

## 컨텍스트

본 diff 는 전일(2026-07-17 22:58:45) 코드 리뷰에서 나온 maintainability WARNING #1("bivariance/TS2416
설계 근거가 4~5곳에 반복 서술")을 포함한 WARNING 4건에 대한 fix 결과(커밋 `580a615dd` 등)와, 신규
`assert-end-reason-domain.type-fixture.ts` 회귀 fixture, 그리고 그 리뷰 사이클의 산출물
(`review/code/2026/07/17/22_58_45/**`)이 함께 커밋된 상태다. 아래는 최종 코드 상태 기준 재평가다.

## 발견사항

- **[INFO]** 이전 WARNING("bivariance/TS2416 근거 4~5곳 반복")은 실제로 잘 해소됨 — 긍정 확인
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:28-46`,
    `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 클래스
    docblock, `codebase/backend/src/nodes/core/node-handler.interface.ts` (`AssertEndReasonDomain`)
  - 상세: 두 핸들러 클래스의 docblock 을 직접 읽어 확인한 결과, 장문의 bivariance/TS2416 설명은
    `AssertEndReasonDomain` 한 곳으로 SoT 화됐고 나머지 지점은 `{@link ResumableNodeHandler}` /
    `{@link AssertEndReasonDomain}` 참조 + 1~2문장 요약으로 축약되어 있다. `ai-agent.handler.ts` 의
    기존 미병합 인접 JSDoc 2블록(구 documentation INFO)도 하나로 합쳐졌다. 설계 rationale 의 canonical
    위치를 지정한다는 이 PR 취지에 부합하는 개선이며 별도 조치 불필요.
  - 제안: 없음(확인용 기록).

- **[INFO]** `AssertEndReasonDomain` 조건부 타입의 `Parameters<...>[1]` 중복 표현은 그대로 남아 있음
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `AssertEndReasonDomain` 정의
    ```ts
    export type AssertEndReasonDomain<...> =
      [Parameters<THandler['endMultiTurnConversation']>[1]] extends [TDeclared]
        ? [TDeclared] extends [Parameters<THandler['endMultiTurnConversation']>[1]]
          ? true
          : never
        : never;
    ```
  - 상세: 전일 리뷰에서 INFO(선택적 개선)로 분류된 항목이 이번 fix 라운드의 대상이 아니었으므로 그대로
    남아 있다(WARNING 이 아니었으므로 미수정이 규약 위반은 아님). 동작에는 문제 없고 가독성 저하도
    경미하지만, 상호 대입성(mutual assignability) 체크 패턴은 반복될 수 있는 형태라 `Equal<A, B>` 유틸로
    추출하면 재사용성이 좋아진다.
  - 제안 (선택): `type Actual<H> = Parameters<H['endMultiTurnConversation']>[1];` 로 이름 붙이거나 범용
    `Equal<A, B>` 로 추출. Blocking 아님.

- **[INFO]** 신규 파일 명명 패턴(`*.type-fixture.ts`)이 저장소에 최초 도입되었으나 컨벤션 문서에는 미등재
  - 위치: `codebase/backend/src/nodes/core/assert-end-reason-domain.type-fixture.ts` (신규)
  - 상세: `grep` 확인 결과 backend 전체에서 `.spec.ts` 가 아니면서 `@ts-expect-error` 를 쓰는 파일은
    이 파일이 유일하고, `*.type-fixture.ts` 접미사 자체도 이 파일이 최초 사례다(`spec/conventions/*.md`
    어디에도 이 패턴에 대한 언급 없음). 파일 자체의 docblock 이 "왜 `*.spec.ts` 밖에 둬야 하는지"를
    상세히 설명해 이 한 파일만 보면 이해에 지장은 없다. 다만 plan 문서가 이미 관측한 대로("3번째
    resumable 노드" 시나리오) 이 패턴이 향후 재사용될 가능성이 있는데, 지금은 그 명명 규칙·배치 규칙이
    이 파일의 docblock 에만 존재해 다음에 유사 fixture 를 추가하는 사람이 이 파일을 찾아 읽지 않으면
    독자적으로 다른 이름/위치를 고를 수 있다.
  - 제안 (선택, 후속 과제): 이 패턴이 재사용될 것으로 예상되면 `spec/conventions/` 에 "compile-time
    type fixture 배치 규칙"(소스 트리 배치 이유, `.type-fixture.ts` 접미사, `@ts-expect-error` 역실증
    의무)을 짧게 등재. 1회성이라면 지금 상태로 충분(blocking 아님).

- **[INFO]** `_endReasonDomainLock` 수동 opt-in 성격은 이전 리뷰에서 이미 인지·수용된 채 그대로 유지
  - 위치: `ai-agent.handler.ts` / `information-extractor.handler.ts` 파일 말단 `_endReasonDomainLock`
  - 상세: 신규 fixture(`assert-end-reason-domain.type-fixture.ts`)는 `AssertEndReasonDomain` 유틸리티
    **자체**가 좁히기/넓히기를 올바르게 거부하는지를 회귀 검증하지만, "각 핸들러가 이 lock 을 실제로
    부착했는지"를 강제하는 장치(린트/레지스트리 순회 테스트)는 여전히 없다. plan 문서 "잔여 후속" 절이
    이를 이미 INFO 로 기록해뒀고 구현체가 2개뿐이라 심각도는 낮다 — 새로운 발견이 아니라 상태 유지 확인.
  - 제안: 없음(이미 plan 에 후속 과제로 기록됨).

- **[INFO]** 리뷰 산출물 파일(`review/code/2026/07/17/22_58_45/**`, 13개)은 코드가 아닌 프로세스
  기록이라 함수 길이·중첩·매직넘버 등 표준 유지보수성 기준이 적용되지 않음
  - 위치: `review/code/2026/07/17/22_58_45/{SUMMARY,RESOLUTION,architecture,documentation,maintainability,requirement,scope,...}.md`, `_resolution_state.json`, `_retry_state.json`, `meta.json`
  - 상세: 이 파일들은 CLAUDE.md 규약에 따라 커밋되는 리뷰 산출물이며, 표는 잘 구조화되어 있고
    가독성에 문제가 없다. 코드 리뷰 관점에서 별도 조치 대상 아님.
  - 제안: 없음.

## 신규 fixture 파일 자체 평가 (`assert-end-reason-domain.type-fixture.ts`)

가독성·네이밍이 우수하다: `DeclaredDomain` / `NarrowingViolationHandler` / `WideningViolationHandler` /
`ExactMatchHandler` 는 각자의 역할(선언 도메인, 좁히기 위반, 넓히기 위반, 정상 케이스)을 이름만으로
명확히 드러낸다. 각 네거티브 케이스에 "왜 이 케이스가 위반인지"와 "sanity 케이스가 왜 필요한지"(항상
`never` 로 붕괴하는 퇴화 케이스를 잡기 위함)를 함께 설명해, 검증 로직 자체를 검증하는 재귀적 함정까지
사전에 방어했다. 함수/클래스 길이·중첩 깊이 모두 문제 없음(각 클래스 1메서드, 조건부 타입 없음).

## 요약

이전 사이클 maintainability WARNING(설계 근거 반복 서술)이 두 핸들러 클래스 docblock 을 직접 대조한
결과 실제로 잘 해소되어 있음을 확인했다. 신규 `AssertEndReasonDomain` 회귀 fixture 는 네이밍·구조·
자기검증(sanity case) 면에서 모범적이다. 남은 항목은 모두 이전 리뷰에서 이미 INFO 로 분류되어 수용된
것이거나(조건부 타입 표현 중복, 수동 opt-in lock) 이번에 새로 관측된 경미한 사항(`*.type-fixture.ts`
명명 패턴의 컨벤션 미등재)뿐이며, 모두 non-blocking 이다. 코드베이스 기존 스타일(`_universalNonEmpty`,
`_exhaustive` 언더스코어 phantom const 패턴)과의 일관성도 유지된다.

## 위험도

LOW
