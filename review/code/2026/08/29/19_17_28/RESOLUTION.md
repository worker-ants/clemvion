# RESOLUTION — 19_17_28

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING#1 | 코드 | `4dbc6ee39` | `it.each` 4개 분기 공유 바디에 `not.toContain(CAUSE_MARKER)` 를 추가 — 4개 전부 균일 적용 |
| INFO#1    | 코드 | `4dbc6ee39` | `readUnionMembers` 를 scratch 빈 디렉터리로 직접 호출해 ENOENT throw 를 단언(주석과 단언 범위 일치) |
| INFO#2    | 코드 | `4dbc6ee39` | `withPatchedSpec` 변형으로 `readCatalogComponents` 두 번째 throw(패턴 불일치) 케이스 추가 |
| INFO#3    | (제외) | — | plan 문서 사안 — main 이 직접 처리 (지시사항에 의해 건드리지 않음) |
| INFO#4    | (제외) | — | plan 문서 사안 — main 이 직접 처리 (지시사항에 의해 건드리지 않음) |
| INFO#5    | 코드 | `4dbc6ee39` | 닫힌-키-집합 배열 리터럴 2회 반복 → `CLOSED_ENVELOPE_KEYS` 상수로 추출 |
| INFO#6    | won't-do | — | 리뷰어 자신이 "규모가 작아 필수는 아님" 으로 낮춤 — `silenceLogger` 헬퍼 추출 보류 |
| INFO#7    | (제외) | — | plan 문서 사안 — main 이 직접 처리 (지시사항에 의해 건드리지 않음) |
| INFO#8    | won't-do | — | 리뷰어 자신이 "가드가 이미 문서화, 결함 아님 · 현재는 조치 불요" 로 낮춤 |
| INFO#9    | won't-do | — | 리뷰어 자신이 "현재는 오탐 없음, AST 기반이라 안전" 으로 낮춤 |
| INFO#10   | 코드 | `4dbc6ee39` | "이 넷"/"이 셋" 지시대명사를 "위 4개 fixture"/"아래 CLOSED_ENVELOPE_KEYS 3개 키" 로 명시 |

Critical: 0건 (해당 없음).

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260829-193031.log`)
- unit  : 통과 — backend 435 suites / 9058 passed(+1 skipped, 무관) 전수 포함, 대상 스펙 2개 재실행 시 29/29 통과 (`_test_logs/unit-20260829-193124.log`)
- build : 통과 (`_test_logs/build-20260829-193345.log`)
- e2e   : 통과 (285/285) (`_test_logs/e2e-20260829-193619.log`)

## 뮤테이션 재검증 (WARNING#1)

대상: `codebase/backend/src/common/filters/http-exception.filter.ts` 의 `isUniqueViolation`
분기(409 응답 `message` 값에 `exception.cause.message` 를 조건부로 이어붙임 — 키는 늘리지
않고 값만 오염시키는 형태, 리뷰어가 실측에 쓴 것과 동일한 뮤턴트).

```ts
message =
  'Resource already exists or has been modified concurrently.' +
  (exception instanceof Error && exception.cause instanceof Error
    ? exception.cause.message
    : '');
```

- **예측**: fix 후에는 `http-exception.filter.spec.ts` 의 `cause` 비노출 `it.each` —
  QueryFailedError(23505) 분기 — 가 RED 로 떨어져야 한다 (마커 부재 단언이 새로 걸렸으므로).
- **실측**: `npx jest src/common/filters/http-exception.filter.spec.ts` →
  `Tests: 1 failed, 18 passed, 19 total`. 실패 위치는 정확히
  `봉투 error 의 키는 닫힌 집합이다 — QueryFailedError(23505) (새 필드가 생기면 여기서 멈춘다)`
  이며, 실패 메시지는 `Received string` 에 `SENSITIVE-CAUSE-DETAIL-a1b2c3` 를 포함한 message
  값을 그대로 보여준다. 예측과 일치 — RED 확인.
- **원복**: 뮤턴트 적용 직전 `cp codebase/backend/src/common/filters/http-exception.filter.ts
  <scratch>/http-exception.filter.ts.bak` 로 백업 후, 검증 완료 뒤 같은 `cp` 로 원복
  (`git checkout`/`git restore` 미사용). 원복 후 `git diff --stat` 로 해당 파일 diff 0 확인.

## 보류·후속 항목

- INFO#3: `backend-lint-gate-broken-on-main.md` / `deps-peer-gating-and-eslint10.md` 두 트래커
  동시 갱신 — plan 문서 사안, main 이 직접 처리 (지시사항에 의해 본 sub-agent 는 미착수)
- INFO#4: `deps-peer-gating-and-eslint10.md` `worktree:` 필드와 17행 서술 불일치 재확인 —
  plan 문서 사안, main 이 직접 처리 (지시사항에 의해 본 sub-agent 는 미착수)
- INFO#7: 두 트래커의 중첩 blockquote 누적 55KB급 탐색성 저하 — plan 문서 사안, main 이
  직접 처리 (지시사항에 의해 본 sub-agent 는 미착수)
- INFO#6: `Logger.prototype` spy 무음화 2줄 패턴이 4회 반복 — 리뷰어 스스로 "규모가 작아
  필수는 아님" 으로 낮춤. won't-do.
- INFO#8: `findWiredComponents` 의 상수 추적이 cross-file 참조를 못 따라감 — 가드 자신이
  이미 문서화한 fail-closed 설계이고 리뷰어도 "결함 아님·조치 불요" 로 명시. won't-do.
- INFO#9: `listProductionSources` 가 `__tests__/` 를 스캔 대상에서 제외하지 않음 — 현재
  오탐 없음(AST 기반)이고 리뷰어도 "현재는 오탐 없음" 으로 명시. won't-do — 동일 이름
  헬퍼가 그 디렉터리에 추가되면 재검토.

## Idempotency 메모

`_resolution_state.json` 에 처리 완료 항목 전체를 기록. 이 파일과 `git log` 의
`SUMMARY#` 인용으로 재진입 시 동일 결과를 재현할 수 있다.
