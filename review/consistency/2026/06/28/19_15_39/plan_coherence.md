# Plan 정합성 검토 결과

## 검토 대상

- **Target**: `spec/5-system/1-auth.md` §2.3 클라이언트 IP 행 1줄 변경
- **변경 내용**: `req.ip`/`socket` 폴백을 포함한 4단계 순서가 세션·감사 경로(`extractClientIp`)에 한정되며, webhook/rate-limit/`ip_whitelist` 경로는 헤더 기반(`extractClientIpFromHeaders`) 전용임을 명시
- **검토 모드**: --impl-done (구현 완료 후 spec 동기화)
- **diff-base**: origin/main

## 발견사항

### 1. [INFO] webhook-public-ip-failopen-hardening 의 미결 결정과의 관계

- **target 위치**: `spec/5-system/1-auth.md` §2.3 "클라이언트 IP" 행 — 추가 문장 `"webhook/rate-limit/ip_whitelist 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 req.ip/socket 폴백이 없다"`
- **관련 plan**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` §결정 필요 2항 ("앱 폴백: req.socket.remoteAddress 를 IP 폴백으로 쓸지"), 3항 ("fail-closed 전환 여부")
- **상세**: `failopen` plan 이 아직 "webhook 경로에 req.socket.remoteAddress 폴백을 추가할지" 를 미결로 열어두고 있다. target spec 변경은 현행 구현(폴백 없음)을 사실 기술한 것이며, 결정을 일방적으로 확정하는 표현("이 상태가 정답")은 아니다. 다만 spec 에 "req.ip/socket 폴백이 없다"가 명시됨으로써 향후 결정이 '폴백 추가'가 되면 spec 도 함께 갱신해야 한다는 후속 부담이 생긴다.
- **제안**: 현재 spec 문장은 구현 현황 기술로 충분히 양립한다. `webhook-public-ip-failopen-hardening.md` 에 "1-auth §2.3 클라이언트 IP 행이 현행 헤더 전용 상태를 기술함 — 폴백 추가 결정 시 해당 행도 갱신 필요"를 추적 메모로 추가하면 충분하다. plan 갱신 권장.

### 2. plan/in-progress/webhook-hardening-cleanup.md 와 일치 확인

- **target 위치**: spec/5-system/1-auth.md §2.3
- **관련 plan**: `plan/in-progress/webhook-hardening-cleanup.md` 범위 밖 항목 "C(spec-only 단방향 포인터: 1-auth §2.3 / api-convention §5.3 / web-chat §4) — 별도 spec 묶음"
- **상세**: 해당 plan 이 `1-auth §2.3` spec 변경을 명시적으로 소유하고 있으며, 현재 worktree(`competent-mirzakhani-34a96a`)가 이를 처리 중이다. 정합.

### 3. [INFO] plan/in-progress/spec-sync-auth-gaps.md 와 비간섭 확인

- **target 위치**: spec/5-system/1-auth.md §2.3
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` — `§1.3 LDAP/SAML` 미구현 추적
- **상세**: spec-sync-auth-gaps.md 는 §1.3 영역(LDAP/SAML)만 추적 중이다. target 변경은 §2.3(세션/IP 경로)이며 §1.3과 교차가 없다. 충돌 없음.

## 요약

이번 변경은 `spec/5-system/1-auth.md` §2.3 클라이언트 IP 행에 1줄을 추가해 세션·감사 경로(`extractClientIp` 4단계)와 webhook/rate-limit 경로(`extractClientIpFromHeaders` 헤더 전용)의 IP 추출 분기를 명시한 것이다. 이 변경은 `webhook-hardening-cleanup.md` plan 이 소유하는 spec 범위(C 항목)와 일치하며, `spec-sync-auth-gaps.md`(§1.3 LDAP/SAML)와의 충돌도 없다. `webhook-public-ip-failopen-hardening.md` 의 미결 결정(폴백 추가 여부)과는 직접 충돌하지 않지만, 향후 결정이 '폴백 추가'로 확정될 경우 spec 갱신이 필요하다는 후속 추적 메모를 해당 plan 에 추가하는 것이 바람직하다.

## 위험도

LOW
