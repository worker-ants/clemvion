# 유지보수성(Maintainability) 리뷰 결과

## 사전 확인

이 세션 diff(`origin/main...HEAD`)는 `20_36_35`→`22_45_24`→`23_07_11`→`23_27_48`→`23_46_00`
5개 라운드가 이미 여러 번 검토한 누적 결과(핵심 코드 9개 backend 파일 + plan 3개, 828줄)이며,
마지막 커밋(`e214a654a`)은 직전 라운드(`23_46_00`)의 WARNING 4건을 조치한 것이다. 이전 라운드들이
지적·유예한 항목이 현재 소스에 실제로 어떤 상태인지 `Read`/`Grep`으로 직접 대조했다.

- `it.each` placeholder 변수명 불일치(`update-returning-rows.spec.ts` `(_l, v)` vs
  `assert-row-array.spec.ts` `(_label, value)`, `22_45_24`·`23_07_11`·`23_46_00` 세 라운드
  연속 INFO) — **이번 커밋(`e214a654a`)에서 해소됨**. 현재
  `codebase/backend/src/common/utils/update-returning-rows.spec.ts:25`가
  `(_label, value) =>` 로 자매 스펙과 일치한다(W4 조치의 부수 효과).
- `execution-engine.service.ts`/`knowledge-base.service.ts`의 `unknown` 전환 누락(`23_07_11`
  WARNING 1) — **해소 유지**: `knowledge-base.service.ts:533`(embedding 재큐)도
  `const rows: unknown = await this.dataSource.query(...)`로 통일돼 있다.
- `updateReturningRows(...)` 호출부 `detail` 인자 생략(`22_45_24`→`23_07_11` 필수화) — **해소
  유지**: 8개 호출부(`auth-oauth` 1, `execution-engine` 2, `knowledge-base` 5) 전부 문맥
  문자열을 채우고 있다.
- 구조적 회귀 가드 두 벌(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`)의
  `SRC`/정규식-카운팅 보일러플레이트 중복(`22_45_24`·`23_07_11`·`23_46_00` INFO, "세 번째
  유사 가드가 생기면 추출 고려"로 유예) — **상태 변화 없음**, 여전히 유효한 유예.

## 발견사항

- **[INFO]** `knowledge-base.service.ts` 안에서 `updateReturningRows(...)` 반환값을 담는
  변수명이 지점마다 다르게 지어져 있다(`rowsOut` 2회, `resetRows` 1회).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:544`
    (embedding 재큐 `rowsOut`), `:578`(graph 재큐 `rowsOut`), `:751`(reembed reset
    `resetRows`)
  - 상세: 세 지점 모두 동일 패턴(`UPDATE ... RETURNING` → `updateReturningRows` 언랩 →
    `.map(r => r.id)`/`.length` 재사용)인데 두 곳은 `rowsOut`, 한 곳은 `resetRows`로
    이름이 갈린다. 기능 영향은 없고, 이미 `22_45_24`/`23_07_11`/`23_46_00` 라운드에서
    INFO로 지적·유예된 항목이 이번 라운드에도 상태 변화 없이 그대로 남아 있다.
  - 제안: 급하지 않음. 이 파일을 다음에 손댈 때 `resetRows` → `rowsOut`로 맞추면 세 지점이
    "같은 언랩 패턴" 임이 변수명만으로도 드러난다.

- **[INFO]** 두 "자매 지점 전수" 구조적 회귀 가드 스펙(`assert-row-array.spec.ts`,
  `update-returning-rows.spec.ts`)이 `SRC = join(__dirname, '..', '..')` 계산과
  `readFileSync` + 정규식 카운팅 보일러플레이트를 여전히 각자 인라인으로 반복한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:54`(`SRC` 정의) /
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts:50`(`SRC` 정의)
  - 상세: 3개 라운드(`22_45_24`/`23_07_11`/`23_46_00`)에서 이미 "대상(SELECT 자리 vs
    UPDATE/DELETE 자리)이 달라 완전 통합은 과할 수 있다, 세 번째 유사 가드가 생기면 추출을
    고려"로 명시적으로 유예된 항목이며, 이번 라운드에도 상태 변화가 없다. 재확인 목적으로만
    기재한다.
  - 제안: 조치 불요(기존 유예 결정 유지).

- **[INFO]** `auth-oauth.service.ts`의 `updateReturningRows` 호출 스타일이 다른 7개 호출부와
  다르다(인라인 `await` 표현식을 인자 자리에 직접 전달 vs 나머지는 "변수로 받은 뒤 넘기기").
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-152`
  - 상세: 기능은 동일하고, 이 비대칭 자체가 `update-returning-rows.spec.ts`의 구조적 가드
    주석("auth-oauth 이 0곳인 이유")에 의도적으로 기록돼 있다. `23_27_48`/`23_46_00`
    라운드에서 이미 지적·수용된 항목으로, 새로운 결함이 아니다.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 신규 발견 없음.

## 요약

이번 diff는 TypeORM이 `UPDATE`/`DELETE … RETURNING`에서만 `[rows, rowCount]` 튜플을 돌려주는
실측 결함을 공유 헬퍼(`updateReturningRows`)로 봉합하고, 8개 소비 지점(execution-engine 2,
knowledge-base 5, auth-oauth 1)을 교체한 5라운드 누적 수정이다. 직전 4개 라운드
(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`/`23_46_00`)에서 반복 지적됐던 실질적 WARNING —
모순 주석, `unknown` 전환 누락, `detail` 인자 생략, 느슨한 테스트 단언 — 은 이번 최종 상태
기준으로 전부 소스에서 해소돼 있음을 직접 대조 확인했다. 특히 3개 라운드 연속 지적된 `it.each`
placeholder 이름 불일치도 이번 마지막 커밋에서 우연히(W4 강화 작업의 부수 효과로) 해소됐다.
헬퍼 자체(`update-returning-rows.ts`)는 12줄의 단일 책임 함수이고 JSDoc이 실측 근거·기존 세
관용구와의 관계·`detail` 필수화 이유를 명확히 설명해 가독성이 높으며, 함수 길이·중첩 깊이·
순환 복잡도 어느 축으로도 문제가 없다. 남은 항목은 전부 2~3라운드째 INFO로 보고되고 "조치
불요"로 명시 유예된 저비용 스타일 흔들림(`knowledge-base.service.ts` 변수명 `rowsOut`/
`resetRows` 비일관, 두 구조적 가드 스펙의 보일러플레이트 중복, auth-oauth 호출 스타일 비대칭)
뿐이며 매직 넘버·중복 로직·과도한 중첩 등 새로운 유지보수성 부채는 발견되지 않았다.
CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
