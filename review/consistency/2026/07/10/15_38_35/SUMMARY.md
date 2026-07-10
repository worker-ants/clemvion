# Consistency Check 통합 보고서 (--spec, 최종) — **BLOCK: NO**

target: `plan/in-progress/catalog-residual-codes.md`. 4라운드 수렴(rationale_continuity 가 매 라운드 gate 를 정밀화, FS-flakiness 로 summary 가 CRITICAL 을 반복 누락 → journal/단독 재실행으로 복구).

## 판정: BLOCK: NO
- **5 checker 전원 Critical 0.** 최종 rationale_continuity(15_38_35) NONE + 나머지 4 checker(15_19_15) NONE/LOW.

## 수렴 이력 (rationale_continuity CRITICAL, 매번 정밀화 → 해소)
| 라운드 | CRITICAL | 해소 |
|---|---|---|
| 14_53_01 | `PASSWORD_REQUIRED` 를 §1.2 에 두면 형제 `PASSWORD_INVALID`(§1.2.1)와 분리 | §1.2.1 로 재배치 |
| 15_05_50 | `NOT_A_MEMBER` 행 `ALREADY_A_MEMBER(§1.9)` cross-ref 4중 오류 | 절 제거 + 발행처 일반화 |
| 15_19_15 | `INVALID_PASSWORD` 등재가 "문서화→등재" 게이트 위반(passing 언급) | §2.3.C 보강 시도 |
| 15_29_25 | 위 보강이 §2.3.C(Rationale)라 **본문** 아님 | **§2.3 본문 blockquote note**(L334 reauth 선례 대칭)로 이동 |
| 15_38_35 | — (해소) | 3코드 모두 본문 문서화 |

## 최종 배치 (게이트 충족)
| 코드 | status | 등재 | 본문 SoT |
|---|---|---|---|
| `NOT_A_MEMBER` | 403 | §1.2 | §5 (기존) |
| `INVALID_PASSWORD` | 401 | §1.2 | §2.3 본문 note (1b 신규) |
| `PASSWORD_REQUIRED` | 401 | §1.2.1 (형제 `PASSWORD_INVALID` 옆) | §5 본문 note (1a 신규) |

## INFO (비차단) — 처분
- naming: `INVALID_PASSWORD` 동명값(1-data-model failure_reason) 단방향 cross-link — 선택(미반영, 별도).
- rationale: §2.3 body note ↔ §2.3.C L690 문장 경미 중복(모순 아님) — 수용.
- convention: §1.2(`HTTP`)/§1.2.1(`status`) 헤더 pre-existing drift — 범위 밖.
- plan_coherence: `error-codes-catalog-sot.md` complete 이동 시점 — PR 에서 판단.

## base
- plan_coherence 초기 WARNING(stale 스택 base) → `reset --hard origin/main`(#887·#888 머지 반영)으로 해소.

→ spec 반영 진행.
