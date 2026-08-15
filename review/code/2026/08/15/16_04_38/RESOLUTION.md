# RESOLUTION — `16_04_38`

ai-review **CRITICAL 0 / WARNING 4**. 전부 조치 + INFO 1건.

## W4 — 헬퍼를 만들어 놓고 내 새 테스트에서 안 썼다 (maintainability)

**조치 완료. 트래커에 이미 등재된 바로 그 패턴을 반복했다.**

`installStalledTx` 를 추출한 이유가 *"셋업 중복이 조용한 stale 을 만든다"* 였는데, 정작
**그 헬퍼가 검증하려는 명제를 가장 직접 단언하는 신규 첫 테스트**가 같은 mock 셋업을
26줄 그대로 복제하고 있었다. 헬퍼 호출로 교체.

> 직전 PR(`15_23_10` W2)에서 *"신규 테스트가 공유 `arrange()` 를 우회"* 로 지적받아
> **트래커에 등재까지 해 놓고** 같은 형태를 다음 PR 에서 만들었다.

## W1 — cascade WHERE 가드를 아무도 안 봤다 (testing)

**조치 완료. 리뷰어가 뮤테이션으로 생존을 실측했고, 나도 재현했다.**

`nodeQb.set` 만 단언해서 **WHERE 값을 바꿔도 GREEN** 이었다. `execution_id` 범위를 잃으면
다른 실행의 노드를 마감하고, `status` 가드를 잃으면 이미 끝난 노드를 덮어쓴다.

`where`/`andWhere` 단언 추가. **판별력**: `status = :running` → `:waiting` 뮤턴트에서 **RED**.

## W2·W3 — 문서화 선례 미준수 (documentation)

| # | 항목 | 조치 |
|---|---|---|
| 2 | CHANGELOG 누락 | **추가** — 이 파일은 "짝 전이 원자성" 계열 수정을 매번 기록해 왔다. 수신자 영향 없음(payload·상태전이·no-op 조건 불변)까지 명시 |
| 3 | JSDoc 미갱신 | **추가** — 자매 `cancelParkedExecution` 은 JSDoc 에 남겼는데 이 함수는 인라인 주석에만 있었다. 같은 형식으로 문단 추가 |

## INFO 처분

| # | 처분 |
|---|---|
| 3 ("30줄 아래" 표현이 실측 48줄) | **조치** — 줄 수 의존 표현을 제거했다. 코드가 움직이면 매번 틀리는 서술이다 |
| 4 (mock 은 롤백을 검증 못 함) | 무조치 — **테스트 주석이 이 한계를 스스로 명시**한다. 실 DB 롤백 검증은 트래커의 실 DB e2e 트랙과 같은 성격 |
| 5 (함수 레벨 try/catch 비대칭) | 무조치 — 유일 호출부(`execution-run.processor.ts` `onFailed`)가 `.catch()` 로 흡수해 **최종 동작 동등**. 같은 세션 `--impl-prep` 도 "조치 불요(선택)" 판정 |
| 1·2·6·7 | positive finding / W4 로 흡수 |

## 검증

- 백엔드 **425 suites / 8730 passed** · lint `--max-warnings 0` **0 errors** · 타입 **199**
- 판별력: 트랜잭션 제거 **3/3 RED** · `affected=0` 조기 return 제거 **RED** ·
  cascade WHERE 가드 변조 **RED**
- TEST WORKFLOW 4스테이지 PASS (lint / unit / build / **e2e 276**)
