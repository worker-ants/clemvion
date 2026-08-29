# 요구사항(Requirement) 리뷰 — C2 캐너리 + `secret-resolver` 주석 보강 (4라운드 누적 diff)

## 검증 방법

- 실제 저장소 파일을 직접 열어 확인(프롬프트 게이트 숫자와 대조): `expression-resolver.service.spec.ts`,
  `code.handler.spec.ts`, `packages/expression-engine/src/{errors.ts,__tests__/error-shape.spec.ts}`,
  `secret-resolver.service.ts`, `plan/in-progress/deps-peer-gating-and-eslint10.md`.
- `spec/5-system/3-error-handling.md` §6.3.1 (C1/C2 정의) 및 `## Rationale` 의
  "`Error.cause` 부착 기준을 '소비처가 직렬화하는가' 로 잡지 않은 이유" 문단을 line-level 대조.
- 테스트 실제 실행(읽기 전용, 저장소 뮤테이션 없음):
  - `cd codebase/backend && npx jest src/modules/execution-engine/expression/expression-resolver.service.spec.ts src/nodes/data/code/code.handler.spec.ts` → **138 passed / 138**
  - `cd codebase/packages/expression-engine && npx jest src/__tests__/error-shape.spec.ts` → **10 passed / 10**
- `git diff origin/main -- <5개 실질 변경 파일>` 에서 TODO/FIXME/HACK/XXX 검색 → 0건.
- `git log --oneline` 으로 이번 diff 가 4라운드(`11_58_35`→`12_23_45`→`12_50_04`→본 라운드
  `13_10_54`) 누적 fix-review 사이클의 결과물임을 확인 — 프롬프트의 파일 1~5(실 코드/테스트)는
  이미 3차례 리뷰·fix 를 거쳤고, 파일 6~38 은 그 세 라운드의 산출물(`review/code/**`)이
  `origin/main` 대비 신규 파일로 잡혀 diff 에 포함된 것.
- 저장소 트리는 건드리지 않았다 (`git status --short` = 세션 출력 디렉터리 1개만, 실질 변경 파일 0).

## 발견사항

- **[INFO]** 이전 라운드가 지적한 "4개 오류 종류" vs 3개 나열 불일치는 실측으로 해소됨을 확인
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:199-207` (현재 파일 실측 줄번호, `it.each` 4-tuple)
  - 상세: 1라운드 WARNING(4개 주장 vs 3개 나열, 코드화된 커버리지는 syntax 1종뿐)이 이후
    `it.each` 로 `ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError`/
    `ExpressionFunctionError` 4종 모두를 실행 경로로 지나가게 확장됐고, 3라운드 WARNING(리뷰어가
    4번째 클래스를 뮤테이션으로 뚫음)까지 반영해 `packages/expression-engine/src/__tests__/error-shape.spec.ts`
    가 `errors.ts` export 를 전수 열거(6개 하위 클래스)하는 별도 캐너리로 보강됐다. 직접 실행해
    138/10 전부 GREEN 을 확인했고, `errors.ts` 를 읽어 `EXPECTED_CODE` 표(클래스→코드 1:1)와
    실제 constructor 서명(`code`/`position` 만 own key, enumerable)이 일치함을 확인했다.
  - 제안: 조치 불요 — 이미 해소됨. 참고로만 기록.

- **[INFO]** `secret-resolver.service.ts` 신규 주석과 spec §6.3.1 Rationale 이 line-level 로 일치
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95-99` (diff 게이트)
  - 상세: "§6.3.1 은 '소비처가 직렬화하는가' 를 기준으로 삼는 안을 명시적으로 기각했다"는 신규
    서술을 `spec/5-system/3-error-handling.md` `## Rationale` 의 "기각한 쪽은 '지금 `.cause` 가
    클라이언트로 직렬화되는가' 다 … 그래서 기준을 에러 객체 자신의 성질(C1 message 포함 여부·C2
    부가 속성 유무)에 걸었다. 소비처와 무관하게 불변이다" 문단과 대조한 결과, 인용이 정확하고
    "판정은 C1 하나로 끝났다"는 서술도 §6.3.1 본문(C1 이 거짓이면 C2 판정 불요)과 부합한다.
    spec-drift 나 코드측 오류 없음.
  - 제안: 조치 불요.

- **[INFO]** 열려 있는 후속 항목("형제 3곳→4곳" 정정, `cause` 비노출 계측 지점)이 plan 에 정직하게 미체크로 남아 있음
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` (§2, `- [ ]` 항목 2건 — "`cause` 비노출 불변식의 계측 지점", "근거 서술 중복 정리 묶음")
  - 상세: 이번 diff 범위(파일 1~5)는 이 두 항목을 처리하지 않았고, plan 문서도 그것을 완료로
    거짓 표시하지 않았다(체크박스 `[ ]` 유지, developer SKILL §수렴 예외 (a)~(d) 근거 명시).
    "미완성 작업"이지만 TODO 주석이 아니라 plan 트래커에 정확히 등재돼 있어 은폐된 갭이 아니다.
  - 제안: 조치 불요 — 다음 세션에서 별도로 처리될 항목. 요구사항 완전성 관점에서 감점 요소 아님.

## 검증한 것 (문제 없음 확인)

- `it.each` fixture 4종이 실제로 서로 다른 클래스로 갈라지는지(`cause.name` 단언), `code`/`position`
  의 정확값·모양(shape)까지 코드가 실측으로 잠그고 있음을 소스 대조로 확인.
- `error-shape.spec.ts` 의 `SUBCLASSES` 전수 열거 로직(`typeof value === 'function' && value !== ExpressionError && value.prototype instanceof ExpressionError`)이 `errors.ts` 의 6개 하위 클래스(`SyntaxError`/`ReferenceError`/`TypeError`/`FunctionError`/`TimeoutError`/`DepthExceededError`) 전부를 정확히 골라내고 base 클래스·`ErrorCode` enum 은 제외함을 확인.
- `TimeoutError`/`DepthExceededError` 는 `position` 인자를 받지 않는 1-arg 생성자인데, 테스트가
  `new Cls('probe message')` 로 균일 호출해도 TS 구조적 타이핑상 유효하고 런타임에서도 GREEN.
- `captureThrown`/`captureRejected` 헬퍼의 vacuity-guard(`expect(thrown).toBeInstanceOf(Error)`)가
  각 캐너리·기존 케이스 전부에서 실제로 실행 경로를 거쳐 통과함(즉 헬퍼 추출 후에도 vacuous 로
  퇴화하지 않음)을 직접 실행으로 확인.
- 반환값·에러 시나리오: 신규 캐너리 2건 모두 catch 경로에서 항상 `Error` 를 반환/캡처하며,
  `resolveConfig`/`handler.execute` 가 정상 흐름에서 reject/throw 하지 않는 나머지 기존 테스트는
  diff 로 건드리지 않았다.

## 요약

리뷰 대상 diff 는 실질적으로 5개 파일(테스트 3건 추가/확장·프로덕션 주석 1건 보강·plan 문서 갱신)이며 프로덕션 로직 변경은 0건이다. 나머지 33개 파일은 이전 3차례 fix-review 라운드의 산출물(`review/code/2026/08/29/{11_58_35,12_23_45,12_50_04}/**`)이 `origin/main` 대비 신규로 잡혀 diff 에 포함된 것으로, 그 자체가 새로운 요구사항 결함을 담고 있지 않다. 실 코드 변경(파일 1~5)에 대해 spec(`spec/5-system/3-error-handling.md` §6.3.1 및 Rationale)과 line-level 대조를 수행한 결과 C1/C2 판정 기준·화이트리스트 값·기각된 대안 서술이 모두 정확히 일치했고, 이전 라운드들이 지적했던 "숫자 불일치"·"커버리지가 문서 주장보다 좁다"는 결함은 `it.each` 확장 + 전수 열거 캐너리(`error-shape.spec.ts`) 도입으로 실측 해소됐음을 직접 테스트 실행(138/10 전부 GREEN)으로 재확인했다. TODO/FIXME/HACK/XXX 잔존 없음, 모든 경로에서 반환값·에러 처리 정의됨. 남은 두 항목(형제 카운트 정정, 근거 서술 중복 정리)은 plan 에 정직하게 미체크 상태로 등재돼 있어 은폐된 미완성이 아니다. 신규 요구사항 결함 없음.

## 위험도

NONE
