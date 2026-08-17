# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan-lifecycle 관리 작업(완료된 이전 세션 plan 이동)이 이번 기능 diff 에 함께 묶여 있다.
  - 위치: `plan/complete/eia-internal-rest-error-masking.md` (신규, `plan/in-progress/` 에서 이동) / `plan/in-progress/eia-internal-rest-error-masking.md` (삭제) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (`./eia-internal-rest-error-masking.md` → `../complete/eia-internal-rest-error-masking.md` 링크 정정 2곳)
  - 상세: `git diff origin/main...HEAD` 로 직접 대조한 결과 내용은 `status: in-progress → complete` 플래그 전환과 `spec_impact` 2건 추가(`spec/4-nodes/1-logic/12-background.md`, `spec/1-data-model.md`) 외에는 순수 이동이다. PR #1179 로 이미 별도 세션에서 완료·머지된 plan 문서가 `in-progress/` 에 남아 있던 걸 이번 세션이 정리한 것으로, 이번 PR 이 선언한 범위(§A WS emit 값-패턴 마스킹, §B 내부 REST `inputData`/`outputData` 마스킹, §D 표면 수 단일화)와는 직접 관련이 없다. 이 항목은 이미 `23_08_19` 라운드 scope 리뷰가 INFO 로 지적했고 `RESOLUTION.md` 에 "PR 설명에 별개 사유임을 명시" 로 처리 방침이 남아 있다 — 코드 변경 불요, 재확인 결과 상태 변화 없음.
  - 제안: 조치 불요(이미 저위험으로 수용됨). PR 설명·커밋 메시지에 이 plan-lifecycle 정리가 A/B/D 기능 범위와 별개 사유(이전 세션의 lifecycle 누락 정정)임을 한 줄 명시할 것을 재권고.

- **[INFO]** `nodeName` → `nodeLabel` 용어 정정이 이번 마스킹 기능과 무관하게 곁들여 반영됐다.
  - 위치: `spec/5-system/3-error-handling.md:249`(`"nodeLabel": "AI Agent"` 예시 값 정정) / `:258`("정정 (2026-08-17)" 각주 신설) — `spec/5-system/6-websocket-protocol.md` 에도 같은 정정이 있다(diff 생략분, `00_47_01` RESOLUTION.md 기록 확인).
  - 상세: 엔진 emit 이 전수 `nodeLabel` 을 쓰고 `nodeName` 을 쓰는 emit 이 코드베이스에 0건임을 실측해 두 spec 문서의 예시·표를 함께 정정한 drive-by 수정이다. §A/§B/§D 어디에도 명시된 항목은 아니지만, WS spec 을 이미 열어 값-마스킹 캐비엇을 추가하는 김에 발견한 사실 오류를 그 자리에서 고친 것으로 파급 효과가 문서 2곳·각 1줄 수준이라 위험은 낮다.
  - 제안: 조치 불요. 범위 순수성만 보면 별도 plan 항목으로 분리하는 편이 이상적이나, 규모가 작고 근거(실측)가 코드 인접 주석에 남아 있어 지금 형태로도 리뷰 가능하다.

- **[INFO]** `review/code/**` · `review/consistency/**` 아래 대량의 신규 파일(리뷰/일관성 검토 세션 산출물, 100+ 파일)이 이번 diff 의 대부분을 차지한다.
  - 위치: `review/code/2026/08/16/23_08_19/**` · `review/code/2026/08/16/23_50_03/**` · `review/code/2026/08/17/00_23_57/**` · `review/code/2026/08/17/00_47_01/**` · `review/consistency/2026/08/16/22_22_36/**` 외 다수
  - 상세: 이 저장소의 SoT 규약(`CLAUDE.md` "정보 저장 위치")상 코드 리뷰·일관성 검토 산출물은 `review/code/**`·`review/consistency/**` 에 커밋되는 것이 정상 워크플로다(`developer` SKILL 의 REVIEW WORKFLOW 가 구현 완료 후 `/ai-review` + fix 를 상시 승인된 강제 단계로 규정). 즉 이 대량 파일은 스코프 이탈이 아니라 이번 PR 이 거친 반복 리뷰 라운드의 정상 부산물이다.
  - 제안: 조치 불요.

## 요약

`git diff origin/main...HEAD` 로 직접 대조한 실제 코드 변경(`executions.service.ts`, `websocket.service.ts`, `sanitize-error-message.ts`, `redact-stored-error.ts`, `background-runs.service.ts` 및 각 `.spec.ts`)은 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 가 선언한 §A(WS emit 값-패턴 마스킹, `maskWireEnvelope`/`toFanoutEnvelope` 공유 초크포인트)·§B(`Execution`/`NodeExecution`/`BackgroundRun` 의 `inputData`/`outputData` 마스킹을 `error` 와 동일 관문으로 확장, 단 `Execution.inputData` 는 재제출 경로 보호를 위해 의도적 카브아웃)·§D(표면 수·마커 상수를 단일 정본으로 수렴)로 정확히 추적된다. `sanitize-error-message.ts` 의 `deepRedactCore`/`deepRedactObject` 분리는 `preserveKeys`(`llmCalls` wire 예외) 옵션이 기존 depth-0 캐시를 오염시키지 않게 하려는 §A 의 직접 파생이며, `maskIfPresent` 헬퍼·`MASKED_INPUT_DATA_REASON` 상수도 같은 관문 통합 요구의 산물이다. spec 변경 8개 파일(`14-external-interaction-api.md`·`6-websocket-protocol.md`·`12-webhook.md`·`13-replay-rerun.md`·`15-chat-channel.md`·`1-data-model.md`·`3-error-handling.md`·`conventions/node-output.md`)도 전부 이 결정(값-마스킹 범위, `inputData` 카브아웃, chat-channel verbatim 계약과의 우선순위)을 문서화하는 편집이며, 다회의 `/ai-review`·`/consistency-check` 라운드가 이미 CRITICAL 을 소스 추적으로 반증·해소해 온 이력이 CHANGELOG·RESOLUTION.md·plan 문서에 일관되게 남아 있다. 유일하게 선언된 기능 범위 밖 항목은 (1) 이전 세션에서 완료된 plan 문서를 `in-progress/`→`complete/` 로 옮기는 문서 전용 정리와 (2) `nodeName`→`nodeLabel` 용어 정정 drive-by 수정 두 가지로, 둘 다 내용 위험이 낮고 이미 이전 라운드 리뷰에서 검토·수용된 상태다. `review/**` 아래 대량 신규 파일은 이 저장소의 정상 리뷰 워크플로 산출물이라 스코프 이탈로 볼 수 없다. 요청하지 않은 기능 확장(over-engineering), 무관한 임포트·포맷팅 정리, 의도하지 않은 설정 변경은 발견되지 않았다.

## 위험도
LOW
