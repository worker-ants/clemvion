# Consistency Check 통합 보고서 (--spec, 재검증) — **BLOCK: NO**

target: `plan/in-progress/auth-reauth-spec-accuracy.md` (정정본). 1차(10_11_30) naming_collision BLOCK:YES 2 CRITICAL 을 코드검증값으로 정정 후 재검증.

## 판정
- **BLOCK: NO** — 5 checker 중 Critical 0. naming_collision CRITICAL 2건 해소 확인(LOW: "target 이 이미 명시적 구분 문구로 방어"). rationale_continuity **NONE**("모범적 drift 정정").
- WARNING 1건(내 정정본이 만든 회귀) — spec 반영 시 함께 정정 완료(아래).

## Critical
없음.

## WARNING (Cross-Spec·Convention Compliance, 중복 지적) — spec 반영에 정정 반영함
| # | 위배 | 정정 |
|---|---|---|
| 1 | §1.2.1 주석(2b)이 `login_history.event` 값 `totp_failed`(lower_snake)를 `failure_reason`(UPPER_SNAKE: `TOTP_INVALID` 등) 예시처럼 병기 — 1-data-model §2.18.2·코드(auth.service.ts:444-455)와 불일치, `error-codes.md §1` UPPER_SNAKE 규약과 같은 절 충돌 (정정본이 만든 회귀) | 2b 주석·코드검증 배경 절을 "`event`(`totp_failed` 등)·`failure_reason`(`TOTP_INVALID`·`INVALID_PASSWORD` 등 UPPER_SNAKE)" 두 필드로 분리 — 반영 완료 |

## INFO — 처분
| # | Checker | 항목 | 처분 |
|---|---|---|---|
| 1 | Cross-Spec | §2.3/2.3.D 가 "WebAuthn 일반화는 `refactor-auth-reverify-unify` 영역" 을 반복 인용하나 그 완료 plan 실제 범위(bcrypt→comparePassword)에 해당 항목 없음 — pre-existing dead-end pointer 복제 | 내 신규 텍스트(1a)에서 "(refactor-auth-reverify-unify 영역)" 인용 제거 → "미착수(별도 plan 필요)" 로 완화. 기존 1.1.B-4 의 pre-existing pointer 는 범위 밖(무수정) |
| 2 | Convention Compliance | §1.2 본표(`HTTP`) vs §1.2.1(`status`) 컬럼명 pre-existing 불일치 | 범위 밖 — §1.2.1 기존 헤더(`status`)와 일관되게 3행 추가만. 헤더 통일은 별도 |
| 3 | Naming Collision | `PASSWORD_INVALID`↔`INVALID_PASSWORD` 근접명명·`§2.3.D` 앵커 | 문제 없음(명시 구분 문구 방어·시퀀스 정합) — 무조치 |

## Checker별
| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | LOW | 코드검증 표·§2.3 outlier 진단 전부 코드·타 spec 정합. event/failure_reason 혼동(WARNING, 정정)·dead-end pointer(INFO) 잔여 |
| rationale_continuity | NONE | 기각 대안 재도입·번복 없음. git 이력·plan 계보·1.1.B-4 교차검증 "모범적 drift 정정" |
| convention_compliance | LOW | 명명·근접명명 구분·status·앵커·Rationale 포맷 규약 준수. event/failure_reason 혼동만(정정) |
| plan_coherence | success(파일 FS-flakiness 누락 → 재실행) | 1차(10_11_30)에서 BLOCK:NO. 정정본은 그 WARNING(error-codes-catalog-sot 후속 갱신)을 변경 3 으로 반영해 개선 |
| naming_collision | LOW | 1차 2 CRITICAL 해소 확인. 신규 발행 식별자 없음(기존 코드 코드 3종 등재), 앵커 충돌 없음 |

→ spec 반영 진행(BLOCK:NO + WARNING 정정 완료).
