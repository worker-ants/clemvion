# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
대상 worktree: /Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a

---

## 변경 개요

HEAD 커밋(`2e5cb2837`) 은 `codebase/` 코드 정리 전용 리팩터다.

- `hooks.service.ts` — 로컬 `extractClientIp` 래퍼 제거, `extractClientIpFromHeaders` 직접 호출
- `public-webhook-throttle.guard.ts` — `getRequest` 인라인 익명 타입을 named interface `PublicWebhookReqShape` 로 추출
- `http-exception.filter.ts` — 매직 문자열 2종을 named 상수로 명명
- 테스트 격리 개선 (env 스냅샷·`jest.restoreAllMocks` 통일)
- 신규 plan 2건: `webhook-hardening-cleanup.md`(현재 작업 추적), `webhook-public-ip-failopen-hardening.md`(미결 보안 결정 추적)

`spec/5-system/` 파일은 이번 변경에 포함되지 않았다.

---

## 발견사항

### 발견사항 없음 — INFO 수준 추적 메모 1건

- **[INFO]** 신규 plan `webhook-public-ip-failopen-hardening.md` 의 미결 결정 3항이 `spec/5-system/12-webhook.md §6·WH-SC-05·Rationale` 갱신을 예고하나 spec 은 아직 미갱신
  - target 위치: 없음 (spec/5-system/ 변경 없음)
  - 관련 plan: `plan/in-progress/webhook-public-ip-failopen-hardening.md` — "결정 필요" 3항 / "결정 확정 후 spec(12-webhook.md §6·WH-SC-05·Rationale) 반영"
  - 상세: 이 plan 은 의도적으로 "(1) 인프라 레벨 vs 앱 레벨, (2) req.socket.remoteAddress 폴백 여부, (3) fail-closed 전환 여부" 를 사용자 결정 전까지 미결로 유지하고 있다. 결정이 나면 spec 먼저 갱신 후 구현하는 순서가 맞다. 현 시점에서는 spec 미갱신이 정상적인 상태이며, 결정 전 spec 선반영을 시도하면 오히려 미해결 결정 우회가 된다.
  - 제안: 이 plan 의 미결 항목이 해소되는 시점에 spec 갱신 PR 을 별도로 생성해야 함을 추적 메모로 남긴다. 현재 조치 불필요.

- **[INFO]** `spec/5-system/1-auth.md §2.3` Rationale 2.3.B 는 `ip_whitelist`/rate-limit IP 추출이 `req.ip` 폴백 없이 헤더 기반(CF-gated → XFF 첫 IP)으로 한정된 것을 "의도된 설계"로 명시하나, `webhook-hardening-cleanup.md §A-1` 의 주석은 "req.ip 폴백을 whitelist 경로에도 적용하려면 req 전달 필요 — 별도 후속" 으로 남겨두고 있다.
  - target 위치: `hooks.service.ts` L152·L260 주석 (코드 변경 내 주석)
  - 관련 plan: `plan/in-progress/webhook-public-ip-failopen-hardening.md` §결정 필요 2항, `spec/5-system/1-auth.md §2.3 Rationale 2.3.B`
  - 상세: Spec Rationale 2.3.B 는 "`req.ip` 폴백 부재는 의도된 설계"라 명시하고 있어 충돌이 아니다. 코드 주석의 "별도 후속" 언급은 Rationale 가 기각 이유를 이미 기술한 결정과 일치하며, `webhook-public-ip-failopen-hardening.md` 가 그 결정 재검토를 공식 추적한다.
  - 제안: 별도 조치 없음. spec Rationale 과 plan 이 일관하게 동일 미결 사항을 각자의 역할(설계 근거 / 작업 추적)로 다루고 있음.

---

## 요약

이번 변경(HEAD `2e5cb2837`)은 `codebase/` 한정 코드 정리 리팩터로, `spec/5-system/` 문서는 건드리지 않는다. 진행 중인 plan 중 `spec-sync-auth-gaps.md`(LDAP/SAML), `webhook-public-ip-failopen-hardening.md`(IP 미식별 fail-open 결정) 이 가장 관련성 높으나, 어느 쪽도 이번 changeset 과 충돌하지 않는다. 신규 plan 2건은 기존 미해결 결정을 정확히 추적하고 있으며, 결정 전 spec 선반영을 일방적으로 내리지 않았다. 미해결 결정을 우회하거나 선행 조건이 해소되지 않은 상태에서 전제를 확정하는 항목은 발견되지 않았다.

## 위험도

NONE
