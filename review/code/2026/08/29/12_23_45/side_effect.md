# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 테스트 헬퍼(`captureThrown`/`captureRejected`)가 `expect()` 를 내부에서 직접 호출하는 패턴
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:32` (`expect(thrown).toBeInstanceOf(Error);`), `codebase/backend/src/nodes/data/code/code.handler.spec.ts:22` (동일 패턴)
  - 상세: 두 헬퍼 모두 `it()` 콜백 밖(모듈 스코프)에서 정의됐지만 `expect()` 를 직접 실행한다. 항상 `it()` 콜백 안에서 동기적으로 호출되므로 Jest 의 현재 테스트 컨텍스트에 정상 귀속되어 실질적인 부작용(다른 테스트로의 assertion 누수, 카운트 오염)은 없다. 헬퍼가 vacuity 방지 단언(reject/throw 하지 않으면 이후 단언이 조용히 전부 통과)을 스스로 품는 설계이며 주석에도 명시돼 있다.
  - 제안: 조치 불요. 향후 헬퍼를 `it()` 콜백 밖(예: `beforeAll`)에서 비동기로 분리 호출하는 형태로 리팩터링할 경우에만 재검토가 필요하다는 점만 기록해 둔다.

- **[INFO]** `secret-resolver.service.ts` 변경은 주석 추가뿐 — 기능·시그니처 무변경
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95` 부근(`resolve()` catch 블록 주석)
  - 상세: diff 전체가 `//` 주석 5줄 추가이며, `eslint-disable-next-line preserve-caught-error` 지시문·`throw new Error('Secret decryption failed')` 등 실제 동작 코드는 변경 이전과 동일하다(`captureThrown` 도입 전후 로직 대조로 확인). 시그니처·전역 상태·파일시스템·네트워크·환경변수 접근 경로에 변화 없음.
  - 제안: 조치 불요.

- **[INFO]** 이전 리뷰 라운드(`11_58_35`) 산출물 전체가 신규 커밋 대상 파일로 포함됨
  - 위치: `review/code/2026/08/29/11_58_35/*.md`, `_retry_state.json`, `meta.json` (파일 5~15)
  - 상세: 이는 코드 변경이 아니라 라운드 산출물(감사 기록) 커밋으로, 저장소 관례(`plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트에 기록된 2026-08-29 결정 — `review/**` 전체를 developer 커밋 대상으로 확정)와 일치한다. `_retry_state.json` 은 절대경로(`/Users/gehrig/...`)를 담고 있어 다른 머신에서는 무의미한 값이 되지만, 이는 실행 당시 스냅샷이라는 성격상 예상된 것이고 런타임에 재참조되는 상태 파일이 아니므로(과거 라운드의 정적 기록) 부작용으로 보지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 두 스펙 파일(`expression-resolver.service.spec.ts`, `code.handler.spec.ts`)의 순수 테스트 리팩터링(중복 vacuity-guard 로직을 `captureThrown`/`captureRejected` 헬퍼로 추출 + `cause` 의 enumerable own key 화이트리스트를 잠그는 `it.each` 캐너리 추가), `secret-resolver.service.ts` 의 주석 전용 변경, 그리고 `plan/in-progress/deps-peer-gating-and-eslint10.md` 문서 갱신, 마지막으로 이전 리뷰 라운드 산출물의 감사 기록 커밋으로 구성된다. 프로덕션 함수 시그니처·공개 API·전역 변수·환경 변수·네트워크 호출·이벤트/콜백 계약 중 어느 것도 변경되지 않았고, 테스트 헬퍼는 기존에 각 케이스에 중복돼 있던 assertion 을 그대로 옮긴 것뿐이라 테스트 간 격리에도 영향이 없다. 부작용 관점에서 지적할 결함은 없다.

## 위험도

NONE
