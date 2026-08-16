# API 계약(API Contract) 코드 리뷰

## 리뷰 범위

이번 diff 의 실질 코드 변경은 3개 파일이다 — 나머지(plan/`review/consistency/**`/이전 라운드 `review/code/09_51_00/**`)는 추적 문서·직전 리뷰 산출물이라 API 계약 판단에는 부차적이다.

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `toTerminalErrorPayload`(EIA §6.4 `execution.failed` 의 `error` 를 wire 형태로 정규화하는 함수)의 모든 반환 경로에 `redactTerminalError`(신설)를 씌워 `message`/`details` 에 `deepRedactSecrets` 를 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 8건 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만, 런타임 로직 무변경
- `CHANGELOG.md` — 위 wire 변화를 고지하는 `## Unreleased` 항목 신설

이 payload 는 WS(`execution:<id>` 채널)·SSE 스트림(§5.2)·EIA outbound webhook(§3.3, 외부 제3자)으로 동일하게 fanout 된다.

## 발견사항

- **[WARNING]** 외부 API 의 정본 계약 문서(§6.4)가 이번 wire 값 변화를 반영하지 않는다 — `CHANGELOG.md` 에만 고지되어 있다
  - 위치: `spec/5-system/14-external-interaction-api.md` §6.4 (이번 diff 에 포함되지 않음 — 미변경) / 대비: `CHANGELOG.md:3-26`(게이트, 신규 `## Unreleased` 항목)
  - 상세: `spec/5-system/14-external-interaction-api.md` §6.4 는 `execution.failed` 의 `error.message` 를 `"사람-가독 메시지"` 로만 규정하고, 값이 secret 패턴(`Bearer …`, URI 자격증명 등)에 대해 마스킹될 수 있다는 캐비엇이 없다(직접 확인 — `§6.4` 절 전체와 `grep -i version` 결과 마스킹/버전 관련 언급 0건). 이번 PR 은 그 값 콘텐츠를 실질적으로 바꾸는데(§ CHANGELOG "⚠️ wire 변화" 절이 스스로 인정), 고지 위치가 저장소 내부 `CHANGELOG.md` 뿐이다. 이 프로젝트의 확립된 관행은 "이 API 의 단일 진실은 spec" 이고(`plan/in-progress/eia-terminal-error-sanitize.md` 도 "spec §6.4 는 새니타이즈를 요구하지 않는다" 는 근거로 `spec_impact: none` 을 판단했다), 실제로 `spec/5-system/14-external-interaction-api.md` 자체는 "알려진 갭은 invariant 옆에 적는다"(§R14·R17·§6.4 의 확립된 관행, 이 diff 의 `terminal-error-payload.ts` docstring 도 동일 문구를 인용)는 컨벤션을 갖고 있다. 이번 변경은 그 관행을 §6.4 자신에는 적용하지 않았다 — 외부 제3자 통합사가 (내부 전용인) `CHANGELOG.md` 가 아니라 공개된 §6.4 스펙을 계약으로 참조한다면, `message` 가 raw 예외 원문이 아니라 마스킹될 수 있다는 사실을 spec 만으로는 알 수 없다.
  - 제안: §6.4 의 `error.message`/`error.details` 설명 옆에 한두 줄 캐비엇 추가 — "`Bearer`/자격증명 패턴 등 secret-형 문자열은 `***` 로 마스킹된다(egress 초크포인트 `toTerminalErrorPayload`, EIA §R17). 자격증명 없는 연결 문자열·호스트명 등은 아직 마스킹 대상이 아니다(잔여 갭, `spec-sync-external-interaction-api-gaps.md`)." spec 변경이 불필요하다는 plan 의 판단("새니타이즈를 요구하지 않는다") 자체는 맞지만, "요구하지 않는다"와 "실제로 그렇게 동작한다는 사실을 계약 문서에 적지 않는다"는 별개다.

- **[INFO]** `details` 의 키-이름 기반 wholesale 마스킹이 구조적 필드(machine-consumed)에 대해 `message`(사람 가독 prose)보다 넓은 리스크 표면을 갖는다 — 현재는 실측상 영향 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` `redactTerminalError`(게이트 96-104, `deepRedactSecrets(p.details)` 호출) → `codebase/backend/src/shared/utils/sanitize-error-message.ts` `CREDENTIAL_KEY_PATTERN`(`password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key|x[_-]auth[_-]?token`, 대소문자 무관 완전일치)
  - 상세: `TerminalErrorPayload.details?: unknown` 는 spec §6.4 상 "노드 타입별 상세"로 열려 있는 임의 객체다. `deepRedactSecrets`→`deepRedactObject` 는 키 이름이 `CREDENTIAL_KEY_PATTERN` 에 일치하면 **값의 실제 내용과 무관하게** `***` 로 통째 치환한다. 즉 미래에 어떤 emit 경로(또는 노드 핸들러 결과가 `Execution.error.details` 로 승격되는 경로)가 `details.token`/`details.cookie`/`details.secret` 같은 "이름은 겹치지만 실제로는 자격증명이 아닌"(예: idempotency token, 세션 식별자) 필드를 실으면 그 값이 조용히 사라진다 — 이건 `message` 쪽의 "값이 좁아지되 필드 형태는 불변"이라는 CHANGELOG 의 안전 논거가 `details` 의 구조적 하위 키에는 그대로 적용되지 않는 사례다(외부 consumer 가 `details` 를 프로그램적으로 파싱한다면 human-readable narrowing 이 아니라 필드 누락에 가깝다). 실측하면 현재 종결 emit 의 실제 write 지점 3곳(`execution-engine.service.ts:636,4991`, `retry-turn.service.ts:958`)은 전부 `details` 를 아예 채우지 않으므로(코드 확인 — `savedExecution.error = { message, ...(code?) }`, `details` 키 없음) 오늘 시점 실질 영향은 없다.
  - 제안: 조치 불요(현재 무영향). 다만 향후 `details` 를 채우는 emit 경로가 추가될 때(예: 노드 레벨 에러 details 를 top-level `Execution.error.details` 로 승격하는 리팩터), `CREDENTIAL_KEY_PATTERN` 이 일반적인 키 이름(`token`/`cookie` 등)까지 wholesale 마스킹한다는 점을 인지하고 필드명 충돌 여부를 확인할 것 — plan 의 "범위 밖" 절에 한 줄 남겨두면 다음 사람이 반복 조사하지 않아도 된다.

## 정상 확인된 사항 (문제 없음)

- **스키마/응답 형식 불변**: `TerminalErrorPayload` 인터페이스(`{code, message, nodeId, details?}`, §6.4)는 변경되지 않았다. `redactTerminalError` 는 값만 치환하고 optional-key 생략 관용구(`details` 없으면 키 생략)를 그대로 보존한다 — §6.4 "빈 객체를 돌려주지 않는다"/"details 는 optional" 계약 위반 없음.
- **채널 간 일관성**: 마스킹이 `toTerminalErrorPayload` 단일 egress 초크포인트에 배치되어 WS/SSE/webhook 3개 delivery 채널이 동일한 마스킹된 payload 를 받는다 — 표면 간 응답 형식 비대칭을 새로 만들지 않는다(오히려 종전엔 없던 일관성을 추가).
- **버전 관리**: 이 webhook/이벤트 API 에는 애초에 버전 필드/스킴이 없다(`spec/5-system/14-external-interaction-api.md` 전체에 "version" 언급 0건, 실측). 이 변경이 새로 만든 갭이 아니라 기존 상태이므로 이번 diff 의 결함으로 등재하지 않는다.
- **하위 호환성 고지 자체는 모범적**: `CHANGELOG.md` 신규 항목이 "수신자 영향"·"잔여 갭(의도)"·정확한 재직렬화 조건("JSON 형태 message 는 마스킹 시에만 재직렬화되고, secret 이 없으면 원문 그대로")까지 명시했다 — 실제로 `redactSecretsInJsonString`(`sanitize-error-message.ts:183-194`) 코드가 `red === parsed ? raw : JSON.stringify(red)` 로, 마스킹된 게 없으면 원본 문자열을 바이트 그대로 반환함을 코드 대조로 확인. "값이 바뀌는 것은 secret 이 실제로 검출됐을 때뿐"이라는 주장이 정확하다.
- **에러 응답/HTTP 상태 코드**: 이번 diff 가 건드리는 것은 이벤트 payload 필드값이지 REST 에러 응답 포맷이 아니다 — `2-api-convention.md §5.3` 에러 envelope 관련 변경 없음.
- **요청 검증/URL·경로 설계/페이지네이션/인증·인가**: 이번 diff 범위(문자열·객체 마스킹 유틸)와 무관 — 해당 관점의 변경 없음.
- `code`/`nodeId`(닫힌 값 공간 — enum 문자열/uuid)는 마스킹 대상에서 제외돼 있어, 외부 consumer 가 이 두 필드로 분기하는 기존 로직(예: chat-channel `error.code === null` fallback, §6.4 인용)에 영향 없음.

## 요약

핵심 변경은 EIA 종결 이벤트(`execution.failed`)의 `error.message`/`error.details` 에 egress 시점 secret 마스킹을 추가하는 것으로, `TerminalErrorPayload` 스키마·optional-key 관용구·`code`/`nodeId` 값 공간은 전부 불변이라 **구조적** breaking change 는 없다. 다만 이는 **값** breaking change(외부 통합사가 `error.message` 를 문자열 동등 비교하면 영향)이고, `CHANGELOG.md` 는 이를 정확하고 성실하게 고지했지만 이 API 의 정본 계약 문서인 `spec/5-system/14-external-interaction-api.md` §6.4 자체는 갱신되지 않았다 — 이 저장소가 스스로 "spec 이 단일 진실"이라 규정하고 "알려진 갭은 invariant 옆에 적는다"는 관행을 갖고 있음에도, 이번엔 그 관행이 CHANGELOG 에만 적용됐다. 추가로 `details` 필드의 키-이름 기반 wholesale 마스킹이 구조적 필드에 대해 갖는 (현재는 무영향인) 잠재 리스크를 INFO 로 남긴다. 두 항목 모두 기능 회귀나 스펙 위반은 아니며 문서 완결성/향후 리스크 성격이다.

## 위험도
LOW
