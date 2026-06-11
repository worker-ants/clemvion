# RESOLUTION — integration-expiry-fixes 최종 ai-review (session 01_34_33)

risk HIGH (Critical 1 + Warning 6) 로 보고됐으나, **Critical #1 과 SPEC-DRIFT WARNING #1~#3 은 git-검증된 main-baseline false positive** 다. reviewer 들이 branch HEAD 가 아니라 origin/main 의 옛 spec(폐기/NULL/+알림 상태)을 기준으로 읽었다 ([reference_consistency_check_main_baseline_fp 패턴]). 코드/ spec 변경 없이 수동 조치로 종결한다.

## 조치 항목

| # | 카테고리 | 판정 | 근거 |
|---|---|---|---|
| Critical #1 | Requirement | **FALSE POSITIVE — 조치 없음** | "token_expired 가 spec 에서 폐기된 설계 부활, §3.2·시퀀스가 NULL" 주장은 origin/main 기준. branch HEAD 검증: `data-flow/5-integration.md` §3.2 표(L384)·시퀀스(L285)·상태도(L367) 모두 `token_expired` 로 갱신됨(커밋 cccc437f·a151b9fc). §1.4 Rationale(L434)은 "V-01·V-07 fix 로 해소, status_reason='token_expired' 기록" 로 현행화 ("폐기" 는 섹션 제목·인용 과거문구에만 잔존). `token_expired` 는 **사용자 §11.2 채택 명시 결정**(2026-06-10)이며, 권위 게이트 `--impl-done` consistency 가 **4회 연속 BLOCK: NO** 로 spec↔code 일치 확인(최종 01_02_54: "§3.2 token_expired 추가 — 1-data-model §2.10 일치 확인"). 되돌리면 사용자 결정 번복 + 정리된 모순 재도입이라 **revert 하지 않음**. |
| WARNING #1 | SPEC-DRIFT | **FALSE POSITIVE — 조치 없음** | "§11.1 표에 `+ 알림` 잔존, MakeShop 블록 알림 제외 미명시" 주장은 origin/main 기준. branch HEAD: §11.1 표·의사코드·MakeShop 블록 모두 `isRefreshCapable`·"passive 알림 대상에서 제외"로 갱신됨(커밋 78af3d00·f5915971 등). `grep "큐 enqueue + 알림"` → 0건. |
| WARNING #2 | SPEC-DRIFT | **FALSE POSITIVE — 조치 없음** | "§1.4 callout·표가 isCafe24RefreshCapable 기준" 주장은 origin/main 기준. branch HEAD: 구현 갭 callout 제거됨, 표·시퀀스 `isRefreshCapable` 반영. |
| WARNING #3 | Requirement | **FALSE POSITIVE — 조치 없음** | WARNING #1 과 동일 근거 (§11.1 makeshop 분기는 이미 본문 반영). |
| WARNING #4 | Maintainability | **수용 (현행 유지)** | `isRefreshCapable` 부정형 OR(2개)은 가독성 충분하며 JSDoc 에 확장 지침 명시. allowlist Set 전환은 provider 3개 이상 시 ARCHITECTURE INFO #3 으로 추적 — 현 규모 과잉. |
| WARNING #5 | Maintainability | **이미 처리됨** | `token_expired` union 주석은 직전 사이클(applier)에서 NOTE 라인 분리로 max-len 회피 완료(integration-status-reason.ts L17-20). |
| WARNING #6 | Documentation | **수용 (현행 유지)** | data-flow/5 Rationale "폐기된 옛 서술" 단락은 이력 추적용 의도적 ledger. §1.4 가 현행 SoT 임을 명시. |

## TEST 결과

- lint  : 통과 (직전 사이클)
- unit  : 통과 (40 passed)
- build : 통과
- e2e   : 통과 (184/184, 직전 resolution-applier 사이클 — 본 RESOLUTION 은 코드 변경 없음)

## 보류·후속 항목

- INFO #8 (0d makeshop dedup claim `not.toHaveBeenCalled` 단언 추가), #9 (`normalizeStatusReason` 전용 단위 테스트), #11 (MONITORED_QUEUES 전수 스냅샷) — 테스트 강화 nice-to-have. 코드 신규 커밋이 push 가드 timestamp 를 재무장하므로 본 PR 에 미포함, 별도 test-hardening 백로그.
- INFO #5/#7 (statusReason='token_expired' 프론트 i18n/표시 분기) — frontend follow-up 백로그.
- INFO backfill/orphan claim prune — 별도 plan.
