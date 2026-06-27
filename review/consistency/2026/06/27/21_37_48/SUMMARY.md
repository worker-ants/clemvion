# Consistency Check 통합 보고서

target: `plan/in-progress/spec-draft-eia-seq-nfr.md` → `spec/5-system/14-external-interaction-api.md` §3.5 (신규 EIA-NF-06 / EIA-NF-07)

**BLOCK: NO** — Critical 0. 모든 위배 WARNING/INFO. W3/I1/I2 는 worktree base 가 #730 병합 직전이라 발생 → **origin/main(#730 포함) 으로 rebase 하여 해소**. W1/W2 는 draft·spec 문안 정정으로 해소.

## Critical 위배
없음.

## 경고 (WARNING) — 처리

| # | 위배 | 처리 |
|---|------|------|
| W1 | EIA-NF-06 이 분산 monotonic 을 **무조건** 보장으로 서술 — WS §2.2 / 실행엔진 §9.2 의 수용된 degraded(Redis-down) 미보장 trade-off 와 모순 | **fix** — NF-06 에 "Redis 가용 경로 한정" 단서 + degraded 예외를 [WS §2.2]·[실행엔진 §9.2] SoT 참조로 연결 |
| W2 | EIA-NF-06 근거 `(§5.6·§R7)` 중 §5.6 은 inbound 명령 lock(EIA-NF-05)으로 seq INCR 과 무관 | **fix** — `(§R7 · 실행엔진 §9.2)` 로 교체, §5.6 제거 |
| W3 | "검증 완료" 단정의 선행조건(load-verify plan) 이 base 기준 미병합 in-progress | **해소** — origin/main rebase 로 #730 포함, plan 이 `complete/` 에 존재 |

## 참고 (INFO) — 처리
- I1 출처 plan 경로 `complete/...` 부재 → **해소** (rebase 후 `plan/complete/eia-distributed-seq-load-verify.md` 실재).
- I2 인용 수치 ≈67k/0.07ms 미세 불일치 → **fix** — SoT(병합본) ≈63k events/s, median 0.083ms 로 정정.
- I3 §R7 연속성·채번(EIA-NF-06/07) 정합 확인 (조치 없음).
- I4 타 in-progress plan 충돌 없음 (조치 없음).

## 미수집
- `convention_compliance` 산출 파일 부재(success 보고이나 disk 없음) → **재실행으로 재수집** (fix 적용 후 재검 라운드에서 5/5 수집).

## 권장 조치 (반영)
1. W1 degraded 단서 — 적용.
2. W2 §5.6 제거 — 적용.
3. W3 — rebase 로 해소.
4. I1/I2 — 경로·수치 정정.
5. convention_compliance 재수집 — 재검 라운드.
