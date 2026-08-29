# 부작용(Side Effect) 리뷰

## 검토 대상

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — C2 캐너리 테스트 1건 추가 (unit test)
2. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — 주석 5줄 추가 (기능 코드 변경 없음)
3. `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — C2 캐너리 테스트 1건 추가 (unit test)
4. `plan/in-progress/deps-peer-gating-and-eslint10.md` — plan 문서 체크박스/서술 갱신 (코드 아님)

전 4개 파일 중 기능 코드(production code)를 건드리는 곳은 파일 2뿐이며, 그마저도 순수 주석 추가라 런타임 동작에 변화가 없다. 나머지는 테스트 신규 추가와 plan 문서 갱신이다.

## 발견사항

관점 1~8(의도치 않은 상태 변경/전역 변수/파일시스템/시그니처·인터페이스 변경/환경 변수/네트워크 호출/이벤트·콜백)을 기준으로 4개 파일을 전수 점검했으나 해당하는 부작용을 찾지 못했다.

- **[INFO]** 신규 테스트 2건은 기존 캐너리 테스트와 동일한 격리 패턴을 따른다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:177-200`(`it('C2 캐너리 — ...')`), `codebase/backend/src/nodes/data/code/code.handler.spec.ts:244-261`(`it('C2 캐너리 — ...')`)
  - 상세: 두 테스트 모두 `beforeEach` 에서 매번 새로 생성되는 `service`/`handler`+`context` 인스턴스만 사용하고, `process.env`·모듈 전역 상태·파일시스템을 건드리지 않는다. 같은 파일 안의 `$env` 관련 기존 테스트들(예: `expression-resolver.service.spec.ts:425-487`)은 `process.env` 를 수정하지만 각각 `try/finally` 로 원복하는 기존 패턴을 유지하며, 이번 diff 는 그 패턴에 손대지 않았다. 신규 테스트가 다른 테스트의 실행 순서·공유 상태에 의존하거나 영향을 주는 지점은 없다.
  - 제안: 없음 — 부작용 관점에서 문제 없음, 참고용 기록.

- **[INFO]** `secret-resolver.service.ts` 변경은 주석 전용
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `resolve()` 메서드의 catch 블록 주석 (변경된 diff 라인 95~99 부근, 게이트 상 `92-105` 사이)
  - 상세: 추가된 5줄은 전부 `//` 주석이며, 로직·시그니처·throw 되는 에러 객체 형태 어느 것도 바뀌지 않았다. `preserve-caught-error` disable 대상·에러 메시지·`eslint-disable-next-line` 위치도 그대로다.
  - 제안: 없음.

- **[INFO]** plan 문서 갱신은 서술·체크박스 변경만
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` (체크박스 토글 및 완료 기록 추가 구간)
  - 상세: 코드/설정/CI 워크플로 파일을 건드리지 않는 순수 기록용 변경이라 실행 시점 부작용이 없다.
  - 제안: 없음.

## 요약

이번 diff 는 기존 `cause` 부착 정책(§6.3.1 C1/C2)을 검증하는 회귀(캐너리) 테스트 2건 추가, 그 정책을 설명하는 주석 보강 1건, 그리고 plan 문서의 진행상황 기록으로 구성된다. 두 신규 테스트는 각 `describe` 블록의 `beforeEach` 로 매 테스트마다 새로 생성되는 인스턴스만 사용하며 `process.env`, 파일시스템, 네트워크, 전역 변수, 기존 함수 시그니처/공개 인터페이스 중 어느 것도 변경하지 않는다. `secret-resolver.service.ts` 변경은 순수 주석이라 런타임 동작에 영향이 없고, plan 문서 변경은 코드가 아니다. 부작용 관점에서 우려할 변경사항이 없다.

## 위험도

NONE
