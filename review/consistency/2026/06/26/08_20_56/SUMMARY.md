# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — plan 체크박스 미갱신 1건(WARNING, working tree 에서 이미 갱신 — git baseline false-flag). 나머지 4개 checker 전원 NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 제안 |
|---|---------|------|-------------|------|
| 1 | Plan Coherence | plan M-1 항목이 `[ ] 미착수` 상태 (checker 가 git baseline 을 읽음) | `plan/in-progress/refactor/03-maintainability.md:132-156` | **working tree 는 이미 `[x]` 완전 갱신**(커밋 hash·검증·ai-review 기록 포함) — 본 PR 터미널 커밋에 포함. `git show HEAD:` 가 보는 baseline 만 `[ ]` 인 false-flag. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 처분 |
|---|---------|------|------|------|
| 1 | Cross-Spec | spec 다이어그램 `data-flow/5-integration.md §1.2.1` 시퀀스 번호 vs 실제 메서드명 — 다이어그램은 behavior 기술, 계약 모순 없음 | 신규 private 메서드 4종 | spec 변경 불필요 |
| 2 | Cross-Spec | `4-cafe24.md §9.8` nonce key 가 makeshop shop_uid 공유 사실 미명시(코드 주석엔 cross-provider 안전성 설명 존재) | `assertInstallNonceNotReplayed` | **pre-existing spec-text INFO — 차기 spec-sync(planner)** |
| 3 | Cross-Spec | spec 시퀀스 `⑥ nonce` vs `⑤ HMAC` 순서 표기 — **본 PR 이전부터 존재하던 drift**, correctness 영향 없음(코드 순서 불변) | guard 호출 순서 | **pre-existing, 본 PR 범위 밖 — 차기 spec-sync** |
| 4 | Convention | 인라인 에러 코드 리터럴 전달 — `ErrorCode` union 흡수 미완료(본 diff 도입 문제 아님) | helper 호출부 | 장기 트랙 |
| 5 | Plan Coherence | Option A 전면 config 대비 보수적 partial helper 추출 — 핵심 제약 전부 준수 | plan §M-1 | **plan 에 "권장안 대비 범위" 메모 이미 추가** |
| 6 | Plan Coherence | m-1 이월 spec stale(console.warn→logger.warn) planner 위임 미해소 — 본 PR 무관 | plan:288 | 별도 추적 항목(본 PR 범위 밖) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 직접 모순 없음. 3 INFO (다이어그램 behavior 특성·nonce prefix 미명시·시퀀스 기존 drift) |
| Rationale Continuity | NONE | 기각 대안 재도입 없음. HMAC 분리·graceful fallback·error code prefix·PKCE verifier·mode='reauthorize' 전부 보존 |
| Convention Compliance | NONE | `spec/conventions/` 직접 위반 없음. 에러코드 UPPER_SNAKE + prefix 준수 |
| Plan Coherence | LOW | M-1 체크박스 미갱신 1건(WARNING, working tree 해소). 구현은 plan 핵심 제약 전부 준수 |
| Naming Collision | NONE | 신규 private 메서드 4종 동명 식별자 미사용. API/이벤트/환경변수/파일경로 변경 없음 |

## 권장 조치사항

1. **(WARNING 해소)** M-1 plan 체크박스 `[x]` 전환 + 커밋 hash·검증·ai-review 기록 — **working tree 에서 이미 완료**(터미널 커밋 포함). "HMAC·authorizeUrl 빌더 추출 제외(VERIFY 미확정)" 메모도 plan 에 기재됨.
2. **(INFO — 차기 spec-sync, planner)** `4-cafe24.md §9.8` nonce prefix provider-agnostic 한 줄 + `data-flow/5-integration.md §1.2.1` 시퀀스 번호 정렬 — 둘 다 pre-existing, 코드는 정합.
