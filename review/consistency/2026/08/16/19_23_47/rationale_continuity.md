# Rationale 연속성 검토 보고서

## 범위

- target: `spec/5-system/` (diff-base `origin/main`, 실제 변경 파일: `14-external-interaction-api.md`, `6-websocket-protocol.md`)
- 동반 변경(같은 브랜치, 상호 참조 대상): `spec/conventions/secret-store.md`, `spec/1-data-model.md`, `spec/2-navigation/14-execution-history.md`(R-5), `spec/4-nodes/1-logic/12-background.md`
- 실제 diff(`git diff origin/main..HEAD -- spec/5-system/ spec/conventions/secret-store.md spec/1-data-model.md spec/2-navigation/14-execution-history.md spec/4-nodes/1-logic/12-background.md`)를 근거로 분석. 코드 측(`redact-stored-error.ts`, `executions.service.ts`, `background-runs.service.ts`)도 대조해 spec 서술과 실 구현 일치를 확인.

## 검토한 두 개의 실질 변경

1. **`config.interaction.triggerToken` 평문 보관 근거 정정** — 종전 "향후 secret store 통합 검토"(open item) → "`secret-store.md §1` 의 명시적 비대상 예외"(결정 2026-08-16)로 교체.
2. **내부 읽기 경로 마스킹 결정** — 종전 "`Execution.error` 의 내부 REST 원문 비대칭은 미결" → `ExecutionsService`(`findById`/`toExecutionDto`/`getChain`/`stop`) + `BackgroundRunsService` body 노드에 `redactStoredErrorForResponse` 적용(결정 2026-08-16). `6-websocket-protocol.md` §4.1 `execution.snapshot` 행에 이 마스킹 관문 상속 사실을 추가.

## 발견사항

### [INFO] "미결" 항목의 결정 전환이 Rationale 원칙(§3 결정의 무근거 번복 금지)을 모범적으로 준수
- target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 인근 "내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)" 블록
- 과거 결정 출처: 동일 문서 종전 서술 "내부 REST 와의 비대칭은 미결이다"(diff의 `-` 라인, 실행 내역 R-5 를 "결정 시 함께 검토할 재료"로 지목만 하던 상태)
- 상세: 이 블록은 미결 상태를 조용히 종결하지 않고 (a) 결정 날짜 명시, (b) 적용 범위를 "4경로 + body 노드"로 열거(총칭 금지 — "이 문서가 반복해 겪은 실패 형태라 표면을 이름으로 못박는다"고 스스로 명시), (c) `execution-history.md` R-5 의 "boundary masking parity" 원칙을 근거로 원용하되 R-5 자체가 이 필드를 이미 규정한 것은 아니라고 명시적으로 구분, (d) HTTP 에러 envelope 비echo 원칙(§5.3)과 레이어가 다름을 명시, (e) 잔여 갭(WS `execution.node.*` emit 원문, `inputData`/`outputData` 미포함, workflow-assistant 툴의 키-기반 마스킹과의 비단순합성 경고)까지 병기. 실제 구현(`ExecutionsService.toResponseExecution`/`toExecutionDto`, `BackgroundRunsService`)을 대조한 결과 "4곳 + body 노드" 서술과 정확히 일치.
- 제안: 조치 불요. 이 방식(날짜 있는 결정 + 열거형 범위 + 원용 출처 구분 + 잔여 갭 병기)을 향후 유사 "미결 → 결정" 전환의 템플릿으로 참고할 만하다.

### [INFO] `triggerToken` 평문 예외가 secret-store.md 의 총칙과 정합하게 등재됨
- target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 인근 "`config.interaction.triggerToken` 는 JSONB 평문으로 보관하며 … 명시적 비대상 예외"
- 과거 결정 출처: `spec/conventions/secret-store.md` 총칙 "모든 도메인 모듈은 본 convention 의 `SecretResolver` 를 경유해 secret 을 읽고 쓴다"
- 상세: 총칙에 예외를 조용히 어긴 것이 아니라, 같은 PR 에서 `secret-store.md` 총칙 문장 자체에 "§1 하단의 필드 단위 명시적 비대상 예외는 제외" 절을 추가하고, §1 에 `AuthConfig.config`(기존 예외)와 나란히 `Trigger.config.interaction.triggerToken` 신규 예외 블록을 등재했다. 이 블록은 기존 예외와 "같은 종류가 아님"을 명시하고, 근거 (a)(b)(c)를 개별 제시하며, (a)에 대한 반례(해시+timing-safe 비교로도 동일 효과 가능)까지 스스로 인용해 "평문이 불가피"라는 과장을 피했다. 또한 "이 블록을 평문 보관 일반의 선례로 인용하면 안 된다"는 캐비엇으로 향후 다른 필드가 이 문단을 근거로 예외를 얻는 것을 명시적으로 차단 — 기각된 대안의 재도입 위험을 선제적으로 막는 구조.
- 제안: 조치 불요.

### [INFO] 종전 서술 폐기 문구("거짓이라 정정")의 톤이 다소 강하나 근거는 명확
- target 위치: `spec/5-system/14-external-interaction-api.md` — "종전 '향후 secret store 통합 검토' 서술은 의식적 예외로 결정된 이상 거짓이라 정정한다."
- 상세: 표현이 다소 단정적이나("거짓") 실질적으로는 forward-looking placeholder 문구를 명시적 결정으로 대체한 것이며 근거 문서(secret-store.md §1)가 실제로 존재·정합한다. Rationale 연속성 관점에서 문제 되는 "무근거 번복"이 아니라 "근거를 갖춘 정정"이다.
- 제안: 표현 톤은 project-planner 재량 사항이라 본 검토 범위 밖. 조치 불요.

### 교차검증 — 기각된 대안 재도입 여부
- R5(외부 WebSocket 채택 보류), R10(NotificationDispatcher 엔진 내부 직접 호출 기각), R14(scope/audience 403 세분 기각), R-wontdo-rawws-rest(서브프로토콜 인증·in-band 토큰 갱신·WS start/stop 기각) 등 EIA/WS Rationale 에 명시된 기각 대안들은 이번 diff 범위에서 재도입되거나 침해된 흔적이 없다.
- `toTerminalErrorPayload`(§6.4 wire 정규화 함수)를 새 마스킹 경로에 재사용하지 않기로 한 선택은 "형태를 바꾸지 않는다"는 별도 원칙과 일치하며, §6.4 의 종결 이벤트 payload 마스킹(`execution.failed`, 이미 origin/main 에 존재)과 이번 신규 내부 읽기 경로 마스킹을 명시적으로 다른 레이어로 구분해 두 결정이 섞이지 않도록 했다.

## 요약

이번 PR 의 `spec/5-system/` 변경 두 건(triggerToken 평문 예외 등재, 내부 읽기 경로 마스킹 결정)은 모두 과거 `## Rationale`(EIA R17, R-5 원용, secret-store.md 총칙)과 대조했을 때 기각된 대안의 재도입이나 합의 원칙 위반이 없다. 오히려 두 건 모두 "미결/향후 검토" 상태였던 항목을 날짜 있는 새 결정으로 전환하면서, 근거·범위(열거형, 총칭 금지)·잔여 갭·원용 출처의 한계까지 함께 기록해 Rationale 연속성 규약(§3 결정의 무근거 번복 금지)을 적극적으로 충족시키는 사례다. 관련 미러 문서(`secret-store.md`, `1-data-model.md`, `14-execution-history.md` R-5, `12-background.md`)도 같은 커밋 계열에서 동반 갱신되어 SoT 분산으로 인한 drift 위험도 낮다. 코드(`redact-stored-error.ts`, `executions.service.ts`, `background-runs.service.ts`) 대조 결과 spec 서술("4경로 + body 노드")과 구현이 정확히 일치해, "선언했지만 미구현" 류의 문제도 없다.

## 위험도

NONE
