# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] Webhook 413 에러코드 및 본문 크기 정책 — spec WH-NF-02 정합 확인
- 위치: `triggers.en.mdx` (변경 라인 37), `triggers.mdx` (변경 라인 546)
- 상세: 변경 전 "1MB" 단일 임계 → 변경 후 "공개 webhook 32KB (`PUBLIC_WEBHOOK_BODY_TOO_LARGE`) / 인증 webhook 1MB Planned" 이분 구조로 갱신. `spec/5-system/12-webhook.md` WH-NF-02 및 §8 의 "분리 임계(옵션C): 공개 32KB(`PublicWebhookThrottleGuard`) / 인증 1MB(미구현 Planned)" 기술과 line-level 로 일치. 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 도 WH-NF-02 명칭과 일치.
- 제안: 추가 조치 불필요.

### [INFO] Webhook 429 rate limit 수치 변경 — spec WH-SC-05 정합 확인
- 위치: `triggers.en.mdx` (변경 라인 48), `triggers.mdx` (변경 라인 557)
- 상세: 변경 전 "60 req/min per-trigger" → 변경 후 "global 100 req/min". `spec/5-system/12-webhook.md` WH-SC-05 는 "글로벌 throttler **100 req/min**"을 명시하며, §8(Rate Limiting) 및 Rationale §432 에서도 동일하게 "글로벌 Throttler 100 req/min"으로 기록. 영문·한국어 두 파일 모두 동일하게 갱신됨.
- 제안: 추가 조치 불필요.

### [WARNING] Inbound command 429 RATE_LIMITED 수치(60건/분) — 미구현 항목, 향후 수치 재검토 필요
- 위치: `triggers.en.mdx` L357 / `triggers.mdx` L566
- 상세: `spec/5-system/14-external-interaction-api.md` §8.4 및 §726 은 "Inbound 명령(/interact) — execution 당 분당 60 — **미구현 (Planned)**"으로 명시. 문서 변경은 "(Planned — not yet implemented)" 마킹을 추가한 것으로 미구현 현실과 정합. 그러나 "60건/분"은 spec 이 현재 계획 수치로만 기재한 미확정 값이다. 향후 실제 구현 시 spec 과 문서에서 이 수치가 함께 재검토돼야 한다.
- 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 EIA-NX-11/§8.4/§5.1 추적 항목에 "구현 시 inbound rate-limit 수치(60건/분) 재검토 + 인프라·앱 레이어 429 구분 명시" 체크리스트 항목을 추가. 현 diff 범위 내 즉각 수정 불필요.

### [INFO] review/ 메타 파일 (SUMMARY.md, RESOLUTION.md, 상태 JSON) — 기능 영향 없음
- 위치: `review/code/2026/06/28/12_28_46/` 하위 파일들
- 상세: 이번 diff 에 포함된 SUMMARY.md, RESOLUTION.md, _resolution_state.json, _resolution_log.md, _retry_state.json 은 이전 리뷰 세션의 산출물이다. 코드·API·비즈니스 로직에 영향을 주지 않으며 본 리뷰 대상 기능과 무관하다. 내용상 이전 리뷰 결론("두 수정 모두 spec SoT 와 line-level 정합, WARNING 1건 기존 plan 추적 확인")이 본 리뷰 대상 변경과 일관성을 가진다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 순수 MDX 문서 수정으로, 실제 실행 코드·API 동작 변경은 없다. 주요 두 변경점 — (1) webhook 본문 크기 정책을 "1MB 단일" 에서 "공개 32KB(`PUBLIC_WEBHOOK_BODY_TOO_LARGE`) / 인증 1MB Planned" 이분 구조로, (2) webhook 429 rate limit 수치를 "per-trigger 60 req/min" 에서 "global 100 req/min" 으로 갱신 — 은 각각 `spec/5-system/12-webhook.md` WH-NF-02 및 WH-SC-05 요구사항 ID 본문과 line-level 로 정합한다. Inbound command `RATE_LIMITED` 에 "(Planned — not yet implemented)" 마킹 추가도 `spec/5-system/14-external-interaction-api.md` §8.4·§726 의 "미구현" 명시와 일치한다. 기능 완전성·비즈니스 로직·에러 시나리오·데이터 유효성 관점에서 결함이 없으며, 미구현 rate-limit 수치(60건/분)는 향후 구현 시 재검토가 필요하다는 점만 주의하면 된다.

## 위험도

NONE
