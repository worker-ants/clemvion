# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
검토 대상: Cafe24 background refresh cron 주기 단축 (24h → 6h) + cutoff 마진 격상 (`REFRESH_PROACTIVE_THRESHOLD_DAYS` 10일 → 7일)
변경 파일: `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts`, `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
Plan: `plan/in-progress/cafe24-bg-refresh-tuning.md`

---

## 발견사항

- **[WARNING]** `REFRESH_PROACTIVE_THRESHOLD_DAYS` 값 번복 — spec Rationale 갱신 없이 구현 착수
  - target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` §변경 범위 1), §결정 사항; 구현 예정 파일 `cafe24-token-refresh.constants.ts:36`
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` 항목 "`cafe24-background-refresh` 10일 임계 (2026-05-16)"
  - 상세: 기존 Rationale 은 "14일 유효 - 4일 안전 마진 = **10일**" 로 값을 근거 있게 확정했다. 짧은 cutoff 에 대한 위험("더 짧게... Cafe24 leaky bucket 에 불필요한 부담")과 긴 cutoff 에 대한 위험("더 길게 (예: 12일) 잡으면 안전 마진 부족")을 모두 명시하며 **10일을 균형점으로 선택**했다. 본 plan 은 cutoff 를 7일로 변경하고 새로운 근거("14일/2 = 50% 마진, 6h cron 누락 흡수")를 plan 문서에만 기록하며, **spec `## Rationale` 의 대응 항목은 갱신하지 않은 채 구현을 착수**한다. plan 후속 항목에 "project-planner 위임"이라 명시되어 있으나, spec 과 코드가 불일치한 상태로 구현이 시작된다. CLAUDE.md 정책상 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"에 있어야 한다.
  - 제안: 구현 착수 전에 project-planner 를 통해 `spec/2-navigation/4-integration.md` `## Rationale` 의 "`cafe24-background-refresh` 10일 임계" 항을 7일로 갱신하고 새 근거를 기록한다. 또는 plan 에서 이 변경을 "spec Rationale 갱신 완료 후 구현"의 선결 조건으로 명시한다.

- **[INFO]** 6h cron 주기 도입 — Rationale 에 명시적 전례 없으나 원칙 위반 아님
  - target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` §변경 범위 2), §결정 사항
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` "`cafe24-background-refresh` 10일 임계 (2026-05-16)"
  - 상세: 기존 Rationale 에서 "더 짧게 (예: 매일) 잡으면 Cafe24 leaky bucket 에 불필요한 부담"의 "더 짧게"와 "매일"은 **cutoff 임계 값**(threshold days)이 하루 단위로 짧아지는 경우를 가리키는 표현이며, cron 실행 빈도를 가리키는 것이 아니다. cutoff 가 `lastRotatedAt < now - THRESHOLD`로 동작하므로 cron 빈도와 leaky bucket 부담의 직접 연결은 없다 — 실행 시 실제 refresh 대상 통합 수는 cutoff 가 결정하며 cron 빈도는 안전 마진에만 영향을 준다. 따라서 6h 주기는 기존 Rationale 이 명시적으로 기각한 대안이 아니다. 다만 spec 에는 "일일 잡"이라는 표현이 남아 있어 외형 불일치가 생긴다. spec 갱신 시 cron 주기도 함께 명시 권장.

- **[INFO]** scheduler ID `'cafe24-background-refresh-daily'` 보존 — Rationale 과 무관, 운영 결정
  - target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` §결정 사항, §변경 범위 2)
  - 과거 결정 출처: 해당 없음 (BullMQ 운영 관행, spec Rationale 에 미기록)
  - 상세: ID 변경 시 Redis orphan 위험을 회피하기 위해 ID 를 그대로 유지하고 코멘트로 실제 주기를 명시하는 방식은 실용적 결정이며, 기존 spec Rationale 과 충돌하지 않는다. 다만 "daily" 라는 명칭과 "every 6h" 실제 동작 사이의 불일치가 향후 혼란 가능성이 있다. spec 갱신 시 이 역사적 이름에 대한 주석도 spec 에 포함하면 좋다.

---

## 요약

본 구현 대상의 핵심 변경(cutoff 10일 → 7일, cron 24h → 6h)은 기존 spec Rationale 에서 **명시적으로 기각된 대안을 재도입하거나 invariant 를 위반하지 않는다**. 6h 주기는 Rationale 미기록 영역이고, 7일 cutoff 는 기존 Rationale 이 10일로 확정한 결정을 변경하는 것이나 "7일 을 기각"한 기록은 없다. 그러나 spec `## Rationale`의 "`cafe24-background-refresh` 10일 임계 (2026-05-16)" 항은 여전히 10일 근거만 기록하고 있는 상태에서 구현이 착수되며, plan 후속 항목에서 spec 갱신을 project-planner 에게 위임하기로 했다. 이는 단일 진실 원칙(spec 이 SoT) 관점에서 spec-code 불일치 구간이 생기는 **절차상 문제**로, 구현 착수 전 spec Rationale 갱신을 선결하거나 적어도 plan 에 강제 선결 조건으로 명시할 것을 권장한다.

---

## 위험도

MEDIUM
