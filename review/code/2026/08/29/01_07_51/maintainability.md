# 유지보수성(Maintainability) 리뷰

## 개요

이번 변경분은 6개 파일 모두 **주석/문서 수정**이며, 코드 로직(실행 경로) 변경은 없다.

- `expression-resolver.service.ts` / `code.handler.ts` / `secret-resolver.service.ts`: `cause` 부착·비부착 판단 근거 주석을 요약형에서 "정본(`spec/5-system/3-error-handling.md` §6.3.1) 포인터 + 이 자리가 그 기준을 만족하는 방식만 로컬 서술" 형태로 교체.
- `expression-resolver.service.spec.ts` / `code.handler.spec.ts`: 같은 목적의 테스트 케이스 주석 교체.
- `plan/in-progress/deps-peer-gating-and-eslint10.md`: 앞서 "정본에 등재됐다" 고 잘못 기록한 사실을 정정하고 실제 처리 내역을 기록.

## 발견사항

- **[INFO]** `§6.3.1` 포인터 주석 패턴이 5곳(3개 소스 파일 + 2개 spec 파일)에 반복된다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316` / `codebase/backend/src/nodes/data/code/code.handler.ts:454` / `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:89`
  - 상세: 각 자리가 "기준의 정본은 spec X 다, 여기 요약하지 않는다, 이 자리가 C1/C2 를 어떻게 만족하는지만 적는다" 형태의 도입부를 개별적으로 서술한다. 각 사이트가 왜 C1/C2 를 만족(또는 불만족)하는지는 서로 다르므로 내용 중복은 아니지만, "정본 포인터 + 이 규약을 안 잊는다" 는 보일러플레이트 문구 자체는 5곳에서 손으로 동기화해야 한다. `§6.3.1` 이 재넘버링되면 5곳을 모두 찾아 고쳐야 하는데, 이번 PR 자체가 "요약을 주석에 남겨두면 정본과 갈린다"는 실패를 겪은 뒤 나온 수정이라 재발 방지 관점에서는 legit한 트레이드오프다.
  - 제안: 지금 규모(5곳)에서는 실질적 조치가 필요하지는 않다. 다만 이런 포인터가 더 늘어난다면(예: 6번째 `cause` 판단 지점 추가) `git grep '§6.3.1'` 같은 점검을 CI 화하거나, 최소한 plan/consistency 문서에 "이 문구가 나열되는 전체 위치" 를 등재해 두는 편이 향후 spec 넘버링 변경 시 놓치는 자리를 줄인다.

- **[INFO]** `secret-resolver.service.ts` 의 `catch` 블록 주석이 10줄(코드 89~98)로, 뒤따르는 실질 코드는 `eslint-disable-next-line` 1줄 + `throw new Error(...)` 1줄뿐이다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:89-99`
  - 상세: 주석 대 코드 비율이 매우 높지만, 이 자리는 보안 관련 예외(암호화 에러 상세를 사용자에게 노출하지 않기 위해 `cause` 를 의도적으로 떼는 유일한 자리)를 다루므로 근거를 온전히 남겨야 하는 자리다. 실제로 이번 diff 는 기존 5줄 설명을 대체하며 C1 불성립 근거를 앞에 추가한 것이라 순수 증가라기보다 재구성에 가깝다.
  - 제안: 별도 조치 불필요. 다만 향후 이 파일에 `cause` 판단이 필요한 지점이 하나라도 더 생기면, 지금처럼 매번 전체 근거를 재서술하기보다 클래스 최상단 doc-comment(이미 있는 `secret-store.md §2` 링크 옆)에 "이 서비스의 catch 블록은 §6.3.1 비부착 사례" 라는 한 줄을 추가해 반복을 줄이는 선택지가 있다.

- **[INFO]** `code.handler.ts` 주석은 왜 테스트가 `toBeInstanceOf(Error)` 대신 `toBeDefined()` 를 쓰는지(cross-realm `SyntaxError`)까지 함께 설명한다.
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts:454-457`
  - 상세: 소스 코드 주석이 테스트 파일의 단언 형태 차이까지 언급하는 것은 다소 이례적이지만(보통 이런 설명은 테스트 파일 쪽에만 둔다), 실제로 `code.handler.spec.ts` 쪽에도 동일 설명이 대칭적으로 존재해(`형제 expression-resolver 케이스는 같은 realm 이라 instanceof 가 성립한다`) 두 파일이 서로를 참조하는 형태다. 코드 변경이 아니라 순수 정보 전달이므로 리스크는 없다.
  - 제안: 없음 (현행 유지 가능).

- **[INFO]** `plan/in-progress/deps-peer-gating-and-eslint10.md` 는 이번 diff 에서 "정본에 등재됐다고 적었던 것이 거짓이었다" 는 자기 정정을 추가한다.
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:346-361` (체크리스트 항목 내 인용 블록)
  - 상세: 코드가 아니므로 가독성/복잡도 기준은 적용되지 않지만, 이 정정 자체가 "조건부 처분을 봉인된 `complete/` 에만 남기면 유실된다" 는 이 프로젝트의 기존 교훈(plan lifecycle 문서에도 있는 패턴)을 그대로 재현·기록하고 있어 향후 동일 실수를 줄이는 데 도움이 된다. 별도 지적 사항 없음.

## 요약

6개 파일 모두 주석/문서 수정에 한정되며 실행 로직 변경은 없다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 새로 도입된 문제는 없고, 오히려 이전에 인라인 주석이 spec 원문과 갈렸던(§6.3.1 C1만 적혀 있던) 문제를 "정본 포인터 + 로컬 근거만 서술" 패턴으로 교정해 향후 drift 가능성을 줄였다. 유일하게 눈에 띄는 트레이드오프는 동일한 포인터 보일러플레이트가 5개 위치에 손으로 동기화돼야 한다는 점이지만, 각 위치의 로컬 근거가 서로 다르고 지금 규모에서는 관리 가능한 수준이라 INFO 등급 이상으로 볼 사항은 없다.

## 위험도

NONE
