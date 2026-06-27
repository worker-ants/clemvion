# Plan 정합성 검토 결과

## 검토 대상

- **target**: `plan/in-progress/spec-draft-eia-seq-nfr.md`
- **검토 범위**: `plan/in-progress/**` 전체

---

## 발견사항

### [INFO] merge-p2-async-fanin 의 EIA §R7 cross-ref 항목과 부분 중복 추적

- target 위치: `spec-draft-eia-seq-nfr.md` 전체 (EIA-NF-06 — Redis `INCR exec:seq:<id>` 의 분산 monotonic 보장)
- 관련 plan: `plan/in-progress/merge-p2-async-fanin.md` §1 작업 단위 5번째 항목
  > "(EIA cross-ref) §R7 의 monotonic seq 보장 검증 — 비동기 dispatch 후에도 … race 가 발견되면 EIA §R7 보강 노트의 'Redis INCR 또는 DB row-level lock' 으로 강화 follow-up."
- 상세: `merge-p2-async-fanin.md` 는 "분산/병렬 환경에서 race 가 발견되면 EIA §R7 보강 노트의 강화 follow-up" 을 아직 열린 체크박스로 유지하고 있다. target 은 이 강화가 이미 완료됨(Redis INCR 경로 채택, PR #730 e2e 검증)을 사실상 확정하지만, `merge-p2-async-fanin.md` 의 해당 체크박스는 갱신되지 않았다. 충돌이라기보다 stale 추적 항목이다.
- 제안: `merge-p2-async-fanin.md` 의 위 cross-ref 항목에 "(→ Redis INCR 경로 채택 완료 — EIA-NF-06/07 로 정량화, PR #730)" 노트를 추가하거나 체크박스를 완료 처리. target spec-draft plan 에 명시 불요 (plan 교차 갱신 대상).

---

## 요약

target(`spec-draft-eia-seq-nfr.md`)이 다루는 EIA-NF-06 / EIA-NF-07 NFR 명문화는, 진행 중인 어떤 plan 에서도 "결정 필요" 로 열어둔 항목과 충돌하지 않는다. 이 변경이 전제하는 선행 조건(Redis INCR 분산 seq counter 구현 — `plan/complete/eia-distributed-seq-counter.md`, 실 e2e 검증 — `plan/complete/eia-distributed-seq-load-verify.md`, PR #730 병합)은 complete plan 으로 이관·확정됐다. `spec-sync-external-interaction-api-gaps.md` 의 미구현 항목은 별개 surface(backoff 배율·분산 SSE fan-out·rate-limit·status 실값·replay_unavailable)이며 target 과 간섭 없다. 유일한 추적 gap 은 `merge-p2-async-fanin.md` 의 EIA §R7 cross-ref 체크박스가 stale 상태인 것으로, plan 갱신 권장(INFO 등급).

## 위험도

LOW
