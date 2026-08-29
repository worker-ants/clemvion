# 부작용(Side Effect) 리뷰

## 검토 대상 (실제 코드/설정 변경, `git diff origin/main --stat -- codebase/` 로 확인)

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — 캡처 헬퍼 `captureThrown` 추가 + 기존 중복 try/catch 를 헬퍼 호출로 치환 + `it.each` C2 캐너리 4종 추가 (테스트 전용)
2. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `catch` 블록 안 주석 5줄 추가뿐 (로직·시그니처·throw 형태 변경 없음)
3. `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — 캡처 헬퍼 `captureRejected` 추가 + 기존 중복 try/catch 치환 + C2 캐너리(빈 화이트리스트) 1건 추가 (테스트 전용)
4. `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` — 신규 파일. `ExpressionError` 하위 클래스 전수(`Object.entries(errors)` 로 export 를 열거)를 모양 검증하는 테스트

그 외 `plan/in-progress/deps-peer-gating-and-eslint10.md` 및 `review/code/2026/08/29/{11_58_35,12_23_45,12_50_04}/**`(이전 3개 리뷰 라운드의 RESOLUTION/SUMMARY/개별 에이전트 리포트/meta.json/_retry_state.json)는 문서·리뷰 산출물이며, 프로젝트 규약(`코드 리뷰 산출물은 review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/ 에 커밋, gitignore 대상 아님`)에 부합하는 정상적인 축적물이다. 코드/설정/CI 워크플로가 아니라 side-effect 관점의 실행 시점 영향이 없다.

## 소스 직접 확인 결과

- `captureThrown`/`captureRejected` 는 둘 다 `describe` 블록 **밖**에 선언된 순수 함수다. 인자로 받은 `fn` 을 실행해 캡처한 예외를 반환할 뿐, 모듈 스코프의 가변 상태·전역 변수·환경 변수·파일시스템·네트워크를 전혀 건드리지 않는다. 내부의 `expect(...)` 호출은 Jest 글로벌이며 기존 인라인 try/catch 가 이미 하던 것과 동일한 assert 다(순수 리팩터링, 새 부작용 없음).
- `error-shape.spec.ts` 의 `SUBCLASSES = Object.entries(errors).filter(...)` 는 `../errors` 모듈의 **export 를 읽기만** 한다 — 어떤 값도 대입·변경하지 않는다. `Object.entries` 는 얕은 복사본을 만들 뿐 원본 모듈 객체를 mutate 하지 않는다.
- `secret-resolver.service.ts` 의 diff 범위(catch 블록)를 직접 열어 확인 — 추가된 5줄은 전부 `//` 주석이고, `logger.error` 호출·`eslint-disable-next-line preserve-caught-error` 위치·이후 로직 모두 diff 이전과 바이트 단위로 동일하다.
- 이번 diff 가 건드리는 두 spec 파일에서 실제로 `process.env` 를 읽고 쓰는 기존 테스트(`expression-resolver.service.spec.ts:454` 부근 `$env` 관련 케이스들)는 diff 범위 밖이며 이번 변경으로 수정되지 않았다 — 기존 `delete process.env.EXPR_TEST_*` 원복 패턴에 영향 없음.
- 함수/메서드 시그니처 변경 없음(신규 헬퍼 2개는 새 로컬 함수이지 기존 시그니처의 변경이 아니다), export 되는 공개 API 변경 없음(신규 `error-shape.spec.ts` 는 프로덕션 export 를 추가하지 않는다), 이벤트/콜백 등록·발행 변경 없음, 신규 전역 변수 도입 없음.

## 검증용 뮤테이션

이번 라운드에서는 코드 변경분이 순수 리팩터링(캡처 헬퍼 추출)·테스트 추가·주석 추가뿐이라 별도의 파괴적 뮤테이션 실험이 side-effect 판정에 필요하지 않다고 판단해 수행하지 않았다. 저장소 트리에 어떤 파일도 쓰지 않았다 — `git status --short` 확인 결과 본 리뷰 세션이 만든 `review/code/2026/08/29/13_10_54/`(이 출력 파일 자신) 외에 다른 변경 없음.

## 발견사항

- **[INFO]** 이번 diff 는 이전 두 리뷰 라운드(11_58_35, 12_23_45)의 지적을 반영해 캡처 로직을 헬퍼로 추출하고 캐너리 축을 "도달 경로" 에서 "클래스 전수 열거" 로 바꾼 반복(iteration)이다. 코드 쪽 실질 변경은 테스트 리팩터링/추가와 주석 보강뿐이며 side-effect 표면(전역 상태·env·파일시스템·네트워크·시그니처·공개 API·이벤트) 어디에도 해당하는 변경이 없다.
  - 위치: 4개 코드 파일 전체
  - 제안: 없음 — 조치 불요.

## 요약

이번 diff 는 §6.3.1 C2 캐너리를 "주석" 에서 "단언" 으로 승격하는 작업의 최신 반복으로, 실질 변경은 (a) 두 spec 파일의 중복 try/catch 캡처 로직을 모듈 스코프 순수 헬퍼(`captureThrown`/`captureRejected`)로 추출, (b) `it.each`/신규 패키지 테스트로 커버리지 축을 "경로" 와 "클래스 전수" 로 이원화, (c) `secret-resolver.service.ts` 에 판정 근거를 명확히 하는 주석 5줄 추가뿐이다. 신규 헬퍼와 신규 테스트는 모두 순수 함수·읽기 전용 리플렉션이며 전역 변수·환경 변수·파일시스템·네트워크·기존 함수 시그니처·공개 인터페이스·이벤트/콜백 중 어느 것도 변경하지 않는다. `secret-resolver.service.ts` 변경은 로직 변경 없는 주석뿐이고, 나머지(plan 문서·이전 리뷰 라운드 산출물)는 코드가 아니라 실행 시점 부작용 대상이 아니다. 부작용 관점에서 우려할 사항을 찾지 못했다.

## 위험도

NONE
