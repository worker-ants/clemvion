# Consistency Check 통합 보고서 (2차 — C1·C2 정정 후 재검증)

**BLOCK: NO** — Critical 없음. 1차의 Critical 2건(cancelledBy 4번째 값, 신규 스캐너)이 올바르게 철회됐음을 확인. WARNING 4 + INFO 8 은 편집 대상 완전성·프레이밍 개선(비차단).

> convention_compliance 는 disk-write gap 으로 파일 미기록 → main 이 journal.jsonl 에서 복구. 결과: WARNING 1(`CHANNEL_` prefix ↔ chat-channel 모듈 충돌 → `WEBCHAT_IDLE_TIMEOUT` 권고), Critical 0. `cancelledBy='timeout'`+신규 error.code·EIA-RL-07 슬롯·`#33-인증` 앵커 규약 부합 확인.

## 전체 위험도
**MEDIUM** — Critical 없음. 편집 대상 오지정/누락(W1·W2·W3)과 프레이밍 보강(W4)이 주. 모두 spec 편집 전 plan 에 반영.

## Critical 위배
없음.

## 경고 (WARNING) — 전부 반영

| # | Checker | 위배 | 반영 |
|---|---------|------|------|
| W1 | Cross-Spec | 무기한 보존 불변식이 §4.x(L425-431)·§7.4(L930) 두 곳 중복인데 변경안 (3)은 §7.4만 지정 | (3)에 §4.x 동반 편집 추가 |
| W2 | Cross-Spec+Naming | 변경안 (6) "auth-session §3.1 토큰만료 행" 은 실재 안 함(그 행은 widget-app §3.1 L88). §R6 대안은 이질 주제 | (6)→auth-session §R4/§R6 근처 cross-ref 로 정정 + widget-app §3.1 L88 행에 B-2 언급을 (1)에 추가 |
| W3 | Cross-Spec | data-flow 미러 2건 누락 | (7-a) data-flow/3-execution §3.1 전이, (7-b) data-flow/15-external §2.2 job 카탈로그 신설 |
| W4 | Rationale | B-2 "원칙 예외" 직행 — job-based 대안 미검토 | R-B2 재프레이밍: §1.1 "타임아웃" 예약 카테고리 최초 구현 + EIA-RL-06 sweep 선례 확장(원칙 예외 아님). per-execution delayed job 대안 기각 근거 추가 |

## 참고 (INFO) — 반영

| # | 항목 | 반영 |
|---|------|------|
| I1 | "채널 판정" 문구가 Chat Channel(§15)과 오독 | "공개 웹채팅 위젯(EIA §B-2, auth_config_id IS NULL+per_execution)" 구체 스코프로 |
| I2 | "generic fallback" 부정확 | "`execution.cancelled` 처리(RESUME_* 외 일반 취소 안내)"로 정정 |
| I3 | EIA-RL-06(BullMQ repeatable) 선례 미인용 | R-B2 에 인용 → "기존 패턴 확장" |
| I4 | §1.1 이 이미 waiting→cancelled "타임아웃" 예약 | "예약 카테고리 최초 구현"으로 재서술 |
| I5 | widget-app §R6 "방치 세션 토큰만 만료" 낙관 서술 미갱신 | (1)에 §R6 각주 추가(B-2로 execution 회수 실질화) |
| I6 | error-codes.ts 편집이 exec-intake-followups ARCH#5 대기열 합류 | 구현 위임 메모 cross-ref |
| I7 | 체크리스트 (7) backlog 갱신 미실행 | spec 편집과 동시 수행 |
| I8 | 신규 서비스명 ↔ terminal-revoke-reconciler 혼동 방지 | 구현 위임 메모에 별도 서비스명 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | MEDIUM | 편집 대상 오지정 2(W1·W2)+data-flow 누락(W3). 1차 Critical 2건 철회 확인 |
| Rationale Continuity | LOW | 결정 정합·날조 없음. 대안 검토·선례 인용 보강(W4·I3·I4) |
| Convention Compliance | (journal 복구) | `CHANNEL_` prefix WARNING(→WEBCHAT_). Critical 0 |
| Plan Coherence | LOW | 병렬 plan 충돌 없음. 절차 잔여 2(I6·I7) |
| Naming Collision | LOW | EIA-RL-07·error.code·R9 충돌 없음. 서비스명 미확정(I8) |

## 결론
BLOCK: NO. 모든 WARNING/INFO 를 draft plan + spec 편집에 반영 후 spec 착수. 3차 재검증은 신규 결정 없음(대상 완전성·프레이밍·rename 뿐)이라 생략, doc-guard 로 링크 정합 확인.
