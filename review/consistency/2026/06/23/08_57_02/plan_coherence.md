# Plan 정합성 Check — spec/2-navigation (M-8 1단계, 구현 완료 후)

## 발견사항

### [INFO] `rotateNotificationSecret` 응답 타입이 TBD 결정을 선점할 가능성

- target 위치: `codebase/frontend/src/lib/api/triggers.ts:181-189` (`rotateNotificationSecret` 함수, 응답 `{ secret: string; rotatedAt: string }`)
- 관련 plan: `spec/2-navigation/2-trigger-list.md §R-2 TBD` — "v1.1 rotate 의 응답 shape (신규 secret 평문 반환 vs masked digest) ... 아직 확정하지 않는다"
- 상세: `lib/api/triggers.ts` 의 `rotateNotificationSecret` 가 `Promise<{ secret: string; rotatedAt: string }>` 로 응답 shape 를 구체적으로 타입화했다. 이는 spec `§R-2 TBD` 가 "평문 반환 vs masked digest 미결정" 으로 명시한 항목과 충돌한다. 다만, 이 함수는 기존 `trigger-detail-drawer.tsx` 에 이미 있던 `apiClient.post(...)` 호출을 typed wrapper 로 추출한 것이므로 새로운 결정을 내린 것이 아니라 기존 구현의 계약을 그대로 이동한 것이다. 실질적인 shape 결정은 구현 이전에 이미 코드에 존재했으므로 본 PR 이 TBD 를 침범하지는 않으나, 타입이 현재 백엔드 응답 shape 를 고정하는 효과가 생긴다. plan `spec/in-progress/trigger-review-deferred-fixes.md` 의 W1(endpoint_path 서버 발급 강제) 도 미해결 상태이며, rotate 경로 논의와 인접하다.
- 제안: 별도 조치 불필요. 단 `rotateNotificationSecret` 함수 JSDoc 에 "v1.1 TBD — 응답 shape 확정 후 타입 재검토 필요" 주석 추가를 INFO 로 기록. plan 변경 불요.

### [INFO] M-8 2단계 "6카드 분리 결정" 이 spec §2.3.1 과 gap

- target 위치: `plan/in-progress/refactor/02-architecture.md §M-8 2단계` 항목 — "현행은 5카드(auth 가 WebhookConfigCard 에 병합) — plan 의 6카드(`AuthConfigCard` 분리)는 UI 구조 변경이라 behavior-preserving 추출과 별개 결정(필요 시 planner/UX)"
- 관련 plan: `plan/in-progress/refactor/02-architecture.md M-8 개선 방안 2` 원안 — "`AuthConfigCard` 분리"
- 상세: plan 원안의 M-8 개선 방안 2 는 `WebhookConfigCard`/`AuthConfigCard`/`ChatChannelCard` 등 6카드 분리를 제시했으나, 현재 구현은 auth 를 WebhookConfigCard 에 병합한 5카드 구조다. 2단계 메모에서 이 차이를 "UI 구조 변경 — 별개 결정" 으로 미룬 상태다. spec `§2.3.1` 은 카드 단위 권한 매트릭스를 규정하며 AuthConfig 카드를 별도로 표현하지만, 이것은 UX 레이아웃 요구사항이 아니라 권한 게이트 명세다. plan 의 6카드 vs 현행 5카드 분기가 플래너/UX 결정으로 남겨져 있어, 향후 2단계 PR 전에 이 결정이 확정되지 않으면 2단계 scope 가 흔들릴 수 있다.
- 제안: 현재 plan 의 2단계 메모("별개 결정") 가 이를 이미 명시하고 있으므로 추가 plan 변경 불요. 다만 플래너에게 6카드 vs 5카드 결정을 2단계 착수 전 확인하도록 plan 에 명시할 수 있다. INFO 수준.

### [INFO] V-10 (트리거 목록 Cron·다음 실행 시각) 미해결과 M-8 1단계 API 레이어 무충돌 확인

- target 위치: `codebase/frontend/src/lib/api/triggers.ts` 및 `triggers/page.tsx`
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md §V-10` — "triggers.service.ts findAll() 이 schedule join 없이 반환" 미결정 잔여
- 상세: V-10 은 백엔드 `findAll()` 이 schedule join 을 하지 않아 목록 행에 Cron/nextRun 이 없는 문제이며, 코드 구현 vs spec 하향이 아직 결정 대기 상태다. M-8 1단계는 이 백엔드 쿼리를 변경하지 않고 기존 응답을 그대로 typed 함수로 래핑만 했으므로 V-10 의 미결 결정과 충돌하지 않는다. V-10 이 코드 구현으로 결정되면 `findAll` 응답 DTO 와 `TriggerListItem` 타입이 확장될 것이므로, 그때 `lib/api/triggers.ts` 의 `list` 함수 반환 타입을 함께 갱신해야 한다.
- 제안: V-10 결정 시 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-10 항목에 "`lib/api/triggers.ts` 의 `TriggerListItem` 타입도 함께 갱신" 후속 체크리스트 추가 권장. INFO 수준.

## 요약

M-8 1단계(lib/api/triggers.ts API 레이어 추출)는 기존 직접 호출을 typed wrapper 로 이동한 behavior-preserving 리팩터링이다. `spec/2-navigation` 의 미해결 결정 — `2-trigger-list.md §R-2 TBD`(rotate v1.1 응답 shape 미확정), `spec-code-cross-audit-2026-06-10.md V-10`(목록 Cron/nextRun 미결) — 과 이번 변경이 우회·충돌하는 항목은 없다. `rotateNotificationSecret` 응답 타입이 TBD 영역을 코드 레벨에서 암묵적으로 고정하는 점과, M-8 2단계의 6카드 vs 5카드 결정이 플래너 확인 대기 상태인 점이 추적이 필요한 INFO 사항이다.

## 위험도

LOW
