# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상 scope: refactor 03 m-1 — backend NestJS console.* → Logger 전환 + eslint no-console 가드
관련 plan: `plan/in-progress/refactor/03-maintainability.md` §m-1

---

## 발견사항

### [INFO] plan m-1 파일 목록에 audit-logs.service.ts 잔류 (이미 해소된 stale 항목)
- target 위치: target scope 설명 — "전환 4곳" 열거 (audit-logs.service.ts:85 미포함)
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` §m-1 — "미착수 — … `modules/audit-logs/audit-logs.service.ts:85` …" (5곳 목록)
- 상세: plan 의 m-1 파일 목록은 `audit-logs.service.ts:85` 를 5번째 전환 대상으로 열거하나, 실제 해당 파일은 이미 `Logger` 필드를 보유하고 `console.*` 사용이 없다 (grep 결과 0건, 파일 1번째 줄 Logger import, 11번째 줄 `private readonly logger` 확인). auth-config-webhook-followups 작업 과정에서 선행 해소된 것으로 추정된다. target 이 이 파일을 전환 목록에서 제외한 것은 올바르나 plan 문서가 갱신되지 않아 stale 상태다.
- 제안: plan §m-1 "미착수" 파일 목록에서 `audit-logs.service.ts:85` 를 제거하거나 "(이미 해소)" 로 표기. 본 PR 완료 후 plan 갱신 시 반영 권장. 비차단.

### [INFO] main.ts·code.handler.ts 면제 사유 — plan 에 명시 없으나 개선 방안과 일관
- target 위치: target scope — "면제 5곳(inline eslint-disable + 사유 주석): main.ts:204/206·code.handler.ts:44/50/121"
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` §m-1 — "eslint `no-console` 을 backend src 에 추가(scripts override 제외) … 룰 도입 시 기존 위반 전수 정리가 선행 조건"
- 상세: plan 은 면제 대상으로 "scripts/·instrumentation.ts" 만 파일-레벨 override 로 언급하고, `main.ts`·`code.handler.ts` 는 별도로 다루지 않는다. target 이 이 두 파일을 inline `eslint-disable` + 사유 주석으로 면제 처리하는 방식은 plan 의 "기존 위반 전수 정리가 선행 조건" 요건을 충족하는 올바른 접근이다. bootstrap console.log(main.ts)와 pre-bootstrap IIFE(code.handler.ts)는 Logger DI 적용이 불가능한 구조적 사유가 있으므로 면제 분류가 적절하다. plan 충돌은 없으나 추적 메모 차원에서 기록.
- 제안: plan §m-1 "개선 방안 1" 에 면제 처리 유형을 두 가지로 구분해 명시하면 추후 검토자를 위한 근거가 된다 — "(a) scripts/·instrumentation.ts: 파일 레벨 override, (b) main.ts·code.handler.ts: inline eslint-disable + 사유 주석". 비차단.

### [INFO] telegram renderer 라인 번호 stale (`:416` → `:427`)
- target 위치: target scope — "telegram-message.renderer.ts:427"
- 관련 plan: `plan/in-progress/refactor/03-maintainability.md` §m-1 — "telegram-message.renderer.ts:416"
- 상세: plan 이 `:416` 으로 기록한 라인 번호가 target 에서 `:427` 로 정정됐다. 코드 편집 이력에 따른 라인 이동으로, 전환 대상 파일 자체가 달라진 것은 아니다. 구조적 충돌 없음.
- 제안: plan §m-1 파일 목록의 라인 번호를 `:427` 로 갱신. 본 PR 완료 시 plan 갱신 일괄 반영 권장. 비차단.

---

## 요약

target scope(refactor 03 m-1)는 `plan/in-progress/refactor/03-maintainability.md` §m-1 의 핵심 설계 결정(Option A: Logger 교체 + eslint no-console 추가)을 충실히 따르고 있다. 미해결 결정 우회나 선행 plan 미해소에 해당하는 항목이 없다. 발견된 세 건은 모두 INFO 수준으로 plan 파일 목록의 stale(audit-logs 이미 해소, 라인 번호 drift)과 면제 분류 세분화 메모 권장이며, 어떤 것도 구현 착수를 차단하지 않는다. ai-agent spec §6.2.c.fallback console.warn 정정은 plan 과 target 양쪽 모두 planner 위임(별건)으로 일관되게 처리하고 있어 충돌 없다.

---

## 위험도

NONE
