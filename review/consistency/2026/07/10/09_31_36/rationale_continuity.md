# Rationale 연속성 Check — 결과

## 검토 대상 정정 안내

프롬프트에 임베드된 target 본문은 `spec/data-flow/` 전체(구조 문서)를 그대로 붙여넣은 template anchor였고, 이번 브랜치의 실제 diff(`git diff origin/main...HEAD`)에는 `spec/**` 변경이 전혀 없다. 실제 변경은 코드 전용:

- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — `redactSecrets`(shared SoT) 를 추가 적용해 stack-trace/connection-string 제거에 더해 secret 토큰(Bearer/API key/Authorization 헤더 등) 값-패턴 마스킹을 추가.
- `codebase/backend/src/modules/schedules/schedule-runner.service.ts` — `schedule_failed` 알림 메시지에도 동일 `sanitizeErrorMessage` 적용(선행 review-fix, WARNING 처분 완료).
- 신규/보강 테스트 2개 파일 (`sanitize-error-message.spec.ts` 신설, `schedule-runner.service.spec.ts` 케이스 추가).
- `review/code/2026/07/10/09_17_14/**`, `review/code/2026/07/10/09_29_31/**` — 선행 `/ai-review` 산출물(이미 Critical 0 / Warning 처분 완료로 종결).

따라서 본 검토는 위 실제 diff를 대상으로 수행했다. `spec/` 자체는 변경되지 않았으므로, "target 이 spec Rationale 을 뒤집는가"가 아니라 "이 코드 변경이 기존 spec Rationale 에 이미 박힌 결정·원칙과 충돌하는가"를 확인하는 방식으로 접근했다.

## 대조한 과거 결정 소스

- `spec/5-system/14-external-interaction-api.md` R17 (`conversationThread`/`ai_message` egress 마스킹 — `shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 을 SoT로 재사용, "보안 우선으로 rare FP 수용" 원칙)
- `spec/5-system/11-mcp-client.md` (MCP 에러 메시지 마스킹도 동일 공용 SoT 재사용 + "별도 redaction 로직을 새로 두지 않는다" 원칙)
- `spec/5-system/6-websocket-protocol.md` "`ai_message.llmCalls[]` 외부 수신자 strip" 항목의 **기각된 대안**("값-레벨 마스킹은 에디터 디버깅 가치를 훼손") — 필드/위협모델이 다른지 확인
- `spec/5-system/12-webhook.md` "민감 헤더 마스킹 시점" 항목의 **기각된 대안**(display-시점 마스킹 기각, ingestion-시점 마스킹 채택) — 시점 원칙이 다른지 확인
- `spec/data-flow/3-execution.md` §1.3 (`background_failed` 는 "sanitize 된 error message" 를 이미 전제)
- 사용자 MEMORY `reference_shared_secret_redaction_sot.md` — "에러 메시지 토큰 마스킹은 `shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` 재사용, 새로 구현 금지(특수 케이스만 얇게 추가)"

## 발견사항

### INFO — 새 마스킹 결정이 spec Rationale 에는 기록되지 않고 코드 주석에만 있음
- target 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` 헤더 docstring, `codebase/backend/src/modules/schedules/schedule-runner.service.ts` L240-243 인라인 주석
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R17 (본 diff 주석이 "EIA §R17 잔여 하드닝"으로 직접 인용)
- 상세: `execution_failed`/`background_failed`/`schedule_failed` 3개 실패-알림 경로 모두에 secret 값-패턴 마스킹을 적용하는 것은 실질적으로 새로운 보안 결정(제안 범위 확장)인데, 이 결정의 근거는 코드 주석에만 있고 `spec/data-flow/8-notifications.md`(`schedule_failed`/`execution_failed`/`background_failed` 카탈로그 표가 있는 문서) 또는 `spec/5-system/4-execution-engine.md` 어디에도 대응 Rationale 항목이 없다. R17 은 **EIA(외부 채널 end-user 공개 표면)** 에 대한 결정이고, 이번 변경은 **워크스페이스 admin/owner 대상 in-app+email 알림**(신뢰된 내부 수신자)이라 위협모델이 다르다 — 유사 원칙의 합리적 확장이지만 spec 상으로는 근거가 연결돼 있지 않다. CLAUDE.md 의 "정보 저장 위치" 표는 "결정의 배경·근거"를 해당 spec 문서 끝 `## Rationale` 에 두도록 명시한다.
- 제안: 필수는 아니나, `spec/data-flow/8-notifications.md` `## Rationale` 에 짧은 항목(예: "실패 알림 message 의 secret 마스킹 — shared SoT 재사용, 3개 경로(execution/background/schedule) 통일")을 추가해 코드 주석 근거를 spec 측에도 연결해두면 이후 검토자가 R17 과의 관계를 spec 만으로 추적할 수 있다.

## 정합성 확인 (충돌 없음으로 판정한 근거)

1. **기각된 대안의 재도입 여부** — 없음. `spec/5-system/6-websocket-protocol.md` 의 "값-레벨 마스킹 기각"은 `ai_message.llmCalls[]`(LLM raw request/response, 에디터 디버깅 전용 필드)에 한정된 결정이며, 이번 변경은 실패 알림의 자유 텍스트 `message` 필드에 대한 것으로 대상 필드·문서화된 기각 사유("디버깅 가치 훼손") 어느 쪽도 적용되지 않는다. `spec/5-system/12-webhook.md` 의 "display-시점 마스킹 기각"도 오히려 이번 변경(알림 레코드에 쓰기 직전 = ingestion-시점 마스킹)과 원칙이 같은 방향이라 재도입이 아니라 정합.
2. **합의된 원칙 위반 여부** — 없음. 오히려 두 개의 명시 원칙을 정확히 준수한다: (a) `spec/5-system/11-mcp-client.md`/`14-external-interaction-api.md` R17 이 확립한 "공용 `SECRET_LEAK_PATTERNS`/`redactSecrets` 를 재사용하고 별도 redaction 로직을 새로 두지 않는다" 원칙 — 실제로 `execution-engine/sanitize-error-message.ts` 는 자체 정규식을 만들지 않고 `shared/utils/sanitize-error-message.ts` 의 `redactSecrets` 를 import 해 재사용한다(신규 패턴 0개 추가). (b) 사용자 MEMORY 의 동일 SoT 재사용 규칙과도 일치.
3. **결정의 무근거 번복 여부** — 없음. 과거 어떤 결정도 뒤집지 않는 순수 additive 방어 심도 강화다. `execution_failed`/`background_failed` 이미 sanitize 를 전제하던 문서 기술(`spec/data-flow/3-execution.md` §1.3)과도 모순 없이 그 sanitize 범위를 넓히는 것뿐이다.
4. **암묵적 가정 충돌 여부** — 없음. `spec/5-system/4-execution-engine.md` §7.5.2 의 "내부 error.message 는 client 에 노출하지 않는다"는 client-facing typed error 계약과는 별개 경로(그쪽은 WS continuation ack, 이쪽은 알림 메시지)이며 상충하지 않는다. `secret_store`/`SecretResolverService` 관련 invariant(`spec/conventions/secret-store.md`)도 이 변경이 다루는 "echo 된 secret 텍스트 마스킹"과는 다른 계층(저장이 아니라 표출)이라 우회하지 않는다.
5. 선행 `/ai-review` 산출물(`review/code/2026/07/10/09_17_14/`, `09_29_31/`)이 이미 이 diff를 security/testing 관점에서 검토해 Critical 0, Warning 1건(schedule-runner 누락)을 식별·수정 완료했고, 이번 diff는 그 review-fix 를 포함한 최종 상태다.

## 요약

이번 브랜치의 실제 변경은 spec 을 전혀 건드리지 않는 코드 전용 defense-in-depth 강화이며, 새로 도입한 secret 마스킹은 기존 spec Rationale(EIA §R17, MCP client 공용 SoT 재사용 원칙)과 정확히 같은 패턴을 재사용해 확장한 것으로, 과거에 명시적으로 기각된 대안을 재도입하거나 합의 원칙을 위반하는 지점은 발견되지 않았다. 유일한 보완 여지는 이 결정의 근거가 코드 주석에만 있고 대응 spec 문서(`spec/data-flow/8-notifications.md` 등)의 `## Rationale` 에는 반영되지 않았다는 점으로, 프로젝트의 "결정 근거는 spec Rationale에" 관례상 짧은 sync 항목 추가를 권장하나 차단 사유는 아니다.

## 위험도

NONE
