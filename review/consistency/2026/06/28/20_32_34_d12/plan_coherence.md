# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전), scope: `spec/5-system/`
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] Phase A spec 태스크가 unchecked 이나 실제 spec 은 이미 반영 완료

- **target 위치**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` Phase A — S-1·S-2·S-3·S-4 모두 `[ ]`
- **관련 plan**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` §Phase A
- **상세**: Phase A 태스크 4개(S-1~S-4)가 계획상 미완료(`[ ]`)로 표시되어 있으나, 워크트리의 실제 spec 파일은 이미 전부 D-12 결정 내용을 반영한 상태다.
  - `spec/7-channel-web-chat/4-security.md`: §4 불릿·blockquote(S-1) + R6 섹션(S-2) 추가 완료
  - `spec/5-system/12-webhook.md`: WH-SC-05·§6 sentinel 공유 버킷 동작 기재(S-3) 완료
  - `spec/5-system/1-auth.md`: Rationale 2.3.B m-3 에 "단일 공유 버킷 완화 한도" cross-ref(S-4) 완료
- **제안**: Phase A 의 S-1~S-4 를 `[x]` 로 체크아웃. `/consistency-check --spec` 항목은 이미 `[x]` 처리되어 있어 나머지와 정합하도록 맞추면 된다.

---

## 미해결 결정 vs. target 충돌 검토

`webhook-public-ip-failopen-hardening.md` 의 결정 사항은 기존 "결정 필요 (사용자/보안)" 에서 "결정 (사용자 확정 2026-06-28)" 으로 워크트리 내에서 이미 갱신되어 있다. 세 결정(앱 우선 + 인프라 권고 / socket 폴백 기각 / 단일 공유 버킷 완화 한도)이 plan 에 명문화되었고, target spec 이 그 결정과 일치한다. 미해결 결정과의 충돌 없음.

## 선행 plan 미해소 검토

- `spec-sync-auth-gaps.md`: LDAP/SAML 미구현 추적만 — 본 webhook IP 변경과 교차점 없음.
- `webhook-hardening-cleanup.md`: 이미 완료(`push + PR` 제외 전 단계 완료 표시) — scope 겹침 없음.
- `refactor/04-security.md`: `TRUST_CF_CONNECTING_IP` 플래그 신설 완료 기록. 본 target 의 `extractClientIpFromHeaders` 방향과 정합.
- 선행 plan 미해소 항목 없음.

## 후속 항목 누락 검토

- `webhook-public-ip-failopen-hardening.md` Phase B (구현) 는 아직 시작 전(`[ ]`). Phase A spec 반영이 실질 완료되었으므로 Phase B 구현 착수 준비가 된 상태다. Phase B 항목(`/consistency-check --impl-prep spec/5-system/` → 구현 → 테스트 → 리뷰)은 plan 에 기재되어 있고 본 consistency check 가 그 첫 단계에 해당한다.
- 후속 항목 누락 없음.

---

## 요약

`spec/5-system/` target 범위 내 `1-auth.md Rationale 2.3.B m-3` 의 D-12 "단일 공유 버킷 완화 한도" 반영은 `webhook-public-ip-failopen-hardening.md` plan 의 확정된 결정(2026-06-28 사용자 승인)과 완전히 정합한다. plan 의 "결정 필요" 구간은 워크트리 내에서 이미 "결정 (확정)" 으로 갱신되었고 세 결정 모두 spec 내용과 일치한다. 유일한 불일치는 Phase A spec 태스크(S-1~S-4)가 plan 에 `[ ]` 로 남아 있으나 실제 spec 은 이미 반영 완료된 점 — 계획표 tick 누락으로 구현 착수를 막는 CRITICAL/WARNING 사안이 아니다.

---

## 위험도

LOW
