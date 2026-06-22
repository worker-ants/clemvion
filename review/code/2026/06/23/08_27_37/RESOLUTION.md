# Code Review 후속 처리 (RESOLUTION) — M-8 1단계 2차 (수렴)

리뷰 대상: `refactor(triggers): M-8 1단계 review fix` (commit `ac804f2a`)
처리 일시: 2026-06-23
전체 위험도: **LOW** — Critical 0, **Warning 3**, INFO 14.

1차(`review/code/2026/06/23/08_17_18`) 대비: Warning **7 → 3**. 직전 Testing 3건(W-1/2/3)
**완전 이행 확인**(2차 requirement reviewer 명시). 잔존 3건은 1차에서 이미 M-8 2단계로
defer 합의한 architecture 항목이며, 2차 리뷰도 각 행에 "M-8 2단계 defer 합의됨" 으로 명시.

## 수렴 판정: **CONVERGED**

Critical 0 + 잔존 WARNING 전부 deliberate-defer(M-8 2단계, 근거 기록)로 수렴 기준 충족.
추가 codebase 수정은 review-gate 재무장 루프를 유발하므로 이후 review/** 전용으로 종결.

---

## 잔존 WARNING (M-8 2단계 defer, 조치 불요)

| 출처 | 항목 | 처분 |
|------|------|------|
| **W-1** (Architecture) | `page.tsx queryFn` 의 `Trigger` 뷰모델 매핑 15줄 잔류 | **M-8 2단계** — `useTrigger` hook 추출 시 `lib/mappers/triggers.ts` 이관. API 레이어(1단계)는 매핑 비대상 |
| **W-2** (Architecture) | `TriggerListItem`(raw) ↔ `Trigger`(뷰모델) 타입 이중 선언 | **M-8 2단계** — mapper 분리 시 타입 SoT 통합. 현재 raw/뷰모델 분리는 의도적 |
| **W-3** (Architecture) | `chatChannel`/`notification`/`interaction` `Record<string, unknown>` 오버-와이드 | **M-8 2단계** — behavior-preserving 유지(바디 pass-through, 금지 키 backend 400 차단). 구체 입력 타입 신설은 호출부 변경 수반 |

---

## INFO 처분 (전부 비차단)

- **#1 (SPEC-DRIFT)** — spec §3 typed 카탈로그 note + frontmatter `code:` 등재 → **planner-only**(developer `spec/` read-only). 1차 RESOLUTION 과 동일.
- **#2/#3 (Testing)** — `list` 의 `totalItems`/`page` 단언 + 에러 전파(`mockRejectedValue`) 케이스 → 수용(후속). 핵심 W-1/2/3(getById 4-way·rotate/revoke 이중 언래핑·단일경로)은 이미 커버. 잔여 nit 은 재무장 회피 위해 종결 단계에서 보류, 2단계 테스트 보강 시 동반.
- **#4 (Testing)** — rotate/revoke `res.data` null 예외 경로 → Zod 도입(2단계/별도 이니셔티브) 시 동반 커버.
- **#5/#10/#11 (Testing/Maintainability)** — 테스트 스타일(beforeEach 위치·`(R-4)` 추적코드·void 주석) → 저우선 nit, 관례상 허용 범위.
- **#6/#7 (Documentation)** — `chatChannel*` 필드·`page`/`limit` JSDoc → verbatim 이동 필드 nit, 2단계 정리 시 동반.
- **#8/#9 (Maintainability)** — `TriggerUpdateBody` Record 반복·`getById` 이중 캐스팅 → W-3 와 동근원(2단계 구체 타입)·Zog 도입 시 자연 해소.
- **#12/#13 (API Contract)** — `getById` 이중 envelope 흡수 / `create` void → backend 응답 shape SoT 확정(planner) / 생성 후 UX 확장 시 시그니처 변경(향후).
- **#14 (Security)** — 테스트 fixture `"123456:ABCDEF"` 가 Telegram 토큰 포맷 유사 → 명백한 플레이스홀더(리뷰도 "실제 자격증명 아님" 인정). 저우선, 보류.

---

## 결론

Critical 0, Warning 3(전부 M-8 2단계 defer). 1차 fix 로 triggersApi 유닛 테스트(W-1/2/3)·타입 narrowing·문서 보강 완료, 2차 리뷰가 해소 확인. 잔여는 stage-2/planner-only/pre-existing/nit 분류·근거 기록.
**수렴 종결** — `/consistency-check --impl-done` 후 PR.
