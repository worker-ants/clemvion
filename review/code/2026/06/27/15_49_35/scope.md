# 변경 범위(Scope) 리뷰

## 작업 의도

브랜치명 및 CHANGELOG 기준으로 이번 작업의 의도는 `GET /api/model-configs/:id/models` 엔드포인트의 `type` 쿼리 파라미터에 런타임 검증(`ParseEnumPipe`)을 추가하는 것이다. 허용값(`chat`·`embedding`) 외 입력은 `400 Bad Request`로 거부하고, Swagger에 `@ApiBadRequestResponse`를 동반 문서화한다.

---

## 발견사항

### [INFO] `PROVIDER_PROBE_THROTTLE` 상수화 — 동일 파일 내 소규모 DRY 리팩토링
- 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.ts` 라인 275–279
- 상세: `previewModels`·`testConnection`·`listModels` 3개 핸들러에 중복으로 인라인 선언돼 있던 `{ default: { limit: 10, ttl: 60_000 } }` 객체를 `PROVIDER_PROBE_THROTTLE` 상수로 추출했다. 이는 본 작업 범위인 `ParseEnumPipe` 추가와 직접적으로 관련이 없는 리팩토링이나, (1) 동일 파일에서 동반 작성된 `MODEL_TYPE_ENUM`("단일 소스 파생" 원칙)과 동일한 동기로 이루어졌고, (2) CHANGELOG 에도 `@Throttle 상수화` 라고 명시적으로 서술되었으며, (3) 코드 표면이 최소한이고 비파괴적이다. 핵심 비즈니스 로직 변경 없이 3줄 치환이라 관리 가능하다.
- 제안: 허용 가능. 단, 향후 이런 "동반 정리"는 CHANGELOG 서술처럼 커밋 메시지에도 명시하는 것을 권장한다.

### [WARNING] `plan/complete/web-chat-loader-queue-replay-arguments.md` — 무관한 태스크 plan 파일 수정
- 위치: `plan/complete/web-chat-loader-queue-replay-arguments.md`
- 상세: 이 파일은 웹채팅 로더 `arguments`-replay 버그 수정(`webchat-queue-replay-arguments` 워크트리)에 속하는 별개 태스크의 산출물이다. 변경 내용은 `spec_impact: []` → `spec_impact: none` 로, 스키마 표기 방식 정정이다. mc-endpoint-hardening 브랜치에 이 파일의 수정이 포함된 것은 작업 범위를 벗어난다.
- 제안: 이 수정은 해당 태스크의 워크트리(`webchat-queue-replay-arguments`)에서 별도로 커밋하거나, 이 PR에서 제거한다.

### [WARNING] `plan/in-progress/refactor/02-architecture.md` — C-2 cluster 4 및 PR #716 머지 완료 기록
- 위치: `plan/in-progress/refactor/02-architecture.md` 라인 1074
- 상세: 이 변경은 `refactor-02-c2-llm-modelconfig` 브랜치(별도 PR #714)와 `mc-test-authz` 브랜치(PR #716)의 머지 완료를 plan에 반영한 것이다. 두 PR은 모두 mc-endpoint-hardening과 다른 브랜치에서 수행된 별도 작업이다. mc-endpoint-hardening 브랜치에서 이 plan 파일을 수정하는 것은 작업 범위를 벗어난다. 특히 `PR 대기` → `PR #714 000d8963 머지 완료`·`PR #716 3e102ed3 머지 완료` 기록은 각 PR/브랜치의 마무리 커밋에서 처리되어야 한다.
- 제안: 이 수정은 각 해당 브랜치 또는 별도 plan 정리 커밋에서 수행한다. 이 PR에서 제거를 검토한다.

### [WARNING] `plan/in-progress/spec-sync-auth-gaps.md` — auth 갭 추적 파일 경로 정정
- 위치: `plan/in-progress/spec-sync-auth-gaps.md` 라인 1193
- 상세: `auth-config-webhook-followups.md` 의 경로를 `in-progress` → `complete` 로 수정하고 "(완료)" 문구를 추가했다. 이는 auth 갭 추적과 관련된 plan 정리로, mc-endpoint-hardening 작업 의도와 무관하다.
- 제안: 이 수정은 `auth-config-webhook-followups` 완료 처리 커밋이나 별도 plan 정리 커밋에서 수행한다. 이 PR에서 제거를 검토한다.

### [INFO] `review/consistency/2026/06/27/15_04_16/SUMMARY.md` — 사전 일관성 검토 산출물
- 위치: `review/consistency/2026/06/27/15_04_16/SUMMARY.md`
- 상세: 신규 파일이지만 이는 구현 착수 전 의무 수행(`consistency-check --impl-prep`) 결과물이다. CLAUDE.md 워크플로우 규약상 정규 절차의 산출물이므로 포함이 적절하다. 내용(BLOCK:NO, Risk LOW, WARNING 1건)도 이번 구현 세션을 허가하는 정상 결과다.
- 제안: 없음. 정상 워크플로우 산출물.

---

## 요약

이번 변경의 핵심 코드 수정(컨트롤러 `ParseEnumPipe` 적용·`MODEL_TYPE_ENUM` 단일 소스화·`@ApiBadRequestResponse` 추가, e2e `type=bogus` 400 검증, CHANGELOG 기재)은 의도된 mc-endpoint-hardening 작업 범위에 부합한다. 그러나 세 개의 plan 파일(`web-chat-loader-queue-replay-arguments.md`·`02-architecture.md`·`spec-sync-auth-gaps.md`)은 각각 다른 태스크(웹채팅 버그 수정·C-2 refactor PR 완료 기록·auth 갭 경로 정정)에 속하는 수정으로, 이 브랜치의 작업 범위와 무관하다. 변경 자체는 비파괴적인 문서·추적 수준의 수정이어서 기능 위험은 없으나, 범위 분리 원칙상 각 해당 브랜치/커밋에서 처리하는 것이 바람직하다. `PROVIDER_PROBE_THROTTLE` 상수화는 동일 파일 내 소규모 DRY 개선으로 CHANGELOG에 명시되어 있어 허용 가능한 수준이다.

## 위험도

LOW
