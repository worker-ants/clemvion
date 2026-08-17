# 보안(Security) 코드 리뷰

## 범위 및 방법

프롬프트에 포함된 diff 상당수(144개 파일)는 review/consistency 아카이브·spec 문서·이전
라운드 산출물이라, 실질 런타임 코드는 다음에 집중했다: `executions.service.ts`,
`background-runs.service.ts`, `websocket.service.ts`, `sanitize-error-message.ts`,
`redact-stored-error.ts`(+ 각 `.spec.ts`), DTO 3종. 프롬프트에서 diff 가 생략된 파일은
`git diff origin/main...HEAD -- <path>` 로 직접 재확인했다.

## 발견사항

- **[INFO]** `Execution.inputData` 는 egress 값-패턴 마스킹 대상에서 **의도적으로 제외**되어, 워크스페이스 멤버 전원(역할 무관)에게 트리거 파라미터 자유 텍스트에 박힌 자격증명이 원문으로 노출될 수 있다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `MASKED_INPUT_DATA_REASON` 상수, `toResponseExecution`, `toExecutionDto`
  - 상세: Re-run 모달(`useOriginalInput` 기본값 `false`)과 에디터 "히스토리에서 불러오기"가 `Execution.inputData` 를 그대로 재제출 경로에 쓰기 때문에, 값-마스킹을 걸면 리터럴 `'***'` 가 실제 재실행 입력이 되는 기능 오염이 생긴다는 근거로 이번 PR 이 이전 라운드(23_49_05/23_50_03)의 CRITICAL 을 받아 **카브아웃을 되돌린** 결정이다. 트레이드오프는 코드 주석·spec(`14-external-interaction-api.md` 잔여 ②)·CHANGELOG 에 상세히 문서화되어 있고, 주요 벡터(webhook 민감 헤더)는 ingestion 시점에 이미 `[REDACTED]` 로 저장돼 잔여 노출은 "구조화되지 않은 트리거 파라미터 자유 텍스트"로 좁다. `NodeExecution.inputData`(노드 레벨)는 재제출 소비처가 없어 마스킹 대상으로 남겼고(`⑤`·`⑥-b` 테스트로 회귀 캐너리 고정), 이 구분(round-trip 여부)이 코드·spec·프런트 실측(`page.tsx`, `apply-execution-snapshot.ts`)과 정확히 일치함을 직접 확인했다.
  - 제안: 조치 불요(이미 트래커에 "프런트 마스킹 마커 감지 가드 선행 시 재검토" 로 등재됨, `spec-sync-external-interaction-api-gaps.md`). 이 결정 자체를 재론하지 않되, 후속 작업에서 이 카브아웃을 다른 레벨/필드로 확대하지 않도록 `MASKED_INPUT_DATA_REASON` 앵커를 계속 참조할 것.

- **[INFO]** `SECRET_LEAK_PATTERNS` 가 bare `token=`(접두사·접미사 없는 단독 키워드)를 매칭하지 못하는 기존 커버리지 갭 — `access_token`/`refresh_token`/`id_token`/`api_key` 등 한정된 키워드만 잡는다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:33`-`52` (`SECRET_LEAK_PATTERNS`)
  - 상세: 이번 diff 가 만든 결함이 아니라 선존 패턴 갭이며, 새 테스트(`executions.service.spec.ts` `outputData` describe)가 이를 fixture 로 실측해 `Bearer …` 로 교체하고 별건으로 `spec-sync-external-interaction-api-gaps.md` 에 등재했다. 패턴 확장은 이 PR 범위 밖이고 확장 시 회귀 캐너리(`redact-stored-error.spec.ts` 의 "잔여 갭" 캐너리)가 갈릴 것이므로 추적 가능하다.
  - 제안: 조치 불요(이미 백로그 등재). 후속 세션에서 패턴 확장 시 캐너리 갱신 필요.

- **[INFO]** `execution:<executionId>` WS 채널 구독 인가가 워크스페이스 소유(`verifyOwnership`)만 확인하고 역할(role)을 검사하지 않아, 이번 PR 이 강제한 값-마스킹의 수신 인구가 viewer 를 포함한 워크스페이스 멤버 전원이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:395`,`:494`(`verifyOwnership` 호출부), `codebase/backend/src/modules/websocket/websocket.service.ts:372`(JSDoc 근거 서술)
  - 상세: 이 인가 모델은 이번 PR 이전부터 존재했고 변경되지 않았다. 이번 PR 은 오히려 이 사실을 근거로 "내부 wire 도 REST 와 동일 인구이니 마스킹 parity 를 맞춘다"는 방향으로 **보안을 강화**했다(`maskWireEnvelope`). `llmCalls`(에디터 전용 raw LLM 요청/응답)만 wire 값-마스킹에서 예외(`WIRE_PRESERVED_FIELDS`)인데, 이 필드는 fanout 단계에서 `stripExternalOnlyFields` 로 항상 제거되므로 외부 노출은 늘지 않는다. role 미검사 자체는 `plan/in-progress/ie-resume-turn-boundary-cancel.md` 에 이미 트래커 등재돼 있다.
  - 제안: 조치 불요(범위 밖, 이미 등재). 향후 워크스페이스 viewer 역할에 대한 세분화된 RBAC 이 도입되면 `verifyOwnership` 과 `llmCalls` 노출 범위를 함께 재검토할 것.

- **[INFO]** `deepRedactSecrets`/`deepRedactSecretsPreserving` 의 마커 멱등(`MASKED_MARKERS` = `***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 처리가 "이미 마스킹된 값처럼 보이는 정상 데이터"를 재마스킹하지 않고 그대로 통과시킬 가능성이 이론상 있다(우연히 정상 값이 `[REDACTED]` 문자열과 완전히 일치하는 경우).
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:124`-`132`(`MASKED_MARKERS`, `isMaskedMarker`), `:257`-`258`(적용 지점)
  - 상세: 이 판정은 credential-key 로 판별된 값에 대해서만 적용되고(자유 텍스트 값-패턴 매칭에는 적용 안 됨 — `redactSecrets` 는 마커 체크 없이 그대로 정규식을 돌린다), 정상 값이 정확히 `'***'` 문자열인 경우는 어차피 3글자 리터럴이라 정보 가치가 없다. 의도된 설계(webhook ingestion 과 값-마스킹 두 계층이 서로의 마커를 덮지 않기 위함)이고 `.spec.ts` 캐너리로 고정되어 있어 회귀 위험도 낮다.
  - 제안: 조치 불요. 실질적 보안 영향 없음.

- **[INFO]** `explore-tools.service.ts`(workflow-assistant LLM 도구)의 `inputData`/`outputData`/`error` 노출은 `maskSensitiveFields`(키 이름 기반)만 적용돼 자유 텍스트 자격증명이 통과하나, 이번 diff 의 리뷰 대상 파일에 포함되지 않았고 spec(`14-external-interaction-api.md` 잔여 ③)이 "값-패턴 마스킹을 단순 합성하면 안 된다"(접미 힌트 보존 요구사항 충돌)는 근거로 명시적으로 범위 밖으로 뒀다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:462`
  - 제안: 조치 불요(별도 결정 필요 항목으로 문서에 명시).

## 확인한 사항 (긍정적 근거)

- `redactStoredDataForResponse`/`redactStoredErrorForResponse`/`deepRedactSecrets*` 전부 순수 함수·copy-on-change 이며, 입력(엔티티/DB row)을 in-place mutate 하지 않음을 diff·테스트로 확인했다(`redact-stored-error.spec.ts` "입력 객체를 변이하지 않는다" 케이스).
- 새로 추가된 `redactStoredDataForResponse` 관문이 `Execution`/`NodeExecution`/`BackgroundRun` 읽기 표면 6곳(`findById`·`getChain`·`stop`·`toExecutionDto`·`findById`의 `nodeExecutions[]`·`BackgroundRunsService.toNodeExecutionDto`)에 실제로 걸려 있음을 각 파일의 diff 로 직접 대조했다. 표면 누락("자매 중 하나만" 결함 클래스) 없음.
- WS `emitExecutionEvent`/`emitNodeEvent` 두 emit 경로가 신설된 `maskWireEnvelope`/`toFanoutEnvelope` 공통 관문을 공유하도록 리팩터링되어, 세 번째 emit 경로가 생겨도 마스킹이 구조적으로 누락되지 않는 형태다.
- `SECRET_LEAK_PATTERNS`(정규식 6종)를 직접 검토 — 중첩 정량자·모호한 backtracking 유발 구조가 없어(모두 고정폭 lookbehind/lookahead 또는 단순 문자 클래스 반복) ReDoS 위험은 낮다. 이번 diff 는 이 패턴 자체를 바꾸지 않았고 마커 리터럴만 상수로 승격했다.
- `strip-external-only-fields.ts` 의 `__proto__` 프로토타입 오염 방어(`Object.defineProperty` 사용, 스프레드 기반 clone)는 이번 diff 의 영향을 받지 않고 그대로 유지됨을 확인했다.
- diff 전체(143개 파일, +10,455/-121)에 대해 하드코딩된 실제 시크릿 패턴(AWS 키·PEM 헤더·Slack 토큰 등)을 스캔했으나 검출되지 않았다. 테스트 fixture 의 `sk-live-abc123`/`Bearer sk-live-xyz` 등은 명백한 합성 테스트 값이다.
- `Execution.inputData` 비마스킹 결정이 프런트엔드 실제 소비 경로(`ReRunModal`, `toNodeResult`, `apply-execution-snapshot.ts`)와 일치함을 직접 grep 하여 검증 — `execution.inputData` 만 재제출 경로(`ReRunModal`)에 쓰이고 `ne.inputData`(노드 레벨)는 표시 전용임을 확인했다.
- SQL 인젝션·커맨드 인젝션·경로 탐색: 이 diff 는 TypeORM `QueryBuilder`/`repository.find` 만 사용하고 문자열 결합 raw SQL 이 없다. 새 사용자 입력 처리 경로도 없다(순수 응답 egress 마스킹).

## 요약

이번 changeset 은 EIA §R17 마스킹 카탈로그의 잔여 갭(자유 텍스트에 박힌 자격증명이 `NodeExecution`/`Execution` REST 읽기 경로와 WS emit(wire·fanout) 양쪽에서 무마스킹으로 노출되던 문제)을 닫는 **보안 강화** 성격의 PR 이다. 값-패턴 마스킹 관문(`redactStoredDataForResponse`, `maskWireEnvelope`/`toFanoutEnvelope`, `deepRedactSecretsPreserving`)이 표면 누락 없이 일관되게 적용됐음을 코드·테스트(참조 동일성 뮤테이션 검증 포함)로 직접 확인했고, `Execution.inputData` 만 재제출 경로 보호를 위해 의도적으로 카브아웃한 결정도 프런트엔드 실제 소비 코드와 대조해 근거가 유효함을 검증했다. 새로 도입된 취약점(인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화)은 발견되지 않았다. 발견된 항목은 전부 이 PR 이전부터 존재했고 이미 백로그(spec-sync-external-interaction-api-gaps.md 등)에 등재된 알려진 트레이드오프에 대한 참고성 INFO 뿐이다.

## 위험도
NONE
