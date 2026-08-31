# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `spec/5-system/6-websocket-protocol.md` §4 절 재배치(중복 `4.4` 헤딩 해소) + `spec/5-system/14-external-interaction-api.md` §8.2 HMAC 화이트리스트 정정(`hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512`)은 5개 checker 전원이 CRITICAL/WARNING 0건, 위험도 NONE 으로 판정한 순수 문서 정합화(spec-vs-spec, spec-vs-Rationale, spec-vs-plan, spec-vs-code drift 해소)이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | scope 밖 코드 변경 혼입 | `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` + 신규 `.swagger.spec.ts` (swagger.md §2-4 401 문서화 보강, 이번 target 인 `spec/5-system/` 과 무관) | 조치 불요. 병합 전 이 파일들이 이번 plan 항목의 의도된 산출물인지만 확인 |
| 2 | cross_spec | §4 재번호 전역 앵커 무결성 실측 확인 | `6-websocket-protocol.md` §4.3~§4.7, 이를 참조하는 `spec/**` 10여개 파일 | 조치 불요 — 정보성. `data-flow/8-notifications.md` 의 사전 dangling 앵커 하나가 이번 재번호로 부수적으로 유효해짐 |
| 3 | cross_spec / naming_collision | HMAC `hmac-sha512` 화이트리스트 확장이 기존 구현·자매 spec(`12-webhook.md` §4.2)과 정합 | `14-external-interaction-api.md` §8.2 | 조치 불요 |
| 4 | rationale_continuity | §4 재번호는 2026-08-24 유예된 결정의 실행, HMAC §8.2 정정은 같은 문서 §R12 와의 drift 해소 | `6-websocket-protocol.md` §4, `14-external-interaction-api.md` §8.2 | 조치 불요 — 과거 Rationale 번복 없음 |
| 5 | convention_compliance | 절 번호 정리가 "고빈도 인용 절 보존 + 저빈도 절만 이동" 패턴을 따름 | `6-websocket-protocol.md` §4 전체 | 조치 불요 — 향후 유사 재번호화 시 참고 |
| 6 | convention_compliance | HMAC whitelist 정정이 같은 문서 §R12·EIA-NX-03·`notification-config.dto.ts` 구현과 내부 정합 | `14-external-interaction-api.md` §8.2 | 조치 불요 |
| 7 | plan_coherence | `spec-sync-websocket-protocol-gaps.md` 의 미해결 결정 3건(`auth.token_expired`/`system.maintenance`/server ping)을 target 이 우회하지 않고 `_(계획·미구현)_` 유지 | `6-websocket-protocol.md` §4.6 테이블/Rationale | 조치 불요 — 별도 planner 턴에서 결정 선행 필요 |
| 8 | plan_coherence | `--spec` 사전 게이트 스킵의 보상 그물(`--impl-done` 필수 실행)이 바로 이번 라운드 | `14-external-interaction-api.md`, `6-websocket-protocol.md` | 조치 불요 — 이 라운드 완주로 종결 |
| 9 | plan_coherence | 재넘버링 잔존 참조 plan 자체 4라운드 sweep + 독립 재확인, 잔존 0 | `6-websocket-protocol.md` §4.3~§4.7 | 조치 불요 |
| 10 | naming_collision | `v2=` 서명 스킴 prefix 와 `notification_secret_v2` DB 컬럼의 이름 겹침을 target 문서가 스스로 disambiguation | `14-external-interaction-api.md` §8.2 | 조치 불요 — 좋은 선례 |
| 11 | naming_collision | §4.4 중복 헤딩(origin/main 선재 결함)을 target 이 해소, 전역 cross-ref 재검증 결과 잔존 불일치 없음 | `6-websocket-protocol.md` §4 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 문서 위생 수정. 전역 앵커 무결성 실측 확인, cross-spec 모순 없음. scope 밖 코드 혼입 1건은 정보성 |
| rationale_continuity | NONE | §4 재번호는 기 유예 결정의 실행, HMAC 정정은 같은 문서 R12 와의 drift 해소. Rationale 번복 없음 |
| convention_compliance | NONE | `spec/conventions/**` 위반 없음. 오히려 기존 drift(중복 절 번호, R12 대비 불일치) 해소 방향 |
| plan_coherence | NONE | `spec-sync-external-interaction-api-gaps.md`/`spec-sync-websocket-protocol-gaps.md` 와 완전 정합. 미해결 결정 우회 없음, 보상 그물 정상 작동 |
| naming_collision | NONE | 신규 식별자 도입 없음(spec-vs-code drift 정정 + 절 번호 재정렬뿐). 잔존 stale 참조 없음 |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 조치 불요)
2. 병합 전 `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` + 신규 `.swagger.spec.ts` 가 이번 plan 항목의 의도된 산출물인지 확인 (cross_spec INFO #1).
3. `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 의 미해결 결정 3건(`auth.token_expired`/`system.maintenance`/server ping)은 별도 planner 턴에서 결정을 선행한 뒤 착수.
