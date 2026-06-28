# 요구사항(Requirement) 리뷰

## 발견사항

### **[INFO]** Webhook 429 rate limit — 글로벌 100 req/min 수정은 spec 과 정합
- 위치: `triggers.en.mdx` diff L48 / `triggers.mdx` diff L92
- 상세: 기존 "분당 60건 per-trigger" → "인스턴스 전역 글로벌 100 req/min" 수정. spec/5-system/2-api-convention.md §7 표의 "Webhook 수신 | 100 req/min (글로벌 throttler `default`)" 및 spec/5-system/12-webhook.md WH-SC-05("현행 구현: 글로벌 throttler **100 req/min**")와 정확히 일치. 수치 변경은 실제 구현을 반영한 문서 보정이며 비즈니스 로직 결함 없음.
- 제안: 추가 조치 불필요.

### **[INFO]** Webhook 본문 크기 — 공개 32KB / 인증 1MB Planned 분리 임계 수정은 spec 과 정합
- 위치: `triggers.en.mdx` diff L37 / `triggers.mdx` diff L81
- 상세: "최대 1MB" 단일 한도 → "공개 webhook 32KB (`PUBLIC_WEBHOOK_BODY_TOO_LARGE`) / 인증 webhook 1MB Planned" 수정. spec/5-system/12-webhook.md WH-NF-02("공개(`auth_config_id IS NULL`) webhook 32KB … 인증 webhook 의 **1MB 게이트 … 미구현 (Planned)**")와 에러 코드·경계값 모두 line-level 일치. 413 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`는 spec §6("초과 시 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`")에서 확인됨.
- 제안: 추가 조치 불필요.

### **[INFO]** Inbound command RATE_LIMITED 에 미구현 마킹 추가 — spec 과 정합
- 위치: `triggers.en.mdx` diff L57 / `triggers.mdx` diff L101
- 상세: `429 RATE_LIMITED` 에 "(Planned — not yet implemented)" 마킹 추가. spec/5-system/14-external-interaction-api.md §5.1 표에 "미구현 (Planned): 현재 `/interact`·status 조회에 per-execution rate-limit 이 적용되지 않아 본 코드는 발생하지 않는다" 로 명시돼 있어 정합. 수치 60건/분은 EIA-NX-11(outbound)과 혼재할 수 있으나 inbound 는 현행 구현에서 발생하지 않으므로 문서에 구체 수치가 있어도 "Planned" 마킹으로 충분히 맥락이 전달됨.
- 제안: 추가 조치 불필요. 향후 inbound rate-limit 구현 시 60건/분 수치 재확정 필요 (plan/in-progress/spec-sync-external-interaction-api-gaps.md 에서 추적 중).

### **[INFO]** review/code/2026/06/28/12_28_46/ 메타 파일들 (RESOLUTION.md, SUMMARY.md, _resolution_log.md, _resolution_state.json, _retry_state.json)
- 위치: review/code/2026/06/28/12_28_46/
- 상세: 이전 리뷰 세션의 산출물 파일. 코드·spec 변경 없이 추적 산출물 저장만. 기능·요구사항에 영향 없음.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 순수 MDX 문서(영문/한국어 triggers.en.mdx, triggers.mdx) 수정으로, 실제 API 코드나 비즈니스 로직 변경이 없다. 변경된 두 항목 — (1) Webhook 429 rate limit 수치를 "per-trigger 60" 에서 "global 100 req/min" 으로 수정, (2) 본문 최대 크기를 "1MB" 단일 기준에서 "공개 32KB / 인증 1MB Planned" 분리 임계로 수정 — 은 모두 spec 권위 문서(spec/5-system/12-webhook.md WH-SC-05 · WH-NF-02 · §6, spec/5-system/2-api-convention.md §7)와 line-level 정합이 확인됐다. Inbound command RATE_LIMITED "(Planned)" 마킹도 spec/5-system/14-external-interaction-api.md §5.1 의 "미구현" 명시와 일치한다. 기능 완전성·에러 코드·기본값·검증 규칙 모두 spec SoT 에서 이탈 없음. 비즈니스 로직 결함, TODO/FIXME, 엣지 케이스 누락이 발견되지 않았다.

## 위험도

NONE
