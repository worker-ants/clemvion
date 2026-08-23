---
title: "`inputData`·`outputData`·`error` 마스킹 게이트 4곳을 헬퍼로 통합"
status: complete
worktree: masking-gate-consolidation-71bbfc
started: 2026-08-23
completed: 2026-08-23
owner: developer
spec_impact:
  - spec/conventions/egress-masking.md
---

# 마스킹 게이트 4곳 통합

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
의 항목 *"`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합"* (2026-08-20 등재, `14_44_08` W4).

> **이 근본 원인은 이미 CRITICAL 을 냈다** — 자매 DTO JSDoc 이 갱신에서 빠진 `14_08_45` C2.
> 유일한 동기화 장치가 **사람이 읽는 주석 표**라는 상태가 그대로 남아 있다.

## 실측 — 정확히 4곳, 전부 같은 3필드 조합

| # | 위치 | 형태 |
| --- | --- | --- |
| 1 | `executions.service.ts` `toExecutionDto` | 부재를 `null` 로 정규화 |
| 2 | `executions.service.ts` `toResponseExecution` | 〃 |
| 3 | `executions.service.ts` 노드 레벨 루프 | **`maskIfPresent`** — 부재·참조를 보존 |
| 4 | `background-runs.service.ts` | 부재를 `null` 로 정규화 |

셋(1·2·4)은 형태가 같고 **3만 다르다.** 그 차이는 우연이 아니라 문서화된 이유가 있다 —
`nodeExecutions[]` 는 엔티티 형태를 그대로 싣는 자리라 `undefined → null` 이 되면 (a) 응답
shape 이 바뀌고 (b) 값이 없어 아무것도 안 바뀐 행까지 참조가 달라져 copy-on-change 최적화가
깨진다.

## 설계 — 헬퍼 **둘**, 단 같은 파일에 나란히

하나로 뭉개면 위 차이가 사라진다. 대신 **`redact-stored-error.ts` 한 파일에 인접 배치**하고
*"왜 둘인가 · 어느 쪽을 언제 쓰나"* 를 공유 docstring 에 적는다.

| 헬퍼 | 대상 | 계약 |
| --- | --- | --- |
| `redactStoredFieldsForResponse(row)` | 1·2·4 | `{ inputData, outputData, error }` — 부재는 `null` |
| `redactNodeExecutionRow(ne)` | 3 | 셋 다 무변화면 **같은 참조**, 아니면 얕은 복사 |

4곳이 흩어져 주석 표로 동기화되던 상태 → **2곳이 한 파일에서 서로를 보는** 상태로 바꾼다.

## ⚠️ 제가 예고한 규약 stale 은 발생하지 않는다 (실측)

`egress-masking.md §3` 에 제가 적어 둔 트리거:

> *"이 항목이 집행되면 **표 2행·표 5행의 소비처 열이 흡수돼 낡는다.** 그 항목 착수 시 이
> 표를 동반 갱신한다."*

**틀렸다.** 실측:

- **표 2행** 소비처는 `deepRedactSecrets` — 신규 래퍼는 그걸 흡수하지 않는다. 래퍼는
  `redactStoredDataForResponse` **위**에 서고, 그 함수가 `deepRedactSecrets` 를 부른다.
  호출 사슬이 한 겹 길어질 뿐 표가 지목하는 심볼은 그대로다.
- **표 5행** 소비처는 `stripExternalOnlyFields` — 호출부가 `websocket.service.ts` ·
  `interaction.service.ts` 뿐이고(실측) 이 4개 게이트와 **접점이 없다.**

즉 표는 **함수(마스커) 좌표계**인데, 내가 예고할 때 **호출부(응답 조립부) 좌표계**로 착각했다.
표를 고치는 대신 **그 트리거 문장을 정정**한다 — 틀린 예고를 남겨 두면 다음 사람이 있지도
않은 stale 을 찾는다.

## 작업

- [x] `/consistency-check --impl-prep` — BLOCK:NO (CRITICAL 0, `13_55_36`)
- [x] 헬퍼 2개 신설 + 4개 호출부 교체 (동작 무변경)
- [x] `egress-masking.md §3` 의 stale 트리거 문장 **정정** (표 자체는 무변경)
- [x] **뮤테이션으로 판별력 검증** — M1 5 RED · M2 2 RED, 둘 다 `tsc` 선검증 통과
- [x] 트래커 항목 종결 (미체크 26 → 25) + 반증 근거를 트래커 블록쿼트에 기록
- [x] TEST WORKFLOW 4단계 전부 PASS + ratchet 199건 baseline 일치
- [x] `/ai-review` — CRITICAL 0 / WARNING 2 (`14_23_44`), 위험도 LOW

## 검증 기준

- **동작 무변경**: 기존 테스트가 그대로 GREEN. 단 GREEN 은 증거가 아니다.
- **뮤테이션** — 통합이 만들 수 있는 회귀를 직접 겨눈다:
  - M1 헬퍼에서 `inputData` 마스킹을 뺀다 → RED (4곳 중 어디서 잡히는지도 본다)
  - M2 노드 레벨 헬퍼가 **항상 얕은 복사**를 하게 한다(identity 보존 파기) → RED 여야
    한다. GREEN 이면 copy-on-change 계약을 아무도 안 지키고 있다는 뜻이고, 그 사실 자체가
    기록할 발견이다
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.

## 결과

- **뮤테이션 실측**
  - **M1** 헬퍼에서 `inputData` 마스킹 제거 → **RED 5건**: 표면 ①상세(`findById`) ·
    ②목록(`toExecutionDto`) · ⑧`getChain` · ⑧-b `stop` + `background-runs`. 예측대로 4개
    호출부가 전부 이 헬퍼를 지나며, 표면별 캐너리가 각각 물었다.
  - **M2** `redactNodeExecutionRow` 를 **항상 얕은 복사**로 → **RED 2건**:
    *"`error` 가 없는 행은 원본 참조 그대로"*(⑤-c) · *"노드 레벨은 세 컬럼 전부가 복제를
    유발"*(⑥-b). copy-on-change 계약을 실제로 지키는 테스트가 있음을 확인했다.
  - 두 뮤턴트 모두 적용 후 `tsc --noEmit` 0건 — **유효 뮤턴트**다(거짓 RED 아님).
- **TEST WORKFLOW**: lint PASS · unit PASS(backend 8,914 / frontend 287파일 / 그 외 전부) ·
  build PASS · e2e PASS(backend supertest 285 + **Playwright 51**, 로그에서 직접 확인).
- **타입체크 ratchet**: 199건 / 38파일 — baseline 과 일치(신규 오류 0).
- **consistency `13_55_36`**: BLOCK **NO**, CRITICAL 0. WARNING 2건 중 1건(반증 근거를
  트래커에 남길 것)은 이 PR 에서 반영, 나머지 1건(`2-api-convention.md §2.2` 인증 URL 중첩
  예외 문구)은 **이 작업 범위 밖 · planner 소관**이라 미반영. INFO 중 `toResponseExecution`
  JSDoc stale 심볼 인용 3곳은 이 PR 에서 갱신했다.

## `/ai-review` 처분 (`14_23_44` — CRITICAL 0 · WARNING 2 · 위험도 LOW)

reviewer 9명(security·performance·requirement 포함) 전원이 **기능적 동등성**을 확인했다.
router 가 5명(architecture·dependency·database·concurrency·api_contract)을 제외했고,
forced 7명은 전원 결과가 나왔다(미이행 0).

### WARNING #1 — 신설 헬퍼 co-located 테스트 부재 → **이 PR 에서 수정**

정당한 지적이다. 이 PR 이 없애려던 fragmentation("회귀가 여러 호출부에 흩어진 테스트를
거쳐야만 드러난다")이 **테스트 층에는 그대로** 남아 있었다. `redact-stored-error.spec.ts` 에
두 스위트를 추가했다(+12 케이스, backend 8,914 → 8,926).

**추가한 테스트가 스스로 판별력을 갖는지 다시 뮤테이션**했다 — 서비스 레이어가 아니라
**이 파일만** 돌려서 확인:

| 뮤턴트 | 이 파일 단독 결과 |
| --- | --- |
| M1 `inputData` 마스킹 누락 | **2 RED** |
| M2 identity 보존 파기(무조건 spread) | **2 RED** |
| M3 노드 헬퍼가 부재를 `null` 로 정규화 (= **두 헬퍼를 뭉갠 회귀**) | **1 RED** |

M3 는 이번에 새로 추가한 뮤턴트다. 이 PR 의 핵심 설계 결정("합치지 않고 나란히 둔다")이
말이 아니라 **테스트로** 고정됐음을 뜻한다. 셋 다 `tsc --noEmit` 0건 — 유효 뮤턴트다.

### WARNING #2 — developer 가 `spec/` 을 직접 편집 → **트래커에 planner 항목으로 등재**

이 PR 에서 되돌리지 않았다. 내용은 5개 consistency checker + 9개 reviewer 가 전원 타당
판정했고(`rationale_continuity` 는 "근거 있는 정정으로 뒤집힘" 으로 명시), 되돌리면
**지금은 거짓인 지시문**("그 항목 착수 시 이 표를 동반 갱신한다" — 그 항목은 종결됐다)이
규약 문서에 남는다.

다만 지적의 **실질**은 형식이 아니라 게이트다 — 이 편집은 `--impl-prep` 만 거쳤고 spec
편집이 받아야 할 `--spec` 은 받지 못했다. 그래서 경계 자체를 정하는 판단을 정본 트래커에
planner 항목으로 등재했다(미체크 25 → 26). **이 PR 이 그 판단을 선점하지 않는다.**

### INFO — 미조치 사유

- 네이밍 접미사(`redactNodeExecutionRow` 만 `…ForResponse` 아님) · `@param`/`@returns` 태그
  보완: 둘 다 우선순위 낮음으로 명시됐고, 이름 변경은 방금 4곳을 옮긴 직후의 추가 이동이라
  이 PR 의 diff 를 넓히기만 한다.
- 나머지 INFO 5건은 전부 **양성 확인**(조치 불요)이다.

## `/ai-review` 2라운드 처분 (`14_46_46` — CRITICAL 0 · WARNING 2 · 위험도 LOW)

1라운드 WARNING #1(테스트 부재)은 **해소 확인**됐다(testing/maintainability 둘 다 명시).
남은 둘:

### WARNING #1 — `spec/` 직접 편집 (1라운드 #2 의 연장) → 그대로 유지

리뷰어 스스로 *"이미 트래커에 이관돼 있어 이번 PR 을 막을 사안은 아님"* 으로 판정했다.
planner 항목이 정본 트래커에 살아 있다.

### WARNING #2 — `maskIfPresent` 의 `null` 분기 미검증 → **전제가 반증됐다**

리뷰어는 *"`== null` 을 `=== undefined` 로 좁혀도 100개 테스트 전부 GREEN"* 을 근거로
테스트 갭이라 판정했다. **그 뮤턴트를 그대로 적용해 봤다 — 여전히 GREEN 이다.** 원인은
테스트가 아니라 뮤턴트 자체다:

| 입력 | 가드 경로 | 좁힌 경로 (`mask(v) ?? v`) |
| --- | --- | --- |
| `null` | `null` | `mask(null)` → `null`, `null ?? null` → `null` |
| `undefined` | `undefined` | `mask(undefined)` → `null`, `null ?? undefined` → `undefined` |

두 부재 형태 모두 결과가 **같다**(`node -e` 로 직접 대조). `?? value` 폴백이 가드와 같은
값을 만들기 때문이다 — **동치 뮤턴트**라 어떤 테스트로도 못 죽인다. "케이스를 추가하면
죽는다" 는 제안을 그대로 따랐다면 GREEN 을 보고 "고쳤다" 고 적었을 것이다.

그래서 처분을 둘로 갈랐다:

1. **실제로 관측 가능한 갭은 고쳤다** — 부재 보존 테스트를 `부재 형태 2 × 컬럼 3 = 6케이스`
   로 파라미터화했다(같은 라운드 INFO #5 의 대칭 갭도 함께 닫힌다). 판별력 실측: M3(부재를
   `null` 로 정규화) RED 가 **1건 → 3건**으로 늘었다. 케이스 수만 는 게 아니다.
2. **동치라는 사실 자체를 JSDoc 에 고정했다** — 표와 이유를 함께. 이 지적은 라운드마다
   재발할 형태(GREEN 을 갭의 증거로 읽는)이고, 근거가 코드 옆에 없으면 다음 사람이 다시
   못 죽일 뮤턴트를 쫓는다. 가드를 남기는 이유(현재 두 mask 가 스스로 null-check 해서 동치일
   뿐, 그러지 않는 mask 에 대한 독립 방어)도 같이 적었다.

## `/ai-review` 3라운드 — **수렴** (`15_09_42` — CRITICAL 0 · WARNING 0)

`REVIEW_AGENTS=testing,maintainability` 타겟 라운드. 2라운드 지적의 주체를 그대로 겨눴다.

- **WARNING 0.** 이전 두 라운드의 WARNING 3건 전부 "실행 재검증으로 해소 확인".
- testing reviewer 가 **동치 뮤턴트 판정을 독립 재현**했다 — *"`==null`→`===undefined`
  narrowing: 0 RED confirming legitimate equivalent mutant claim in docstring"*. 내가 쓴
  진리표를 그가 다시 돌려 같은 결론에 닿았다.
- 남은 INFO 6건은 전부 이전 라운드에서 이미 저우선순위로 확정된 항목의 재확인이거나
  "문제 없음" 양성 기록이다. reviewer 스스로 *"현재 상태로 머지 가능 — 차단 사유 없음"*.

수렴 판정 근거는 "발견 0" 이 아니라 **발견의 성격**이다: 1라운드 동작/테스트 갭 →
2라운드 좁은 테스트 갭 1건(그마저 전제가 반증) → 3라운드 스타일 INFO 만. 구조가 사라졌다.
