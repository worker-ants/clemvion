# 유지보수성(Maintainability) 리뷰 결과

## 사전 확인

이 세션의 diff(`origin/main...HEAD`)는 `20_36_35`/`22_45_24`/`23_07_11`/`23_27_48` 4 라운드의
누적 결과다. 프롬프트에 첨부된 diff 상 지적 가능해 보이는 항목들이 실제로는 이미 후속 커밋으로
고쳐져 있는지 현재 파일 상태를 직접 `Read`/`Grep` 으로 대조했다.

- `execution-engine.service.ts` — `admitExecutionOrDefer` 안의 "제네릭을 안 쓴다"(신규 주석,
  약 2916행)와 "위 제네릭은…"(구 주석) 모순 지적(`23_27_48` WARNING)은 **해소됨** — `위 제네릭`
  문구가 소스에 더 이상 없다.
- `knowledge-base.service.ts:533` — embedding 재큐 분기가 옛 `query<{id:string}[]>()` 제네릭을
  유지해 그 옆 graph 분기(`unknown`)와 어긋난다는 지적(`23_07_11` WARNING 1)은 **해소됨** — 현재
  `const rows: unknown = await this.dataSource.query(...)` 로 통일돼 있다.
- `updateReturningRows(...)` 호출부의 `detail` 인자 생략(`22_45_24` WARNING 3 → `23_07_11`
  WARNING 4 로 필수화) — 현재 8개 호출부(`auth-oauth` 1, `execution-engine` 2, `knowledge-base`
  5) 전부 문맥 문자열을 채우고 있다. **해소됨**.

새로 조사해 남은 항목은 전부 이전 라운드에서 이미 INFO 로 보고되고 "조치 불요"로 유예된 사소한
스타일 흔들림뿐이며, 이번 라운드에서도 다시 확인해 여전히 그대로다(재발이 아니라 원래 유예
결정이 유지되고 있는 것).

## 발견사항

- **[INFO]** `it.each` placeholder 변수명이 자매 스펙과 여전히 다르다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`%s 면 던진다`
    블록, `(_l, v) =>`) vs `codebase/backend/src/common/utils/assert-row-array.spec.ts`
    (`%s 면 던지고 호출부 문맥을 메시지에 싣는다` 블록, `(_label, value) =>`)
  - 상세: 두 파일 모두 `it.each([...])('%s ...', (label, value) => ...)` 형태의 동일 패턴인데
    변수명 축약 정도만 다르다. 기능 영향 없음. 이미 `22_45_24`·`23_07_11` 두 라운드에서 지적되고
    "저비용·우선순위 낮음"으로 유예된 항목으로, 이번 라운드에도 그대로 남아 있음을 재확인만 한다.
  - 제안: 조치 불요. 다음에 이 파일을 손댈 일이 생기면 `_label`, `value` 로 맞추는 정도.

- **[INFO]** "자매 지점 전수" 구조적 회귀 가드 두 벌(`assert-row-array.spec.ts`,
  `update-returning-rows.spec.ts`)이 `SRC = join(__dirname, '..', '..')` 계산과
  `readFileSync` + 정규식 카운팅 보일러플레이트를 각자 인라인으로 반복한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:54`(`SRC` 정의) /
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts:47`(`SRC` 정의)
  - 상세: 대상(SELECT 자리 vs UPDATE/DELETE 자리)이 달라 완전 통합은 과할 수 있다는 판단이
    `22_45_24`/`23_07_11` 두 라운드에서 이미 내려졌고 "세 번째 유사 가드가 생기면 추출을 고려"로
    유예됐다. 이번에도 상태 변화 없음.
  - 제안: 조치 불요(기존 유예 결정 유지).

- **[INFO]** `auth-oauth.service.ts` 의 `updateReturningRows` 호출 스타일이 다른 7개 호출부와
  다르다(인라인 `await` 표현식을 인자 자리에 직접 전달 vs 나머지는 "변수로 받은 뒤 넘기기").
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-152`
  - 상세: 기능은 동일하고, 이 비대칭 자체가 `update-returning-rows.spec.ts` 의 구조적 가드
    주석(“auth-oauth 이 0곳인 이유”)에 의도적으로 기록돼 있다. `23_27_48` 라운드에서 이미
    지적·수용된 항목으로, 새로운 결함이 아니다.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 신규 발견 없음.

## 요약

이번 라운드까지 누적된 diff 는 TypeORM 이 `UPDATE`/`DELETE … RETURNING` 에서만 `[rows,
rowCount]` 튜플을 돌려주는 실측 결함을 공유 헬퍼(`updateReturningRows`)로 봉합하고, 8개 소비
지점(execution-engine 2, knowledge-base 5, auth-oauth 1)을 교체한 다중 라운드 수정이다. 이전
네 라운드(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`)에서 나온 WARNING — 모순 주석,
`unknown` 전환 누락, `detail` 인자 생략 — 은 이번 확인 시점 기준 소스에서 모두 해소돼 있음을
직접 대조했다. 헬퍼 자체는 짧고 단일 책임이며 JSDoc 이 실측 근거·기존 3개 관용구와의 관계·
`detail` 필수화 이유를 명확히 설명해 가독성이 높다. 남은 항목은 이미 2~3라운드째 INFO 로
보고되고 "조치 불요"로 명시 유예된 사소한 스타일 흔들림(`it.each` placeholder 이름,
구조적 가드 보일러플레이트 중복, auth-oauth 호출 스타일 비대칭)뿐이며 전부 저비용·저위험이다.
CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
