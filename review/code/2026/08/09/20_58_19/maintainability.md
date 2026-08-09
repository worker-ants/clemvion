# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 정정한 docstring이 캐너리 근거로 **테스트 설명 문자열 리터럴**을 그대로 인용해, 테스트 제목이 바뀌면 컴파일러/린트의 도움 없이 조용히 어긋날 수 있다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:27-31`
  - 상세: `이 경계를 고정하는 것은 아래 두 **단위 테스트**다` 절에서 `uuid.spec.ts`/`workspace-context.util.spec.ts`의 `it(...)` 설명 문자열을 그대로 docstring에 박아 넣었다. 이번 PR 자체가 "코드 주석이 가리키는 캐너리가 실제로는 그 술어에 닿지 않는다"는, 정확히 같은 클래스의 드리프트(잘못된 캐너리 인용)를 바로잡는 작업이다. 테스트 제목 문자열을 docstring에 하드코딩하면, 나중에 해당 `it` 제목이 리팩터링되거나 테스트가 분리/병합돼도 이 docstring은 아무 신호 없이 그대로 남아 다시 같은 종류의 stale 인용이 재발할 수 있다.
  - 제안: 테스트 제목 문자열 대신 파일 경로만 인용하거나(`uuid.spec.ts` 참고), 테스트 쪽에 "이 테스트가 깨지면 `uuid.ts` docstring의 경계 서술도 재검토할 것" 같은 역참조 주석을 남겨 양방향으로 결속시키는 편이 드리프트에 더 강하다. 필수 수정은 아니며, 반복된 실패 패턴에 대한 예방적 제안이다.

- **[INFO]** 부트 캐너리 docstring이 시점 고정 실측 카운트("142건")를 장기 유지 주석에 박아 넣었다 — 바로 이 PR이 고치는 "73건" stale 인용과 동일한 취약 패턴
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:29` (게이트 기준, "2026-08-09 정적 실측 142건")
  - 상세: 이번 수정은 과거 "73건"이라는 서브셋 수치를 상위집합 자리에 잘못 인용했던 것을 바로잡으면서 "142건"이라는 새 정적 실측치를 넣었다. 이 수치 자체는 코드 로직(`count === 0` 판정)에 쓰이지 않고 순수 설명 prose이므로 기능적 위험은 없지만, 라우트가 추가/제거될 때마다 이 숫자는 다시 부정확해진다 — 이 파일이 이미 한 번 겪은 문제(#1103의 "73건"이 인용 시점 이후 stale화)가 구조적으로 재발할 수 있는 자리다. 저자도 "정적 실측이라 런타임 집계와 정확히 같지는 않다"고 명시해 알려진 한계로 인정하고 있다.
  - 제안: 이미 날짜(`2026-08-09`)를 명시해 스냅샷임을 밝힌 점은 좋은 완화다. 추가로 "이 수치는 참고용 스냅샷이며 최신 값을 보장하지 않는다"는 취지를 한 문장 더 넣거나, 정확한 수치보다 "두 자릿수/세 자릿수" 같은 자릿수 정도의 서술로 낮추면 향후 재-정정 사이클을 줄일 수 있다. 현재 상태로도 심각하지 않다(비-기능 prose).

- **[INFO]** 두 파일 모두 docstring/코드 비율이 매우 높다(예: `isUuidShaped` 3줄 함수에 33줄 JSDoc) — 이 저장소의 확립된 "rationale-heavy" 주석 컨벤션과 일치하지만, 문서-현실 드리프트 표면을 넓힌다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:16-49` (함수 본문 `codebase/backend/src/common/utils/uuid.ts:53-55`), `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:5-49` (파일 전체 약 90줄 중 44줄이 최상단 JSDoc)
  - 상세: 이 저장소는 코드 주석에 설계 근거(Rationale)를 상세히 남기는 것이 명시적 컨벤션이며(`spec/*.md ## Rationale` 미러링, CLAUDE.md의 "Rationale 연속성" 워크플로), 이 자체는 결함이 아니다. 다만 같은 사실이 코드 docstring · spec Rationale(`data-flow/12-workspace.md`) · plan 문서(`spec-draft-auth-invariants-sync.md`) 세 곳에 거의 동일하게 중복 서술되어 있어(의도된 SoT-계층화이긴 하나), 한 곳만 갱신되고 나머지가 stale해지는 사고가 실제로 이미 두 번(73건 오지목, e2e 캐너리 오지목) 발생했다. 순수 유지보수성 관점에서는 "복제된 서술 다수 지점"이 구조적으로 drift에 취약한 형태라는 점만 기록해 둔다.
  - 제안: 현재 컨벤션을 뒤집을 필요는 없다(이미 저장소가 의도적으로 선택한 트레이드오프). 다만 코드 docstring 쪽은 "요약 + spec Rationale 링크" 정도로 더 줄이고 세부 서사는 spec 쪽 SoT에만 두는 방향을 장기적으로 고려할 수 있다(비필수 제안).

- **[INFO]** 네이밍·구조는 양호 — 별도 지적 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:73-91`, `codebase/backend/src/common/utils/uuid.ts:12-14,53-55`
  - 상세: `countWorkspaceIdConsumingRoutes` / `assertWorkspaceIdReflectionWorks` / `isValidUuid` / `isUuidShaped` 모두 동사-기반으로 목적을 명확히 드러내고, `is*`/`count*`/`assert*` 접두 컨벤션이 파일 내·저장소 전반과 일관된다. 이번 diff는 두 파일 모두 **주석/문서만 변경**하고 함수 시그니처·로직·중첩·분기는 전혀 건드리지 않아 함수 길이·중첩 깊이·순환 복잡도 관점에서 새로 도입된 위험이 없다.

## 요약

이번 변경은 `codebase/backend/src/common/{decorators/workspace-reflection-canary.ts, utils/uuid.ts}`의 **docstring만** 정정하는 순수 문서 수정이며, 실행 코드(로직·분기·시그니처)는 전혀 바뀌지 않았다. 함수 길이·중첩 깊이·순환 복잡도·중복 로직 관점에서 새로 도입된 리스크는 없고, 네이밍도 기존 컨벤션과 일관된다. 유일하게 짚을 만한 점은 정정된 docstring 자체가 다시 "테스트 제목 문자열 리터럴 인용"과 "시점 고정 실측 카운트"라는, 이번 PR이 바로잡으려던 것과 동일한 클래스의 향후 drift 표면을 안고 있다는 것이다 — 둘 다 비-기능적(prose)이라 심각하지 않고, 날짜 명시·spec 링크 등 완화 조치가 이미 되어 있어 INFO 수준으로만 기록한다. plan/review 산출물(파일 3~13)은 마크다운/JSON 문서·생성 리포트로, 전통적 "코드" 유지보수성 기준(함수 길이·중첩·매직넘버 등)이 적용될 대상이 아니며 이 changeset에서 별도 결함은 관찰되지 않았다.

## 위험도

LOW
