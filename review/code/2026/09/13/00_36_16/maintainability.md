# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 커서 인코딩 보일러플레이트가 테스트 코드에 5회 반복되고, 공용 헬퍼가 없다
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:643-646`, `:666-669`, `:715-718` (3곳) 및 `codebase/backend/test/background-monitoring.e2e-spec.ts:291-294`, `:307-313` (2곳)
  - 상세: 이번 diff 가 추가한 5개 테스트 케이스 모두 `Buffer.from(JSON.stringify({ s: ..., i: ... }), 'utf8').toString('base64')` 형태의 커서 인코딩 블록을 각자 인라인으로 반복한다. 같은 파일(`background-runs.service.spec.ts`) 안에 이미 3회 등장하고, `grep -n "Buffer.from" codebase/backend/test/background-monitoring.e2e-spec.ts` 로 확인한 결과 e2e 파일에도 2회 더 있다. 두 파일 모두 기존에 이 인코딩을 감싸는 헬퍼가 없다(`grep -n "encodeCursor\|function make.*Cursor" background-runs.service.spec.ts` 0건). 프로덕션 쪽 `background-runs.service.ts` 에는 이미 `encodeCursor(payload)` 메서드가 있는데, 테스트 쪽은 그것을 재사용하지 못하고(private) 매번 손으로 재구현하고 있다. 커서 인코딩 형식이 바뀌면 이 diff 만으로도 5곳을 동시에 고쳐야 한다.
  - 제안: `{s, i}` → base64 문자열을 만드는 작은 테스트 헬퍼(예: `makeCursor(s, i)`)를 두 스펙 파일(또는 공용 테스트 유틸)에 하나씩 두고 5곳을 교체. 새 로직이 아니라 순수 보일러플레이트 추출이라 위험도 낮음.

- **[WARNING]** `isUuidShaped` JSDoc 이 "기술 계약"과 "리뷰 라운드 감사 로그"를 한 자리에 누적시키고 있다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:16-58` (`isUuidShaped` 함수 JSDoc)
  - 상세: 이 함수는 실제 코드가 2줄(`UUID_SHAPE_PATTERN` 정의 + `test()` 호출, 라인 59-64)인데 JSDoc 은 43줄이다. 이번 diff 는 3라운드 연속 지적된 "근거 주석 3중 복제"를 해소하려고 호출부(`login-history.service.ts`, `background-runs.service.ts`)의 산문을 이 JSDoc 한 곳으로 모았는데, 그 결과 JSDoc 안에 (a) 함수가 실제로 보장하는 것(canonical 8-4-4-4-12 hex 판정, `isValidUuid` 와의 차이) 같은 시간이 지나도 안 변하는 "기술 계약"과, (b) `> **앵커 정정 (2026-08-09, #1112 실측)**`, `> **캐너리를 닫힌 목록으로 적지 않는다**(...review/code/2026/09/13/00_13_51...)`, `> **호출부는 이 문단을 복제하지 말고 참조하라**(...23_19_03 INFO#1 · 23_40_57 W4 · 00_13_51 W2...)` 같이 날짜·리뷰 세션 폴더명·라운드 번호를 인용하는 "감사 로그성 산문"이 섞여 있다. 이런 히스토리 항목은 이미 `plan/in-progress/keyset-cursor-uuid-validation.md` 라는 전용 문서가 있는데도(같은 diff 에 포함) JSDoc 에도 중복 축적된다. 다음 사람이 "이 함수가 무엇을 보장하는가"를 알려고 열면 리뷰 아카이브 인용을 먼저 헤쳐야 한다. 또한 이 패턴 자체가 "앞으로 라운드가 늘 때마다 문단이 하나씩 더 붙는" 구조라, 반복될수록 커진다.
  - 제안: 함수 계약(무엇을 받아들이는가/왜/무엇을 막는가)만 JSDoc 에 남기고, 날짜·리뷰 세션·라운드 번호가 붙는 "정정 이력"·"복제 지적 이력"은 `plan/in-progress/keyset-cursor-uuid-validation.md`(이미 존재) 쪽으로 옮기고 JSDoc 에서는 그 문서로 링크만 남기는 편이 계약과 이력을 분리해 가독성을 지킨다. 단, 이 저장소는 코드 주석에 리뷰 이력을 남기는 것이 이미 전반적 관행이므로(diff 전체에서 반복 관찰됨) 이 지적은 "위반"이 아니라 "이번 통합으로 한 파일에 누적된 양이 임계치를 넘었다"는 신호로 받아들이면 됨.

- **[INFO]** 새 테스트 두 파일 사이에 상수 호이스팅 스타일이 다르다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:121-122` (`describe` 블록 최상단에 `const CURSOR_UUID = '3fa85f64-...'` 호이스팅) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:637`, `:692` (각 `it` 안에서 `'not-a-uuid'` 리터럴 인라인 반복, `NIL_UUID` 는 세 번째 테스트에서만 지역 선언)
  - 상세: 같은 diff 안에서 같은 목적(회귀 캐너리용 커서 id 리터럴)에 두 가지 스코프 관례가 공존한다. 사소하지만 다음 사람이 어느 쪽을 따라야 할지 판단 비용이 생긴다.
  - 제안: 강제할 정도는 아니나, 후속 수정 시 `background-runs.service.spec.ts` 도 describe-scope 상수로 통일하면 위 첫 번째 항목(헬퍼 추출)과 한 번에 정리 가능.

- **[INFO]** `decodeCursor` 가 두 서비스에 손으로 각각 구현돼 중복이지만, 이미 트래커에 등재되어 있다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:45-63`(모듈 함수 `decodeCursor`) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:149-188`(private 메서드 `decodeCursor`)
  - 상세: 두 디코더는 인코딩 형식(파이프 구분 vs base64 JSON)과 실패 계약(무시 vs 400)이 달라 단순 추출로 합칠 수 없다는 점을 diff 가 스스로 인지하고 있고, `plan/in-progress/spec-draft-nullable-notation-followups.md:3186-3189`("두 keyset 커서 디코더가 손으로 각각 구현돼 있다")에 이미 등재돼 있다. 새로 지적할 결함은 아니고, "숨은 중복이 아니라 문서화된 유예"임을 확인.
  - 제안: 조치 불요 — 계약 통일 결정이 선행되어야 하는 항목이라 이번 diff 범위 밖.

## 요약

핵심 프로덕션 변경(`isUuidShaped` 를 두 `decodeCursor` 입구에 추가)은 함수 길이·중첩·네이밍·복잡도 모두 문제 없이 작고 명확하다. 변경 자체보다 그 주변의 "설명 밀도"가 이번 리뷰의 초점인데, 3라운드에 걸쳐 지적된 근거 주석 중복을 `uuid.ts` 한 곳으로 모은 처리는 방향은 맞지만 그 결과 JSDoc 이 기술 계약과 리뷰 감사 로그를 함께 짊어지게 됐고, 새로 추가된 테스트 5곳은 커서 인코딩 보일러플레이트를 헬퍼 없이 반복한다. 둘 다 프로덕션 동작에는 영향이 없는 테스트/문서 수준의 부채이며, 나머지(네이밍·일관성·매직 넘버)는 양호하다.

## 위험도

LOW
