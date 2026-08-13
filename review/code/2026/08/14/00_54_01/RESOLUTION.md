# RESOLUTION — `00_54_01` (+ consistency `00_54_07`)

ai-review **CRITICAL 0 / WARNING 2** (forced 7명 전원). consistency **BLOCK: NO**.
WARNING 2건 + consistency WARNING 1건 + INFO 2건 전부 조치. 커밋 `f5ab3040c`.

## 이번 라운드의 성격

**두 WARNING 이 모두 "한쪽만 고쳤다" 였고, 그게 이 PR 이 진단한 바로 그 패턴이다.**
직전 라운드에서 CRITICAL(`rememberMe`)을 같은 이유로 맞았는데 — 자매 파일을 열어 놓고
튜플만 보고 컬럼명을 놓쳤다 — 그걸 고치는 커밋에서 또 두 번 했다.

## W1 (testing) — 자매 가드에 하드닝 미적용

**조치 완료.** `update-returning-rows.spec.ts` 카운터에 주석 스트리핑을 넣으면서
같은 모양의 `assert-row-array.spec.ts:72` 는 그대로 뒀다.

지적의 핵심은 "지금 GREEN 이냐" 가 아니다 — 대상 파일에 `assertRowArray(` 를 적은
주석이 없어 현재는 결과가 같다. 그러나 **주석 하나가 호출 누락을 가리는** 결함 클래스가
그 카운터에 열려 있었고, 그 클래스는 이 PR 자신이 실측으로 증명한 것이다.

`__testing__/source-scan.ts` 로 계산을 모았다. 세 번째 가드가 생겨도 한 곳만 고치면 된다.
헬퍼의 존재 이유(주석을 안 센다)는 그 옆 spec 에서 직접 단언한다 — 안 그러면 스트리핑이
사라져도 두 가드가 동시에 조용히 약해진다.

`tsconfig.build.json` 에 `**/__testing__/**` 제외를 추가하고 **빌드해서 확인했다**:

| | 결과 |
|---|---|
| `dist` 내 `__testing__` | 없음 ✓ |
| 대조군 `dist/common/utils/update-returning-rows.js` | 있음 (빌드가 실제로 돌았다) |

대조군이 없었으면 "dist 가 비어서 통과" 와 구분되지 않는다.

## W2 (documentation) — CHANGELOG 두 섹션 중 한쪽만 정정

**조치 완료.** `finalizeGuarded` 의 0행-skip 방어가 두 릴리스 섹션에 중복 서술돼 있는데
소급 정정을 나중 것에만 달았다. 앞 섹션만 읽으면 여전히 "검증된 동작" 으로 보인다.

> **고치다가 내 정정 자체의 오류를 찾았다.** "위 1·5·6·7번" 이라고 썼는데 항목 번호는
> **섹션마다 새로 시작**한다. 그 섹션의 1번은 전혀 다른 항목(`assertExecutionNotCancelled`
> turn 경계 가드)이었다. 실제 해당은 **5·6·7** 이고, 1~4 는 `linkedNodeExec` 짝 전이
> (`FOR UPDATE` SELECT 경로)라 튜플과 무관하다. 6번도 절반만 해당한다
> (`failFirstSegmentSetup` 은 분기, `executeSync` 는 반환값을 버림).

## consistency W1 / INFO 3 — 위임 티켓의 삽입 위치 오기

**조치 완료.** `OAUTH_STATE_MISMATCH` 를 "§1.8 인근" 에 넣으라고 적었는데 §1.8 은
**KB / Graph RAG 도메인 전용** 절이다. 자매 코드(`KB_REEMBED_IN_PROGRESS`)가 거기
있다는 이유로 위치까지 따라갔는데, **그 자매가 KB 코드라는 게 요점**이었다. 인증 코드의
자리는 §1.2 다.

## consistency INFO 2 — raw SQL shape 규약 승격

**planner 위임으로 등재.** 이 지식이 **네 번 독립적으로 재발견**됐다(구조분해 ·
`deletedRowCount` · 명시 튜플 타입 · 이 PR 의 헬퍼). 네 번 각자 알아냈다는 건 부주의가
아니라 **적어 둘 자리가 없다**는 뜻이다.

승격할 불변식을 **두 개**로 명시했다 — (a) 반환 shape, (b) 컬럼명 snake_case.
이번에 (a) 만 처방했다가 (b) 를 놓쳐 CRITICAL 이 났으므로, 위임 문구에 "어느 쪽이든
(b) 를 빼지 말 것" 을 박아 뒀다.

## 검증

- lint `--max-warnings 0` 통과 · **30스위트 429 passed** · ratchet **199/38 일치**
- `nest build` 산출물 확인(위 표)

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| INFO 7 (변수명 `rowsOut`/`resetRows`) | 3~5라운드 연속 유예. 이 파일을 다음에 실질 변경할 때 함께 |
| INFO 8·9 (판별력 없는 테스트 2건) | 기존 라운드에서 확인·유예된 항목. 판별력은 각각 "admitted" 케이스와 성공 케이스가 담당함을 이미 기록 |
| INFO 10 (`reEmbedAll` 비-트랜잭션) | 기존 구조, 이 diff 는 shape 만 교체. plan 후속 등재됨 |
| INFO 11 (e2e 만료 행 미정리) | 만료 행은 `expires_at > NOW()` 로 조회 대상에서 자연히 빠진다. 테스트 격리에 영향 없음 |
| consistency INFO 1 (spec 소급 각주) | planner 위임으로 이미 추적 중 (`#12`) |
| consistency INFO 5 | 조치 불요 — `rememberMe` 결함은 프로덕션 미노출(상위 튜플 버그로 dead code)이라는 판정에 동의 |
