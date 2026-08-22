# 유지보수성(Maintainability) Review

## 리뷰 범위 메모

이번 changeset(22 파일)의 실질 코드 변경은 `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 1개뿐이다(프로덕션 `sanitize-error-message.ts` 는 미변경 — `Read` 로 직접 확인, `deepRedactCore`/`deepRedactObject` 로직은 diff 밖). 나머지는 두 부류다.

- `plan/complete/*.md`(2개, 신규) / `plan/in-progress/*.md`(2개, 삭제 — 실질은 rename): plan lifecycle 이동 문서.
- `review/code/2026/08/22/16_07_45/**`(11개) · `review/consistency/2026/08/22/15_35_56/**`(8개): 직전 라운드의 리뷰/일관성 검토 산출물이 커밋된 것. 이 파일들은 자동 생성된 프로세스 증적이며 "가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도" 같은 코드 유지보수성 척도의 대상이 아니라고 판단해 본문 검토에서 제외했다(전문 확인 완료, 신규 이슈 없음).

`sanitize-error-message.spec.ts` 의 신규 `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)` 블록(게이트 274~383)은 실제 소스(`Read` 로 전체 대조, 게이트 번호가 소스 라인 번호와 정확히 일치함을 확인)를 직접 열어 검토했다.

## 발견사항

- **[INFO]** `nestObj`/`nestArr`/`nestMixed` 세 헬퍼가 구조적으로 거의 동일한 for-루프를 반복한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:276`~`292`
  - 상세: 세 함수 모두 `let v = leaf; for (...) v = <wrap>(v); return v;` 형태이고 `<wrap>` 표현식만 다르다(`{ n: v }` / `[v]` / `i % 2 === 0 ? { n: v } : [v]`, 세 번째는 사실상 앞 둘의 합성). `nestWith(depth, leaf, wrap)` 같은 공통 헬퍼로 더 줄일 수 있는 순수 중복이지만, 각 함수가 3줄로 짧고 JSDoc(각 275/281/287행)으로 "왜 세 가지 보폭을 따로 확인하는지" 의도가 명확해 현재 형태의 가독성이 나쁘지 않다.
  - 제안: 그대로 두어도 무방. 넷째 분기가 추가되면 그때 공통 헬퍼로 추출.
  - 참고: 이 항목은 직전 라운드(`review/code/2026/08/22/16_07_45/maintainability.md` #1)에서 이미 지적됐고, 같은 라운드 `RESOLUTION.md`(`maintainability #5`)에서 정확히 이 사유로 "반영 안 함(다음 분기까지 defer)" 처분됐다. 코드가 그 이후 변경되지 않았으므로 재확인 결과도 동일하다 — 새 조치 요구 아님.

- **[INFO]** 스택 오버플로 회귀 테스트의 깊이 값(`5000`)이 명명된 상수가 아니라 리터럴
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:379` (`nestObj(5000, 'Bearer sk-DEEP-END')`)
  - 상세: 바로 위 JSDoc(367~376행)이 실측 근거(#1188: `JSON.parse` 는 depth 100,000 통과, 재귀는 5,000 에서 `RangeError`)를 상세히 설명해 매직넘버치고 이례적으로 잘 문서화돼 있다. 이 파일 안에서 재사용되는 값도 아니다.
  - 제안: 재사용처가 생기기 전까지는 현재 형태(주석 + 리터럴) 유지로 충분.
  - 참고: 직전 라운드 `maintainability.md` #2 / `RESOLUTION.md` `maintainability #6` 과 동일 결론("재사용처 0" 근거로 반영 안 함).

- **[INFO]** 경계 쌍(상한 깊이 vs 상한-1 깊이) 검증의 테스트 입자성이 object 분기와 array 분기에서 다르다
  - 위치: object 분기는 `:301`·`:307`(각각 독립 `it`) / array 분기는 `:336`~`:343`(`it` 1개 안에 `expect` 2개)
  - 상세: array 분기에서 첫 `expect`(상한 깊이 케이스)가 실패하면 두 번째(`상한-1`)는 실행되지 않고 리포트에는 실패 1건으로만 보여, 어느 쪽이 깨졌는지 즉시 구분되지 않는다. 기능적 결함은 아니고 순수 리포트 가독성·일관성 문제다.
  - 제안: (선택) array 분기도 object 분기와 동일하게 `it` 2개로 분리.
  - 참고: 직전 라운드 `maintainability.md` #3 과 동일, `RESOLUTION.md` 에서 "(선택) 표기, 스위트 실행 0.2s 라 비용 근거 없음"으로 처분됨.

새로 도입된 이슈는 발견되지 않았다 — 이번 라운드의 diff 증분(plan 파일 이동 4건 + 직전 리뷰/일관성 산출물 19건)은 전부 소스 코드 변경이 아니다.

## 요약

이번 changeset 의 실질 코드 변경은 `sanitize-error-message.spec.ts` 한 파일이며, 프로덕션 로직은 손대지 않은 순수 테스트 추가다. 신규 경계 테스트 스위트는 `MAX_REDACT_DEPTH` 를 리터럴이 아니라 import 로 참조해 SoT 변경에 자동 추종하고, 각 `it` 제목에 `[경계]`/`[회귀]` 태그와 "무엇을 왜/어떤 뮤테이션에 RED 인지"를 명시한 JSDoc 을 붙여 가독성·의도 전달이 이례적으로 높다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고 기존 파일·프런트 동형 테스트(`masked-markers.test.ts`)와 네이밍·태그 컨벤션이 일관된다. 발견된 3건(헬퍼 3종 경미한 구조적 중복·매직넘버 `5000`·object/array 분기 간 테스트 입자성 불일치)은 전부 INFO 수준이며, 직전 리뷰 라운드(`16_07_45`)에서 이미 동일하게 지적되어 `RESOLUTION.md` 에 "지금은 반영 안 함"으로 명시 처분된 항목과 정확히 일치한다 — 코드가 그 이후 바뀌지 않았으므로 재확인 결과도 동일하고 새로운 조치가 필요하지 않다. plan 문서 이동·이전 리뷰/일관성 산출물 커밋 등 나머지 diff 는 코드가 아니라 프로세스 증적이라 유지보수성 척도의 대상이 아니다.

## 위험도

NONE
