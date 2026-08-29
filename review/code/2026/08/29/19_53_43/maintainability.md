# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `Logger.prototype` spy 무음화 2줄 패턴이 신설 `describe` 블록 안에서 3개 소스 위치에 반복된다 (직전 라운드 `19_17_28` maintainability.md INFO 로 이미 지적됐고, 리뷰어 스스로 "규모가 작아 필수는 아님" 으로 낮춰 won't-do 처리됨 — 재확인 목적으로 유지)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts:270`(`error`), `:302`(`warn`), `:349-354`(`error`+`warn` 동시, `it.each` 공유 바디)
  - 상세: 세 위치 모두 `jest.spyOn(Logger.prototype, '<level>').mockImplementation(() => undefined);` 를 그대로 반복한다. 파일 상단에 이미 `mockHost()`/`bodyOf()` 같은 공용 헬퍼가 있어 이 패턴만 유독 인라인으로 남아 있는 형태다. 동작에 문제는 없다.
  - 제안: `function silenceLogger(...levels: Array<'error' | 'warn'>): void { levels.forEach((l) => jest.spyOn(Logger.prototype, l).mockImplementation(() => undefined)); }` 로 추출하면 3곳이 1줄씩으로 준다. 이전 라운드에서 이미 won't-do 로 결정된 사안이라 블로킹 아님 — 재지적하지 않아도 무방.

- **[INFO]** `findWiredComponents` 의 반환 타입 `{ file: string; component: string | null }[]` 이 같은 함수 안에서 두 번 인라인으로 반복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:121`(함수 시그니처 반환 타입), `:122`(`const found` 변수 선언 타입)
  - 상세: 두 자리가 정확히 같은 구조적 타입 리터럴을 따로 적고 있다. 지금은 함수 하나 안에서만 쓰여 drift 위험이 낮지만, 이 파일 자체가 "정규식 대신 AST"·"근거 정본화" 등 중복 축소를 지향하는 가드라는 점에서 같은 정리 대상 후보다.
  - 제안: `type WiredComponent = { file: string; component: string | null };` 로 이름을 붙여 함수 반환 타입과 `found` 선언 양쪽에서 재사용.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 가 다단계 blockquote 정정("정정의 정정")을 계속 누적한다 — 직전 라운드에서 이미 지적된 것과 동일한 형태이며, 이번 diff 가 그 위에 또 한 겹(2026-08-29 재실측 문단)을 얹는다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:584-611`(신규 추가된 "재실측 (2026-08-29)" 인용 블록)
  - 상세: 직전 라운드(`review/code/2026/08/29/19_17_28/maintainability.md`)가 제안한 "`complete/` 이동 전 '현재 유효한 결론' 요약 섹션 추가"는 이번 PR 에서 **자매 문서인 `deps-peer-gating-and-eslint10.md` 에는 적용됐으나**(그 문서는 `complete/` 로 이동하며 상단에 요약 절이 추가됨 — `RESOLUTION.md` INFO#7 처분 기록), `backend-lint-gate-broken-on-main.md` 는 여전히 in-progress 라 그 완화가 적용되지 않았고, 이번 diff 로 중첩이 한 단계 더 깊어졌다.
  - 제안: 새 기능 요구는 아니며 이번 PR 을 막을 사안도 아니다. 이 문서가 `complete/` 로 이동하는 시점에 동일한 "현재 유효한 결론" 요약 절을 추가하는 것을 그때 함께 고려.

## 확인 완료 (문제 없음)

- 이전 라운드(`19_17_28`)가 WARNING/INFO 로 지적한 항목 중 코드로 처분된 것들이 이번 diff 상태에 실제로 반영돼 있음을 재확인했다:
  - 봉투 닫힌 키 집합 리터럴 중복(`['code','message','requestId']`) — `CLOSED_ENVELOPE_KEYS` 상수로 추출돼 `http-exception.filter.spec.ts:231` 한 곳에서 선언되고 `:360-362`(`it.each` 공유 바디), `:378-380`(비-Error fallthrough) 두 곳에서 재사용된다. 중복 해소 확인.
  - `cause` 값(마커) 누출 단언이 `it.each` 4개 분기 공유 바디(`:367`)에 일괄 추가돼 있어, 분기별 비대칭(직전 WARNING#1)이 코드 구조상으로도 해소됨을 확인.
- `expression-resolver.service.spec.ts`(파일 2)·`code.handler.spec.ts`(파일 4)의 "왜 enumerable own key 인가" 근거 서술을 `error-shape.spec.ts`(파일 7)로 정본화한 것은 순수하게 유지보수성을 개선하는 방향이다 — 동일 근거 문단이 3곳에 축약 없이 복제돼 있던 상태(주석 자체가 실측으로 밝힘)를 단일 SoT + 위임 참조로 좁혔다. 근거가 바뀔 때 한 곳만 고치면 되는 구조가 됐다.
- `secret-resolver.service.ts` 의 "형제 3곳→4곳" 정정은 주석 한 줄뿐이고 그 수치도 실제 파일 목록(`expression-resolver.service.ts/.spec.ts`, `code.handler.ts/.spec.ts`)과 일치 — 가독성·정확성 모두 개선.
- 신규 `redis-fail-open-catalog-guard.ts`/`redis-fail-open-catalog.spec.ts` 는 함수 단위 책임이 명확하다(`readUnionMembers`/`readCatalogComponents`/`listProductionSources`/`findWiredComponents` 각각 단일 목적, 최대 길이 약 40줄). 네이밍은 동사+명사 패턴으로 일관되고, 기존 형제 가드(`masked-reject-callers-guard.ts`)의 "정규식 대신 AST" 컨벤션을 그대로 따른다. 중첩 깊이도 AST visitor 재귀 함수 수준을 넘지 않아 과도하지 않다.
- 매직 넘버 — HTTP 상태 코드(`409`/`413`/`404`/`500`)는 테스트 단언 맥락에서 의미가 자명해 명명 상수가 필요한 수준은 아니다. 그 외 하드코딩 문자열(`CAUSE_MARKER`, `UNION_TYPE_NAME`, `RECORDER_FN` 등)은 전부 이름 있는 상수로 선언돼 있다.

## 요약

이번 diff 의 실질 코드 표면은 좁다 — 신규 순수 로직은 `redis-fail-open-catalog-guard.ts`(AST 파서) 하나이고, 나머지는 그 소비 테스트와 기존 `cause` 비노출 불변식 관련 spec 4곳의 주석/테스트 정리다. 직전 코드 리뷰 라운드(`19_17_28`)가 지적한 유지보수성 관련 항목(봉투 키 리터럴 중복, `cause` 값 누출 분기 비대칭)은 이번 diff 상태에서 이미 코드로 반영·해소돼 있음을 직접 대조로 확인했고, 근거 서술의 정본화(파일 2·4·7)는 오히려 중복을 줄이는 방향이라 유지보수성을 개선한다. 남은 지적은 전부 INFO 수준의 소규모 DRY 여지(Logger spy 무음화 반복 — 이미 won't-do 로 결정됨, `findWiredComponents` 반환 타입 인라인 중복)와 계속 성장 중인 plan 트래커 하나(`backend-lint-gate-broken-on-main.md`)의 문서 비대화뿐이며, 이번 PR 자체를 막을 사안은 없다. 네이밍·함수 길이·중첩 깊이·매직 넘버·기존 컨벤션 준수 전반은 양호하다.

## 위험도

LOW
