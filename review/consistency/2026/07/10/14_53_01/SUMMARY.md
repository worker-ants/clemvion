# Consistency Check 통합 보고서 (--spec, 1차) — **실제 BLOCK: YES → 재배치 후 재검증**

target: `plan/in-progress/catalog-residual-codes.md`. Workflow 자동 summary 는 BLOCK:NO 를 냈으나 **rationale_continuity 산출물이 FS-flakiness 로 디스크 미기록**이라 그 **CRITICAL 을 누락**했다. journal.jsonl 복구로 CRITICAL 확인 → 실제 판정 **BLOCK: YES**.

## Critical (rationale_continuity, journal 복구) — 재배치로 해소
- `PASSWORD_REQUIRED` 를 §1.2 에 두면 **같은 함수 `verifyPasswordForUser` 의 형제 코드 `PASSWORD_INVALID`(#887 이 §1.2.1 에 등재)**와 다른 섹션·SoT 로 쪼개짐. 동일 함수 두 실패 모드 분리.
- **처분**: `PASSWORD_REQUIRED`(2FA/WebAuthn 관리 재확인 missing)를 **§1.2.1**(형제 옆)로 재배치. `NOT_A_MEMBER`·`INVALID_PASSWORD`(무관 함수)는 §1.2 유지.

## WARNING — 재배치 draft 반영
| # | Checker | 위배 | 처분 |
|---|---|---|---|
| 1 | plan_coherence | #887 이미 머지(origin/main squash 318642003 + #888~892)인데 stale 스택 base → silent revert 위험 | **`reset --hard origin/main` 으로 base 교정 완료** |
| 2 | plan_coherence·naming_collision | `error-codes-catalog-sot.md §후속` L56(NOT_A_MEMBER·INVALID_PASSWORD) 미참조·미갱신 | 워크플로에 체크박스 갱신 + 전 항목 완료 시 complete 이동 추가 |
| 3 | cross_spec·convention | `NOT_A_MEMBER` 행 `data-flow §1.5` 링크 앵커 누락 | `#15-워크스페이스-전환-토큰-재발급` 앵커 추가 |

## INFO — 반영
- PASSWORD_REQUIRED↔REAUTH_REQUIRED disambiguation(4중 근접명명) 명시 추가.
- 링크 선례 인용 `ADMIN_REQUIRED`→`TOKEN_INVALID` 정정(설명 열 cross-ref 실제 선례).
- `INVALID_PASSWORD` 이름 열 괄호("(변경)") 제거 → 설명 열만 부연.
- `NOT_A_MEMBER`↔`ALREADY_A_MEMBER`(§1.9, 409) 반대 의미 고지.
- Rationale bullet 에 "workspace 직접-추가 경로 코드는 범위 밖" scope 한정.

## Checker별
| Checker | 판정 | 비고 |
|---|---|---|
| cross_spec | LOW | 3코드 값·발행처·의미 코드·spec 정합. 링크 앵커·완결성 문구 scope INFO |
| rationale_continuity | **CRITICAL(journal)** | PASSWORD_REQUIRED 형제 분리 → 재배치 §1.2.1 로 해소 |
| convention_compliance | LOW | UPPER_SNAKE·4열 스키마 준수. 링크 앵커·스타일 편차만 |
| plan_coherence | MEDIUM | stale base(교정)·catalog-sot 체크박스(반영) |
| naming_collision | LOW | 신규 충돌 없음. 근접명명 disambiguation 강화 권고(반영) |

→ 재배치·전 WARNING 반영 draft 재검증: 다음 세션.
