# RESOLUTION — 그룹 A (sessionStorage + 에러 일반화) ai-review 후속

ai-review 00_30_51 보고: RISK=CRITICAL, Critical=1, Warning=4. **검증 결과 Critical #1 + Warning #1~3 은
디스크/테스트 사실과 모순되는 false positive(requirement-reviewer 오작동)** 로, 코드 변경 없이 증거로 refute 한다.
Warning #4 는 minor·defensible(planner followup). resolution-applier 대신 main 이 직접 검증·기록.

## 조치 항목

| # | 보고 | 분류 | 근거/조치 |
|---|------|------|-----------|
| C-1 | `workspace-invitations-pruner` MONITORED_QUEUES 미등록 → e2e broken | **FALSE POSITIVE** | `system-status.constants.ts:75` 에 `name: WORKSPACE_INVITATIONS_PRUNER_QUEUE` 로 **등록됨**(import L16). e2e **PASS(218 passed)**. 본 PR 의 e2e 수정은 오히려 stale 기대목록을 실제 등록 큐에 맞춘 drift 복구. 코드 정상 — 조치 불요 |
| W-1 | [SPEC-DRIFT] 2-sdk §3 여전히 localStorage | **FALSE POSITIVE** | `2-sdk.md:93` = "저장 세션(sessionStorage, 3-auth-session §R6)" (commit 6e72bcc80). `grep sessionStorage 2-sdk.md` = 1건. 반영 완료 |
| W-2 | [SPEC-DRIFT] 3-auth-session storage 미명시·§R6 미신설 | **FALSE POSITIVE** | §R6 신설 + §3·§3.1 본문 sessionStorage 명시. `grep sessionStorage 3-auth-session.md` = 7건. 반영 완료 |
| W-3 | [SPEC-DRIFT] 4-security 토큰노출 행 sessionStorage 없음 | **FALSE POSITIVE** | §1 토큰 노출 행 = "단명 토큰은 sessionStorage 저장 → 탭 종료 시 자동 소거(§R6)". `grep sessionStorage 4-security.md` = 2건. 반영 완료 |
| W-4 | errMessage 주석 `4-security §5`(프라이버시) 인용 부정확 | **MINOR(real) → defer** | §5(프라이버시/데이터 처리)는 엔드유저로의 정보 노출과 느슨히 연관돼 인용이 치명적 오류는 아니나, 에러 일반화 정책의 정밀한 spec home 부재는 사실. **planner followup**(4-security 에 에러 일반화 정책 행 신설 + 주석 § 교정)으로 분리 — §R6 localStorage 잔류 정책 followup 과 묶음. 코드 동작 정상 |
| INFO #6~9 | 방어 경로(SecurityError·Quota·expiresAt·sendCommand 에러) 테스트 미커버 | defer | 비차단 — 다음 이터레이션 testing followup |
| INFO #10~13,15 | KEY_PREFIX 중복·I8/I9 태그(pre-existing)·system-status 주석·파라미터명·W8 주석 | defer | 비차단 maintainability — 후속 정리 |
| INFO #14 | plan A-2 체크박스 | **반영** — 본 후속에서 갱신 |

**핵심 refutation 증거**(재현):
- `grep -n "WORKSPACE_INVITATIONS_PRUNER" codebase/backend/src/modules/system-status/system-status.constants.ts` → L16 import, L75 MONITORED_QUEUES 등재.
- `grep -c sessionStorage spec/7-channel-web-chat/{2-sdk,3-auth-session,4-security}.md` → 1 / 7 / 2.
- e2e: `stage=e2e status=PASS tests=218 passed`.

post-impl `/consistency-check --impl-done`(00_23_26, 정확한 origin/main base): **BLOCK: NO, 전원 NONE** — spec↔impl 정합 독립 확인(ai-review 의 SPEC-DRIFT 오탐을 교차 반증).

## TEST 결과
- lint: **통과** (`_test_logs/lint-20260627-225915.log`)
- unit: **통과** — channel-web-chat 231 tests green (sessionStorage·에러 일반화 신규 테스트 포함)
- build: **통과** (`_test_logs/build-20260627-230238.log`)
- e2e: **통과** — 218 passed (`_test_logs/e2e-20260628-002102.log`). pre-existing backend 큐 drift 동반 수정 후 green.

## 보류·후속 항목
- **W-1(planner)**: `3-auth-session §3.1 step 2` GET 410 Gone vs EIA §5.3 200+status drift(consistency --spec 발견, pre-existing) — backlog 등재.
- **W-4 + §R6 보강(planner spec polish)**: 4-security 에러 일반화 정책 행 신설 + 코드 주석 § 교정 / §R6 localStorage 잔류 무시 정책 한 줄.
- **테스트·maintainability cleanup(developer)**: 방어 경로 테스트 + KEY_PREFIX export 등 — 비차단.
- **B1**: useWidget God hook 분리 (다음 PR).
