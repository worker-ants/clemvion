---
title: "`inputData`·`outputData`·`error` 마스킹 게이트 4곳을 헬퍼로 통합"
status: in-progress
worktree: masking-gate-consolidation-71bbfc
started: 2026-08-23
owner: developer
spec_impact:
  - spec/conventions/egress-masking.md
---

# 마스킹 게이트 4곳 통합

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
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
- [ ] `/ai-review`

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
