# 요구사항(Requirement) Review

## 발견사항

### 1. **[INFO]** 웹훅 429 rate limit 설명 수정 — spec 과 정합

- 위치: `triggers.en.mdx` line 37 / `triggers.mdx` line 535
- 상세: 기존 문서는 "60 req/min per-trigger rate limit" 으로 표기했으나, spec/5-system/12-webhook.md WH-SC-05 및 §8 보안 고려사항 표·Rationale 에서 현행 구현은 "글로벌 throttler **100 req/min**" 으로 명시돼 있다. 변경 후 문서("Exceeded the global 100 req/min rate limit" / "글로벌 100 req/min rate limit 초과")가 spec 과 정합하므로, 이번 수정은 올바른 수정이다.
- 제안: 추가 조치 불필요. 수정 방향이 spec 의 권위 있는 내용(WH-SC-05, §8 Rate Limiting 항목)과 일치한다.

### 2. **[INFO]** inbound 429 RATE_LIMITED 미구현 표기 추가 — spec 과 정합

- 위치: `triggers.en.mdx` line 46 / `triggers.mdx` line 544
- 상세: 기존 문서는 "More than 60 inbound commands per minute per execution" 단독으로 표기했으나, spec/5-system/14-external-interaction-api.md §5.1 표의 429 항목은 "**미구현 (Planned)**: 현재 `/interact`·status 조회에 per-execution rate-limit 이 적용되지 않아 본 코드는 발생하지 않는다" 고 명시한다. 변경 후 문서에 "(Planned — not yet implemented)" / "(미구현 — 예정)" 을 추가한 것은 spec 사실과 정확히 일치하며, 사용자 혼란(현재 실제로 발생하지 않는 오류 코드를 구현된 것으로 오해)을 방지하는 올바른 수정이다.
- 제안: 추가 조치 불필요.

### 3. **[INFO]** 웹훅 per-trigger rate limit 값(60 req/min)은 문서에만 남아 있음 — spec 에 per-trigger 별도 한도는 없음

- 위치: `triggers.en.mdx` line 46 / `triggers.mdx` line 544 (변경 전 "60 inbound commands" 숫자 유지)
- 상세: inbound interact의 "60건/분" 숫자 자체는 spec/5-system/14-external-interaction-api.md §8.4 Rate limit 표("Inbound 명령 (`/interact`) | execution 당 분당 60 | **미구현 (Planned)**")에 정의되어 있으므로 수치 자체는 spec 과 일치한다. 수정된 문서가 "More than 60 inbound commands per minute per execution (Planned — not yet implemented)"로 이 숫자를 유지한 것은 spec 의 계획된 한도를 올바르게 반영한다.
- 제안: 추가 조치 불필요.

## 요약

이번 변경은 두 언어(영문·한국어) 의 트리거 문서를 spec 사실에 맞게 정정한 것이다. (1) 웹훅 수신 rate limit 을 잘못된 "60 req/min per-trigger" 에서 spec 확정값인 "global 100 req/min" 으로 수정했고, (2) inbound interact 의 `RATE_LIMITED` 429 코드에 미구현(Planned) 표기를 추가해 현행 구현 상태를 정확히 반영했다. 두 수정 모두 spec/5-system/12-webhook.md (WH-SC-05, §8, Rationale) 및 spec/5-system/14-external-interaction-api.md (§5.1 표, §8.4 Rate limit 표) 와 line-level 로 일치하며 기능 완전성, 비즈니스 로직, spec fidelity 관점에서 결함이 없다. TODO/FIXME/엣지케이스 처리 미비 사항도 없다.

## 위험도

NONE

STATUS: SUCCESS
