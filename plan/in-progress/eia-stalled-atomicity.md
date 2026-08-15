---
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-15
owner: developer
branch: claude/eia-stalled-atomicity
spec_impact:
  - spec/5-system/4-execution-engine.md
---

# `finalizeStalledExhausted` 만 트랜잭션 밖이었다

## 다른 plan 과의 관계

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, 이 작업은 그 문서의 *"`finalizeStalledExhausted` 만 트랜잭션 밖이다"* 항목
(2026-08-15 등재, `12_52_39` database W1) 을 집행한다. **구현 커밋과 같은 턴에 양쪽을 닫는다.**

## 결함

세 자매가 같은 2-테이블 쓰기(Execution UPDATE + NodeExecution cascade UPDATE)를 하는데
**둘만 원자적이었다.**

| 함수 | 트랜잭션 |
|---|---|
| `cancelParkedExecution` | 있음 |
| `markWebChatIdleTimeout` | 있음 |
| `finalizeStalledExhausted` | **없음** |

첫 UPDATE 가 커밋된 뒤 둘째가 실패(DB 오류·크래시)하면 자식 NodeExecution 이 **영구
`RUNNING`** 으로 잔류한다 — **자매 두 함수의 주석이 경고하는 바로 그 실패 모드**다.

> 이 저장소의 반복 형태(*"하드닝을 자매 함수 미적용"*)의 교과서적 사례다. 셋 중 둘만
> 닫혀 있었고, 남은 하나를 리뷰어가 **직전 라운드의 자기 판정을 실측 정정해** 찾아냈다.

## 조치

- [x] 두 UPDATE 를 `dataSource.transaction` 으로 묶는다 — **자매와 동형**(패턴을 재발명하지
      않고 `cancelParkedExecution` 을 그대로 따랐다: 트랜잭션 안에서 `manager.createQueryBuilder`
      2회, 커밋 이후 emit)
- [x] `finalized` 플래그로 조기 return 시 emit·cleanup 을 건너뛴다
- [x] 회귀 테스트 — 두 UPDATE 가 **같은 트랜잭션 manager** 를 타는지 + 트랜잭션 밖 repo 를
      쓰면 즉시 터지도록 무장(다시 밖으로 나가는 회귀를 잡는다)
- [x] 기존 테스트 2건을 같은 하네스로 통일 (`installStalledTx` — 자매 `installCancelTx` 와 동형)
- [x] **항상 참이 될 뻔한 단언 교체** — `affected=0` 테스트가
      `mockNodeExecutionRepo.createQueryBuilder` 미호출을 단언했는데, 이제 그 repo 를 아예
      쓰지 않으므로 **무엇을 깨도 통과**한다. `managerCqb` 호출 횟수 + `nodeQb.execute` 미호출로 교체

> **mock 은 롤백을 흉내내지 못한다.** 이 테스트가 보증하는 것은 *두 UPDATE 가 같은 트랜잭션
> manager 를 탄다*는 것까지다(원자성 자체가 아니라 그 전제).
>
> ~~실 DB 부분 커밋 검증은 자매 plan 의 실 DB e2e 트랙과 같은 성격이라 그쪽에 묶인다.~~
> **(2026-08-15 정정)** 그런 항목은 **없었다** — 자매 plan 의 #4 는 다른 함수를 다룬다.
> 정본 트래커에 **새로 등재**했다 (`16_19_57` plan_coherence W1).

## 판별력 (뮤테이션)

> 이 표가 **라운드 1 시점에 멈춰 있었다** (`16_44_28` documentation W2) — 아래 체크리스트는
> 3라운드 조치 완료를 정확히 적었는데 이 표만 2행이었다. 누적으로 갱신했다.

| 뮤턴트 | 결과 | 라운드 |
|---|---|---|
| `dataSource.transaction` 제거 (manager 직접 사용) | **RED 3/3** | `16_04_38` 전 |
| `affected=0` 조기 return 제거 | **RED 1** | `16_04_38` 전 |
| cascade WHERE 가드 변조 (`:running`→`:waiting`) | **RED** | `16_04_38` W1 |
| Execution `WHERE id` 변조 (`id`→`wrong`) | **RED 2** | `16_19_26` W1 |
| 트랜잭션 예외 삼킴 (`try{}catch{return}`) | **RED** | `16_31_53` W1 |

## 범위 밖

이 함수의 다른 열린 항목(관용구 헬퍼 추출 · 단일 emit 관문 · **실 DB 롤백 e2e — 이번에
새로 등재**)은 정본 트래커에 있고 이번 PR 에서 건드리지 않는다 — **넓은 일괄 편집이 대상 밖 8곳을 조용히 바꾼
전례**가 이 계열에 있다.

## 체크리스트

- [x] `--impl-prep` (`15_54_20`) **BLOCK: NO** — WARNING 1건 반영:
      이 함수는 **워커 크래시 → FAILED** 경로지 취소가 아니라서,
      `node-cancellation.md`(취소 전용 스코프)가 아니라 **`4-execution-engine.md` §7.1**
      (이 함수의 진짜 SoT)에 기록해야 했다. 문서 스코프를 말없이 넓힐 뻔했다
- [x] 자매 트래커 동시 갱신 (구현 커밋과 같은 턴)
- [x] TEST WORKFLOW 4스테이지 — lint / unit(백엔드 425·8730, 프런트 285 파일) /
      build / **e2e 276 passed** 전부 PASS
- [x] `/ai-review` **CRITICAL 0** — 3라운드. `16_04_38`(W4) · `16_19_26`(W2) ·
      `16_31_53`(W1) 전부 조치. 각 세션 `RESOLUTION.md` 참조
- [x] `--impl-done` (`16_32_26`) **BLOCK: NO** — 5 checker 중 4개 NONE,
      plan 체크리스트 hygiene WARNING 1건(이 항목)만
- [ ] push 게이트 통과 → PR
