# Plan 정합성 검토 결과

검토 모드: impl-done (scope=spec/5-system/, diff-base=origin/main)
대상 변경 파일: spec/5-system/1-auth.md, spec/5-system/12-webhook.md

---

## 발견사항

### [INFO] webhook-hardening-cleanup.md C 항목이 동일 PR 에 포함됨
- target 위치: spec/5-system/1-auth.md §2.3 "클라이언트 IP" 행 (추가된 `extractClientIpFromHeaders` / 4단계 한정 명시)
- 관련 plan: plan/in-progress/webhook-hardening-cleanup.md 하단 "범위 밖 (별도)" — "C(spec-only 단방향 포인터: 1-auth §2.3 / api-convention §5.3 / web-chat §4) — 별도 spec 묶음"
- 상세: webhook-hardening-cleanup.md 는 이 spec 변경(§2.3 IP 추출 경로 구분)을 별도 spec 번들로 분리할 것을 명시했다. 실제로는 동일 worktree/PR 에서 처리됐다. spec 내용 자체는 코드와 정합하며 결정 충돌이 아니다. 워크플로 분리 원칙(spec-only PR 별도화) 위반이지만 내용 오류는 없다.
- 제안: 현재 변경이 이미 커밋된 상태이므로 plan 파일의 C 항목을 "(완료, 이 PR 에 포함)" 로 갱신해 추적 정합성을 유지한다. 별도 spec-only PR 불필요.

### [INFO] webhook-public-ip-failopen-hardening.md 미해결 결정과 1-auth.md §2.3 의존성
- target 위치: spec/5-system/1-auth.md §2.3 "클라이언트 IP" 행 — "webhook/rate-limit/ip_whitelist 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 req.ip/socket 폴백이 없다"
- 관련 plan: plan/in-progress/webhook-public-ip-failopen-hardening.md § "결정 필요" 항목 2(req.socket.remoteAddress 폴백)·3(fail-closed 전환). 하단 후속 메모: "결정 2·3 채택 시 해당 §2.3 행도 함께 갱신 필요"
- 상세: 대상 spec 변경은 현재 코드("req.ip/socket 폴백 없음")를 정확히 반영한다. 미해결 결정(결정 2·3)은 이 설명을 변경해야 할 수 있으나, 해당 plan 이 이미 그 의존성을 후속 메모로 명시하고 있다. 일방적인 결정 우회가 아니다.
- 제안: 현재 상태 유지. 결정 2 또는 3이 확정되면 webhook-public-ip-failopen-hardening.md 의 후속 메모에 따라 §2.3 행을 갱신한다.

### [INFO] webhook-public-ip-failopen-hardening.md "결정 후 spec 반영" 대상 범위
- target 위치: spec/5-system/12-webhook.md §처리 흐름 step 7e, 8b — extractClientIp → extractClientIpFromHeaders 함수명 동기화
- 관련 plan: plan/in-progress/webhook-public-ip-failopen-hardening.md — "결정 확정 후 spec(12-webhook.md §6·WH-SC-05·Rationale) 반영 → 구현"
- 상세: 미해결 결정 후 갱신 대상은 12-webhook.md §6·WH-SC-05·Rationale 섹션이다. 이번 변경은 핸들러 흐름 설명의 함수명(extractClientIpFromHeaders)을 코드(A-1 완료)에 맞게 동기화한 것으로, §6/WH-SC-05/Rationale 와 겹치지 않는다. 결정 미확정과 직접 충돌 없음.
- 제안: 변경 유지. 별도 조치 불필요.

---

## 요약

이번 spec/5-system/ 변경(1-auth.md §2.3 IP 추출 경로 구분 명시, 12-webhook.md 핸들러 흐름 함수명 동기화)은 plan/in-progress 의 미해결 결정과 실질적인 충돌이 없다. 1-auth.md §2.3 변경이 webhook-public-ip-failopen-hardening.md 의 미결 결정 2·3에 의해 사후 갱신될 수 있음을 해당 plan 자체가 이미 추적하고 있다. 유일한 형식 이탈은 webhook-hardening-cleanup.md 가 C 항목을 "별도 spec 묶음"으로 표시한 것을 동일 PR 에서 처리했다는 점이나, 이는 내용 오류가 아닌 계획 분리 원칙 미준수이며 plan 파일 완료 표시로 정리하면 충분하다.

---

## 위험도

LOW
