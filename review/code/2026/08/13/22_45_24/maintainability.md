# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `updateReturningRows` 의 `detail` 진단 인자가 신규 호출부 8곳 중 5곳(전부 `knowledge-base.service.ts`)에서 생략됐다 — 헬퍼가 이 인자를 되살린 이유(직전 리뷰 `20_36_35` WARNING 4: "`assertRowArray` 가 주던 호출부 문맥을 잃지 않기 위함")와 정면으로 어긋난다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345, 541, 572, 719, 740` (모두 `updateReturningRows(...)` 호출에 두 번째 인자 없음)
  - 상세: 같은 헬퍼를 쓰는 `auth-oauth.service.ts:146`·`execution-engine.service.ts:2947,8550` 는 전부 `` `admission UPDATE, execution ${executionId} …` ``처럼 실행 문맥을 실어 보내는데, `knowledge-base.service.ts` 5곳은 인자 없이 호출한다. 현재는 `Array.isArray` 실패 시에만 throw 하므로 당장 동작 버그는 아니지만, 헬퍼의 존재 이유로 명시된 "극단 상황에서 로그만으로 지점을 특정" 이라는 설계 목표가 실제로는 신규 호출부의 다수(8곳 중 5곳)에서 지켜지지 않는다. `id`/`workspaceId` 처럼 넘길 문맥은 해당 함수 스코프에 이미 있어(`reExtractAll`, `reEmbedAll` 등) 누락이 자료 부족 때문은 아니다.
  - 제안: 5개 호출부에도 `` `KB re-extract CAS, kb ${id}` `` 류의 `detail` 을 추가해 헬퍼 도입 취지를 실제로 관철하거나, 그럴 계획이 없다면 JSDoc 의 "종전 assertRowArray 가 주던 진단을 잃지 않기 위함" 서술을 "호출부 재량" 으로 완화해 문서와 실제 사용 패턴의 괴리를 없앤다.

- **[INFO]** 두 "자매 지점 전수" 구조적 회귀 가드 스펙(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)이 `SRC = join(__dirname, '..', '..')` 계산·정규식 기반 카운팅·`readFileSync` 루프를 거의 동일하게 각자 인라인으로 반복한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts` (`자매 지점 전수 — 가드 누락 회귀 가드` describe 블록, `SRC`/`CONSUMING_QUERY` 정의부) / `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`UPDATE/DELETE 결과를 직접 소비하는 지점이 다시 생기지 않는다` describe 블록, `SRC`/`CONSUMING` 정의부)
  - 상세: 두 파일 모두 "파일을 읽어 정규식으로 소비 지점을 센다" 는 동일한 정적 grep 패턴을 독립적으로 구현하고 있다(변수명만 `CONSUMING_QUERY` vs `CONSUMING` 으로 다르다). 의도적으로 대상(SELECT 자리 vs UPDATE/DELETE 자리)이 다르므로 완전한 통합은 과할 수 있지만, `readFileSync(join(SRC, rel), 'utf8')` + `(src.match(regex) ?? []).length` 조합만이라도 공유 테스트 유틸로 뽑으면 세 번째 유사 가드가 생길 때 보일러플레이트가 또 복제되는 것을 막을 수 있다.
  - 제안: 급하지 않음 — 세 번째 유사 구조 가드가 생기는 시점에 `test/utils/count-pattern-in-file.ts` 류로 추출을 고려.

- **[INFO]** 같은 종류의 "소비 지점 수 == 헬퍼 호출 수" 회귀 가드인데 두 스펙 파일의 결과 자료구조 형태가 다르다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:64-94` (`{rel, queries, guards}` 객체 배열 하나로 두 지표를 합쳐 `toEqual`) vs `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`it.each(EXPECTED)` 로 헬퍼 호출 수를 개별 검증하고, 별도의 `it('소비 지점 자체의 수가 늘면 알려준다', …)` 에서 원시 소비 지점 수를 `[3, 10, 0]` 배열로 따로 검증)
  - 상세: 기능은 동등하지만 표현 형태가 갈려 있어, 다음에 이 두 가드를 나란히 읽는 사람이 "같은 클래스의 가드인데 왜 구조가 다른가" 를 다시 판단해야 한다. `update-returning-rows.spec.ts` 자체 주석(37-40번째 줄, `EXPECTED` 정의 위 주석)이 "(파일, 소비 지점 수, 그중 헬퍼로 처리된 수)" 라고 3-tuple 을 예고하지만 실제 타입은 `Array<[string, number]>` (2-tuple) 이라 주석과 타입이 어긋난 것도 같은 갈래의 사소한 불일치다.
  - 제안: 필수는 아니나, `assert-row-array.spec.ts` 와 동일하게 `{rel, consuming, helperCalls}` 형태의 단일 객체 배열로 통일하면 두 가드가 "쌍" 이라는 사실이 코드 형태로도 드러난다. `EXPECTED` 주석의 "(파일, … 수, 그중 … 수)" 표현은 실제 2-tuple 에 맞게 정정.

- **[INFO]** `it.each` placeholder 변수명이 자매 스펙과 다르다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`%s 면 던진다` 블록, `(_l, v) =>`)
  - 상세: 같은 패턴을 쓰는 `assert-row-array.spec.ts:27` 은 `(_label, value) =>` 로 온전한 이름을 쓰는데, 신규 파일은 `_l`, `v` 로 축약했다. 기능에는 영향 없는 사소한 네이밍 컨벤션 흔들림이다.
  - 제안: `_label`, `value` 로 맞추면 두 스펙을 나란히 볼 때 패턴 인식이 더 쉬워진다.

## 요약

이번 변경은 이미 한 차례 리뷰(`20_36_35`)를 거쳐 CRITICAL 2건·WARNING 6건을 조치한 뒤의 후속 diff로, `updateReturningRows` 헬퍼 자체(JSDoc·타입·에러 메시지)는 짧고 단일 책임이며 근거가 충실히 문서화돼 있어 가독성이 높다. 회귀를 막는 구조적 가드(정규식 기반 소비-지점 카운팅) 역시 이미 존재하는 `assertRowArray` 패턴을 그대로 계승해 컨벤션 일관성을 지켰다. 다만 신규 헬퍼가 명시적으로 내세운 설계 목표(진단용 `detail` 보존)가 실제 호출부 다수에서 관철되지 않은 점(WARNING)과, 두 "자매 가드" 스펙 파일 사이의 사소한 구조·네이밍 불일치(INFO 3건)가 눈에 띈다. 기능적 결함은 없으며 전반적으로 유지보수성 위험도는 낮다.

## 위험도

LOW
