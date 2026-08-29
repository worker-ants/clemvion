# 유지보수성(Maintainability) 리뷰

## 배경

이 diff 는 `origin/main` 대비 5개 커밋(`3e2360db0`~`0718302bc`)의 누적이며, 이미 3라운드
(`11_58_35`→`12_23_45`→`12_50_04`)의 `/ai-review` + fix 사이클을 거쳤다. 실 코드 변경은
4개 파일(`expression-resolver.service.spec.ts`, `secret-resolver.service.ts`,
`code.handler.spec.ts`, 신규 `error-shape.spec.ts`) + plan 문서 1개뿐이고, 나머지 33개는
이전 세 라운드의 review 산출물을 그대로 커밋한 감사 기록이라 유지보수성 관점의 리뷰 대상이
아니라고 판단했다(코드가 아니라 프로세스 이력 문서). 아래는 4개 코드/테스트 파일 + plan
문서를 직접 `Read` 로 열어 현재 상태를 재검증한 결과다.

## 발견사항

- **[INFO]** `captureThrown`/`captureRejected` 캡처 헬퍼가 저장소의 기존 `__test-utils__` 공유 헬퍼 관례를 따르지 않고 두 spec 파일에 각각 독립 정의돼 있다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:20-34`(`captureThrown`), `codebase/backend/src/nodes/data/code/code.handler.spec.ts:9-24`(`captureRejected`)
  - 상세: 두 헬퍼는 sync/async 쌍일 뿐 구조가 거의 동일하고, JSDoc 도 "vacuity 방지 단언을 품고 있다 — 아무것도 던지지/reject 하지 않으면 `.cause` 가 `undefined` 라 뒤따르는 단언이 전부 조용히 통과해 버린다" 문장을 거의 그대로 복제한다. `code.handler.spec.ts` 쪽이 스스로 "형제 `expression-resolver.service.spec.ts` 에 동기 버전이 있다"고 명시해 쌍둥이 관계를 인지하고 있다. 저장소에는 이미 `codebase/backend/src/common/__test-utils__/`, `codebase/backend/src/modules/integrations/__test-utils__/` 같은 공유 테스트 헬퍼 디렉터리 관례가 존재하므로(직접 확인), 두 모듈에 걸쳐 재사용되는 이 헬퍼도 그 관례를 따르는 편이 일관됐을 것이다. 새 발견은 아니다 — 이전 라운드(`12_23_45`, `12_50_04`)가 이미 INFO 로 지적했고, `plan/in-progress/deps-peer-gating-and-eslint10.md:528-534` "근거 서술 중복 정리 묶음" 후속 항목으로 developer SKILL §수렴 예외 (a)~(d) 근거와 함께 명시적으로 등재돼 있음을 재확인했다(spec-linked 파일 재편집이 `/ai-review`·`--impl-done` freshness 를 동시에 재무장시킨다는 근거).
  - 제안: 급하지 않음(이미 tracked). 다음에 이 자리를 만질 때 캡처 헬퍼를 공용 `__test-utils__` 로 옮기고 JSDoc 을 그 한 곳에만 두면, 이미 두 번(파일 안 중복 제거 → 파일 간 중복 재발견) 반복된 "발견 → 유예 → 재확인" 사이클을 끊을 수 있다.

- **[INFO]** "enumerable own key 를 축으로 쓰는 이유" 설명이 이제 세 파일에 거의 동일 문장으로 중복된다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:178-181`, `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:19-22` (전문 반복) / `codebase/backend/src/nodes/data/code/code.handler.spec.ts:245-246`("그쪽 주석에 있다"로 참조만 — 중복을 이미 피하는 선례)
  - 상세: 신규 패키지 캐너리(`error-shape.spec.ts`)가 추가되며 같은 근거 문단("`detail`/`hint`, HTTP 응답 헤더, 커넥션 문자열처럼 직렬화에 딸려 나오는 값" 운운)이 두 곳에서 세 곳으로 늘었다. `code.handler.spec.ts` 는 참조만 해 중복을 피하는 선례를 이미 보이는데, 신규 패키지 파일은 전방 참조 대신 전문을 다시 썼다. 새 발견은 아니다 — `12_50_04` 라운드가 이미 지적했고 위와 같은 plan 백로그 항목("근거 서술 중복 정리 묶음")이 "두 backend spec + 신규 패키지 캐너리" 세 곳의 중복을 명시적으로 포괄해 추적 중이다.
  - 제안: 급하지 않음(이미 tracked). 정리할 때 이 축 설명 자체를 `spec/5-system/3-error-handling.md` §6.3.1 Rationale 로 승격하고 세 test 파일은 전방 참조만 남기면 3중 동기화 비용이 사라진다.

- **[INFO]** `it.each` fixture 튜플이 위치 기반 `string[]` 이라 필드 순서 실수를 컴파일 타임에 못 잡는다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:199-207` (`it.each([['ExpressionSyntaxError', '{{ $input. }}', 'EXPR_SYNTAX_ERROR'], ...])`)
  - 상세: `className`/`expression`/`expectedCode` 세 칼럼이 전부 `string` 이라, 두 번째·세 번째 칼럼이 실수로 뒤바뀌어도 TypeScript 는 잡지 못한다. 다만 같은 케이스에 `cause.name`·`shape.code` 두 판별 단언이 걸려 있어 런타임 상으로는 안전하다는 점을 이 PR 스스로 뮤테이션(M7/M8, plan 기록)으로 실측 확인해 두었다. 순수하게 정적 표면만 열려 있는 상태라 우선순위가 낮다. 이 항목은 plan 백로그에 별도 문구로 등재돼 있지는 않지만, 세 라운드 연속 리뷰가 "우선순위 낮음/급하지 않음"으로 일관되게 판정했고 그 근거(런타임 가드 실측)가 유효해 새로 조치를 요구하지 않는다.
  - 제안: 우선순위 낮음. `%s` 대신 `$className` named substitution + 객체 리터럴 배열(`{ className, expression, expectedCode }`)로 바꾸면 필드 순서 실수의 여지가 준다.

- **[INFO]** `secret-resolver.service.ts` 의 `catch` 블록 안에서 주석이 실제 코드보다 훨씬 길다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:81-108` (`resolve()` 의 catch 블록 — 실행 코드는 `logger.error` 1줄 + `throw new Error(...)` 1줄뿐인데 그 사이·직전·직후에 주석이 약 24줄)
  - 상세: 이번 diff 로 4줄이 더 늘어(92-99행대) 기존에 이미 길었던 판정 근거 주석이 한층 더 길어졌다. 내용 자체는 정확하고(§6.3.1 인용이 spec 원문과 line-level 로 일치함을 확인) "판정축이 아니라 보조 근거"라는 오인 방지 문단이라 가치가 있지만, 실행 코드 2줄에 대한 주석이 24줄이면 이 함수를 처음 읽는 사람은 "무엇을 하는 코드인지"를 찾기 전에 긴 정책 논증부터 통과해야 한다. `expression-resolver.service.spec.ts:174-198`(C2 캐너리 앞 근거 주석)도 이전 라운드에서 같은 성격의 INFO 를 받은 바 있어, 이 저장소 전반에 반복되는 패턴이다.
  - 제안: 조치 불요(정책 결정으로 이미 여러 라운드에 걸쳐 검토됨). 다음에 §6.3.1 Rationale 로 근거를 승격하는 후속 작업(위 "근거 서술 중복 정리 묶음")을 진행할 때, 이 자리도 같이 정리해 코드 옆에는 "이 자리가 어떻게 그 기준을 만족하는가"만 남기는 방향이 자연스럽다.

## 확인한 것 (문제 없음)

- 1라운드(`11_58_35`) WARNING — "캡처 try/catch 보일러플레이트가 파일 안에서 반복된다" — `captureThrown`(동기)/`captureRejected`(비동기) 로컬 헬퍼 추출로 정확히 해소됐다. 기존 "cause 보존" 테스트와 신규 C2 캐너리가 각 파일에서 동일 헬퍼를 공유해, 같은 try/catch 패턴이 파일당 1곳으로 줄었다.
- `error-shape.spec.ts` 의 `SUBCLASSES` 필터(타입 가드 포함)·전수성 단언·`it.each` 구조는 가독성이 좋다. 네이밍(`ALLOWED_KEYS`, `SUBCLASSES`, `EXPECTED_CODE`)이 목적을 정확히 드러내고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮다. `EXPECTED_CODE` 정확값 표는 이전 라운드가 지적한 "enum 안의 값인가만 보는 타입 검사" 약점(3라운드 WARNING)을 근본적으로 고쳤다 — 클래스↔코드 매핑이 뒤바뀌면 즉시 실패한다.
- `expression-resolver.service.spec.ts:199-229` 의 `it.each` 는 `cause.name`(4클래스 판별)·`shape.code`(정확값)·`shape.position`(모양) 세 축을 각각 다른 이유로 단언해, 매직 넘버나 불필요한 중복 없이 필요한 만큼만 검증한다.
- 두 신규 C2 캐너리(`expression-resolver.service.spec.ts:219`의 화이트리스트 정렬 비교 vs `code.handler.spec.ts:259`의 빈 배열 비교)는 단언 형태가 다르지만, 각 파일 주석이 그 차이가 실측 데이터 차이(다중 서브클래스 vs 단일 컴파일 예외)의 정확한 반영임을 밝히고 있어 일관성 결함이 아니다.
- `secret-resolver.service.ts` 변경분(4줄)은 로직·시그니처를 건드리지 않는 순수 주석 추가이고, 기존 함수의 분기 구조·중첩에 영향이 없다.
- `review/code/2026/08/29/{11_58_35,12_23_45,12_50_04}/*` 는 이전 리뷰 라운드 산출물을 프로젝트 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)대로 그대로 커밋한 감사 기록이라 코드가 아니며, 유지보수성 기준(함수 길이·중첩·복잡도)을 적용할 대상이 아니라고 판단했다.

## 뮤테이션 검증

이번 라운드에서는 저장소를 뮤테이션하지 않았다. 이전 세 라운드(`RESOLUTION.md` M1~M12)가
같은 코드에 대해 이미 다수의 뮤테이션(민감 속성 주입, 클래스↔코드 맞바꿈, fixture 퇴화 등)을
수행해 예측/실측을 기록해 두었고, 오늘 `Read` 로 대조한 소스가 그 기록과 정확히 일치함을
확인했으므로 같은 뮤테이션을 반복할 근거가 없었다. `git status --short` 로 저장소 트리 무변경
확인함 — 뮤테이션 잔여물 없음.

## 요약

이번 diff 는 4라운드에 걸친 `/ai-review` 사이클의 최종 상태이며, 유지보수성 관점에서 이전에
지적된 실질적 결함(캡처 보일러플레이트 반복, 클래스-코드 매핑 약한 단언)은 모두 근본적으로
고쳐졌다. 프로덕션 로직 변경은 0건이고, 신규 코드(`error-shape.spec.ts`, `it.each` 확장,
캡처 헬퍼)는 네이밍·함수 길이·중첩·매직 넘버·순환 복잡도 어느 축으로도 문제가 없다. 남은
지적은 전부 INFO 수준의 "파일 간 서술/헬퍼 중복" — 캡처 헬퍼 JSDoc 2중 중복, enumerable 축
설명 3중 중복, `it.each` fixture 의 정적 타입 안전성 — 이며, 앞의 둘은 이미 plan 백로그에
developer SKILL §수렴 예외 근거와 함께 명시적으로 등재돼 다음 라운드로 미뤄져 있다(spec-linked
파일 재편집이 리뷰 게이트를 동시에 재무장시킨다는 근거가 유효함을 직접 확인했다). 새로
추가한 INFO(주석/코드 비율)도 즉시 조치가 필요한 수준은 아니다.

## 위험도

LOW
