# Plan 정합성 검토 — `spec/4-nodes/4-integration/` (--impl-prep, ssrf-catch-instanceof)

## 발견사항

- **[INFO]** `node-output-redesign/http-request.md`·`database-query.md` 의 catch 서술이 이번 구현 뒤 정밀도가 떨어짐
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 (SSRF 가드 catch) · §6 `HTTP_BLOCKED` 행, `2-database-query.md` §4 SSRF 가드 콜아웃 · §366-384 `DB_HOST_BLOCKED` Rationale — 이 문서들 자체는 이번 plan 이 건드리지 않으며(spec_impact: none), 서술도 여전히 참(§4.2 `INTEGRATION_CALL_FAILED` = "기타 일반 예외" 라는 기존 규약과 정합)이라 target 자체엔 문제 없음
  - 관련 plan: `plan/in-progress/node-output-redesign/http-request.md` 143행 "SSRF 차단 (`assertSafeOutbound*` catch `:348-376`, `HTTP_BLOCKED`)" · `database-query.md` 149행/161행 "SSRF host guard → `DB_HOST_BLOCKED`" / "공용 가드의 plain Error 를 `IntegrationError('DB_HOST_BLOCKED')` 로 승격"
  - 상세: 두 문서는 코드 재검증(6차 갱신, 2026-06-25) 시점 기준 "가드가 던진 것은 무엇이든 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 로 승격된다" 고 적었다. `ssrf-catch-instanceof.md` 가 구현하려는 변경은 이 catch 를 `instanceof SsrfBlockedError` 로 갈라 비-판정 오류를 `INTEGRATION_CALL_FAILED`(HTTP)/승격된 `INTEGRATION_CALL_FAILED`(DB)로 보내므로, 구현 후에는 두 노트의 "무엇이든" 서술이 더 이상 정확하지 않다. 다만 이 두 문서는 "결정 필요" 항목이 아니라 주기적으로 전수 재검증되는 감사(audit) 아카이브이고(각 파일 최상단 "N차 갱신" 블록이 SoT), 이번 변경으로 노드의 spec 계약이나 output 구조 자체가 바뀌는 것도 아니다(§5 출력 구조 JSON 예시·에러 코드 표는 무영향 — `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 는 여전히 판정 시 그 코드를 낸다).
  - 제안: 블로킹 아님. 다음 node-output-redesign 전수 재검증(코드 재검증 라운드) 때 이 두 줄만 반영하면 충분하다. `ssrf-catch-instanceof.md` 자체 체크리스트에 이 followup 을 추가할 필요는 없음(대상 문서가 이미 스스로 "N차 갱신" 방식으로 주기 갱신되는 문서라 개별 PR 마다 동기화 의무를 두지 않는 관례).

## 정합성 확인 (문제 없음으로 판정한 항목)

- 소스 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 4919-4923행의 "SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로" 항목이 `ssrf-catch-instanceof.md` 로 정확히 파생됐고 여전히 미체크 상태 — 중복 착수나 이미 해소된 항목 재작업 아님.
- 같은 트래커의 인접 미해결 결정 두 건은 이번 plan 과 스코프가 명확히 분리된다: (1) 4903행 "LLM/S3 `ssrf.util.ts` 의 CGNAT/`::` 차단 여부" 는 다른 파일(`ssrf.util.ts`, LLM/S3 전용)이라 `http-safety.ts` 4개 소비자와 무관. (2) 4910행 "공용 가드 `http-safety.ts` 를 `http-request/` 밖으로" 는 `ssrf-catch-instanceof.md` §비대상 에서 명시적으로 "트래커의 별 항목(spec `code:` 동반 변경이라 planner 필요)" 으로 제외해 뒀다 — 일방적으로 그 결정을 선취하지 않는다.
- SMTP 가드(`smtp-host-guard.ts`)가 이미 판정/비판정을 가른다는 전제는 `plan/complete/ssrf-guard-integration-unify.md` 로 선행 완료돼 있다 — 이 plan 이 가정하는 사전 조건은 이미 해소된 상태.
- 코드 조회로 실측: 새로 쓰려는 catch-all fallback 코드(`INTEGRATION_CALL_FAILED`)는 `0-common.md` §4.2 에 "기타 일반 예외(분류되지 않은 실패)" 로 이미 정의돼 있고, tester 쪽 fallback 코드(`HTTP_CONNECT_FAILED`/`DB_CONNECT_FAILED`)도 `spec/2-navigation/4-integration.md` §5.5 에 "그 밖(네트워크·타임아웃·TLS 등)" 으로 이미 문서화돼 있다 — 신규 코드/신규 결정을 만들지 않고 기존에 정의된 fallback 경로를 재사용하는 변경이라 spec 정합성 리스크가 낮다.
- Cafe24·MakeShop 핸들러는 `http-safety.ts`/`assertSafeOutboundUrl`/`SsrfBlockedError` 를 전혀 참조하지 않음(코드 grep 확인) — 트래커가 말하는 "넷" 이 실제 소비자 전수와 일치하며, 스코프 밖에 남는 다섯째 소비자는 없다.
- 그 외 `plan/in-progress/**` 를 SSRF·integration 키워드로 전수 스캔한 결과, 이번 target 변경(코드 전용, spec 불변)과 충돌하는 "결정 필요" 항목이나 선행 미해소 전제는 발견되지 않았다.

## 요약

`ssrf-catch-instanceof.md` 는 소스 트래커(`spec-draft-nullable-notation-followups.md`)의 명시적 미해결 항목을 그대로 이어받고, 인접한 두 미해결 결정(LLM/S3 가드, 공용 가드 파일 위치 이전)을 스코프에서 명확히 배제해 뒀다. spec 은 `spec_impact: none` 그대로이며 코드가 재사용하려는 fallback 에러 코드(`INTEGRATION_CALL_FAILED`/`HTTP_CONNECT_FAILED`/`DB_CONNECT_FAILED`)는 모두 기존 spec 에 이미 정의돼 있어 새 계약을 만들지 않는다. 유일하게 발견된 것은 `node-output-redesign/` 의 두 노드 문서가 인용한 catch 동작 서술이 구현 후 정밀도가 떨어진다는 INFO 성격의 후속 메모이며, 이는 그 문서 자체의 주기적 "N차 갱신" 관례로 흡수 가능해 이번 plan 을 막을 이유가 되지 않는다.

## 위험도

LOW
