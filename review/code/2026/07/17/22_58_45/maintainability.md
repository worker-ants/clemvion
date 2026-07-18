# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 동일한 "bivariance / TS2416" 설계 근거 서술이 4곳 이상에 거의 그대로 반복됨
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler` 인터페이스 상단 docblock(`TEndReason` 섹션), `endMultiTurnConversation` 메서드 docblock, `AssertEndReasonDomain` docblock, `isResumableNodeHandler` docblock. 그리고 `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 클래스 상단 docblock, `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 클래스 상단 docblock.
  - 상세: "메서드 파라미터는 bivariant 라 `implements` 만으로는 좁히기가 안 잡힌다", "IE 가 `implements` 를 선언하면 TS2416 이 난다", "안전은 타입이 아니라 호출 패턴이 지켰다" 는 동일한 설계 근거가 최소 5개 지점에서 문장 단위로 재서술된다. 이 PR 자체가 "값 도메인은 한 곳에서 파생시켜 drift 를 구조적으로 막는다"(`UniversalEndReason`, `CONVERSATION_END_REASONS`)는 목표를 갖는데, 정작 그 설계를 설명하는 **산문(rationale)** 은 여러 곳에 손으로 복제돼 있다. 향후 이 근거가 수정/보완될 때(예: TS 버전업으로 `strictFunctionTypes` 가 켜지거나 bivariance 판정이 달라지는 경우) 일부 지점만 갱신되고 나머지가 stale 서술로 남을 위험이 있다.
  - 제안: 핵심 설명(bivariance 실패 이유·TS2416·`implements` 가 못 잡는 축)은 `AssertEndReasonDomain` 또는 인터페이스 상단 docblock **한 곳**에만 전문을 두고, 나머지 지점(두 핸들러 클래스 docblock, 메서드 docblock)은 `{@link AssertEndReasonDomain}` / `{@link ResumableNodeHandler}` 참조 + 1~2문장 요약으로 축약. 코드 SoT 를 한 곳에 모으듯 "설계 rationale" 도 canonical 위치를 지정하는 편이 이 PR 의 취지와 더 정합적이다.

- **[INFO]** `AssertEndReasonDomain` 의 조건부 타입에서 `Parameters<...>[1]` 표현식이 중복
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` `AssertEndReasonDomain` 정의부
    ```ts
    export type AssertEndReasonDomain<...> =
      [Parameters<THandler['endMultiTurnConversation']>[1]] extends [TDeclared]
        ? [TDeclared] extends [Parameters<THandler['endMultiTurnConversation']>[1]]
          ? true
          : never
        : never;
    ```
  - 상세: 같은 `Parameters<THandler['endMultiTurnConversation']>[1]` 조회가 두 번 등장한다. 동작에는 문제 없으나(둘 다 같은 타입으로 evaluate), 상호 대입 가능성(mutual assignability) 체크를 위한 범용 `Equal<A, B>` 스타일 유틸리티로 한 단계 분리하면 "무엇을 비교하는지"가 더 명확해지고 향후 다른 곳에서 같은 패턴이 필요할 때 재사용 가능하다.
  - 제안 (선택적): `type Actual<THandler extends {...}> = Parameters<THandler['endMultiTurnConversation']>[1];` 로 이름 붙이거나, 범용 `type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;` 로 추출해 `AssertEndReasonDomain<THandler, TDeclared> = Equal<Actual<THandler>, TDeclared>` 형태로 재구성.

- **[INFO]** `_endReasonDomainLock` 부착이 컴파일러/린트로 강제되지 않는 수작업 컨벤션
  - 위치: `ai-agent.handler.ts` 끝부분, `information-extractor.handler.ts` 끝부분 각각의 `const _endReasonDomainLock: AssertEndReasonDomain<...> = true; void _endReasonDomainLock;` 블록
  - 상세: 이 5줄 블록이 있어야만 "선언 도메인 == 실제 수용 도메인"이 컴파일 타임에 잠긴다. 그런데 이 블록 자체를 **새 `ResumableNodeHandler` 구현체에 추가하는 것을 강제하는 장치가 없다** — 미래에 세 번째 resumable 핸들러가 추가되면서 이 5줄을 빠뜨리면, 이 PR 이 정확히 해결하려던 문제("`implements` 는 있지만 파라미터 좁히기가 검사되지 않는" 상태)로 조용히 되돌아간다. 다만 현재는 구현체가 2개뿐이고 plan 문서(`범위 밖` 섹션)에서 이 스코프를 이미 인지하고 있어 심각도는 낮다.
  - 제안 (선택적, 후속 과제): 두 핸들러를 한 배열에 등록해 `AssertEndReasonDomain` 을 map 형태로 일괄 적용하는 헬퍼, 또는 handler-registry 순회 기반의 타입 체크로 전환하면 신규 핸들러 추가 시 "빠뜨림"이 구조적으로 불가능해진다. 지금 당장 필요한 리팩터는 아님.

- **[INFO]** 개념적 난이도(변성·bivariance)가 높아 온보딩 비용이 있음 — 문서화로 상당히 완화되어 있음
  - 위치: `node-handler.interface.ts` `TEndReason`/`AssertEndReasonDomain` 관련 전체
  - 상세: TS 메서드 파라미터 bivariance, `strictFunctionTypes` 미적용, 공변/반공변 등은 팀 내 TS 숙련도에 따라 진입 장벽이 있다. 다만 각 블록이 "왜"를 상세히 설명하고 있어(이 자체가 위 WARNING 의 중복 원인이기도 함) 실질적 이해 장벽은 크게 낮춰져 있다. 별도 조치 불필요, 참고용 기록.

## 요약

타입 안전성을 높이는 본질적으로 견고한 설계다 — 제네릭화·기본값을 교집합으로 두는 선택·`AssertEndReasonDomain` 을 통한 bivariance 우회 차단이 모두 근거가 명확하고 plan 문서의 결정 표와도 일치한다. 네이밍(`TEndReason`, `UniversalEndReason`, `AssertEndReasonDomain`, `_endReasonDomainLock`)은 목적을 잘 드러내며, 기존 패키지의 `_universalNonEmpty`/`_exhaustive` 잠금 패턴과 스타일이 일관된다. 함수 길이·중첩 깊이·매직 넘버 문제는 없다(이번 변경은 타입 선언 위주). 가장 눈에 띄는 개선 여지는 동일한 설계 근거(bivariance 실패·TS2416)가 인터페이스·두 핸들러 파일에 걸쳐 4~5곳에 거의 그대로 복제되어 있다는 점으로, 이 PR 이 지향하는 "단일 SoT, drift 차단" 원칙을 문서화 자체에도 적용하면 더 일관될 것이다. 그 외에는 실질적 유지보수 리스크는 낮다.

## 위험도
LOW
