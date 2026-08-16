# 요구사항(Requirement) 리뷰 — `eia-terminal-error-sanitize` (2026-08-16 09:51:00)

## 검토 범위

핵심 기능 변경은 3개 파일이다:
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (docstring 정정만, 로직 무변경)
- `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`redactTerminalError` 신설 — `toTerminalErrorPayload` egress 초크포인트에서 `deepRedactSecrets` 적용)
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (신규 테스트 8건)

나머지(`plan/in-progress/*.md`, `review/consistency/**`)는 이번 턴의 impl-prep 산출물/작업 트래커로, 코드 동작에 영향 없음 — 요구사항 충족 판단에는 부차적이다.

**실측 확인 (재현)**: 3곳 호출부(`execution-engine.service.ts:5090`, `background-execution.processor.ts:70`, `schedule-runner.service.ts:243`) 및 `toTerminalErrorPayload` 5개 호출부(`execution-engine.service.ts:668,3400,5030`, `retry-turn.service.ts:1001`, `chat-channel.dispatcher.ts:551`) 전부 grep 으로 카운트를 재검증 — plan/docstring 의 "3곳"/"5곳" 주장과 정확히 일치. `npx tsc --noEmit`(대상 파일 관련 에러 0) · `npx eslint`(clean) · `npx jest terminal-error-payload.spec.ts`(23/23 PASS) 전부 통과.

## 발견사항

- **[WARNING]** 새 egress 마스킹(`redactTerminalError`)이 **연결 문자열/내부 호스트명**은 못 잡는다 — PR 자신의 docstring 이 명시한 위협 범위보다 실제 방어가 좁다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:81-89` (`redactTerminalError` — `deepRedactSecrets(p.message)` 만 호출), 동기 근거는 같은 파일 `:57-60` 의 docstring("자유 텍스트 *안에* 박힌 토큰(`Bearer …`, **연결 문자열**)을 못 잡는다")
  - 상세: `redactTerminalError` 는 `deepRedactSecrets` → `redactSecrets`(`shared/utils/sanitize-error-message.ts`) → `SECRET_LEAK_PATTERNS` 를 재사용한다. 이 패턴 집합은 Bearer 토큰·`key=value` 형 secret·bare JWT·**URI 에 자격증명이 임베드된 경우**(`user:pass@host`)만 마스킹한다. **자격증명이 없는 순수 연결 문자열/호스트명은 어떤 패턴에도 안 걸린다** — 직접 재현:
    ```
    redactSecrets('connection failed: postgres://internal-db-host.svc.cluster.local:5432/mydb')
      → 'connection failed: postgres://internal-db-host.svc.cluster.local:5432/mydb'  (무변화)
    redactSecrets('ECONNREFUSED 10.0.4.55:5432')
      → 'ECONNREFUSED 10.0.4.55:5432'  (무변화)
    ```
    반면 자매 유틸 `sanitizeErrorMessage`(`modules/execution-engine/sanitize-error-message.ts`)는 `CONNECTION_STRING_PATTERN = /(postgres|postgresql|redis|mongodb|mysql):\/\/[^\s]+/gi` 로 **자격증명 유무와 무관하게** 연결 문자열 전체를 `[REDACTED_URI]` 로 지운다 — 알림(인앱/이메일) 경로는 이 패턴으로 보호되는데, 이번 PR 이 새로 여는 WS/SSE/**EIA outbound webhook**(외부 제3자) 경로는 이 패턴을 안 쓴다.
    이 위협 클래스는 이번 PR 이 스스로 "닫는다"고 서술한 대상이다 — `terminal-error-payload.ts` 의 새 docstring 이 "연결 문자열" 을 `Bearer …` 와 나란히 예시로 들며 `sanitizePayloadForWs`(키-이름 기반)의 사각지대로 지목했고, 그 사각지대를 메우는 것이 `redactTerminalError` 도입의 명시된 동기다. 그런데 실제로 재사용한 SoT(`SECRET_LEAK_PATTERNS`)는 연결 문자열용 패턴을 포함하지 않는다.
    신규 테스트(`terminal-error-payload.spec.ts` 신규 `describe` 블록)도 Bearer 토큰·`api-key=` 케이스만 있고 연결 문자열/내부 호스트명 케이스는 0건이라, 이 갭이 회귀 테스트로도 안 잡힌다.
  - 영향: `Execution.error.message` 에 내부 DB/Redis 호스트명·포트·경로가 담기면(흔한 실패 시나리오 — DB 연결 실패, 내부 서비스 연결 실패) 이 정보가 **EIA outbound webhook 을 통해 외부 제3자에게, 그리고 SSE 스트림으로 외부 클라이언트에** 그대로 노출된다. spec 이 새니타이즈를 강제하진 않으므로 spec 위반(CRITICAL)은 아니지만, 이번 PR 이 스스로 세운 목표(egress 값-패턴 마스킹으로 "임의 내부 예외 메시지 원문" 노출을 닫는다) 를 부분적으로만 달성한다.
  - 제안: `redactTerminalError`(또는 그 안의 `deepRedactSecrets` 재사용 방식)에 연결 문자열/호스트명 패턴을 추가하거나(예: `sanitizeErrorMessage` 의 `CONNECTION_STRING_PATTERN` 을 shared SoT 로 승격해 재사용), 범위를 의도적으로 secret-token 전용으로 좁힌다면 그 결정과 잔여 갭(연결 문자열은 후속)을 plan/docstring 에 명시해 다음 리뷰가 "이미 닫혔다"고 오판하지 않게 한다.

- **[WARNING]** `sanitize-error-message.ts` 의 "과장된 첫 줄 정정"이 불완전해 **문서 자체가 자기모순**이다
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:2`(신규 수정) vs `:15-16`(기존 유지 텍스트)
  - 상세: 이번 PR 이 고친 새 2번째 줄은 "실행 실패 에러 메시지를 **알림 표면**(인앱 알림 / 이메일)에 노출하기 전 정리한다" 로 적용 범위를 2개 채널로 좁혔고, 3~7번째 줄은 실측으로 호출부가 정확히 3곳(전부 in-app/email 알림 조립 지점)임을 근거로 든다. 그런데 같은 파일 바로 아래 **손대지 않은** 13~16번째 줄은 여전히 "인앱/이메일(외부 SMTP)·**webhook 알림**으로 흘러가지 않도록 하는 defense in depth" 라고 **3번째 채널(webhook 알림)**을 언급한다.
  - 실측: 세 호출부(`execution-engine.service.ts:5090`, `background-execution.processor.ts:70`, `schedule-runner.service.ts:243`) 모두 `NotificationsService.notify`/`createMany` 를 거치고, 그 `channel` 타입은 `'in_app' | 'email' | 'both'` 뿐이다(`notifications.service.ts:281,319` — `grep -n webhook codebase/backend/src/modules/notifications/*.ts` 결과 0건). 즉 이 함수가 실제로 보호하는 알림 채널에 "webhook" 은 없다 — 13~16번째 줄의 서술은 정정 대상이었던 "과장된" 범위 주장과 같은 성격의 오류인데 이번 정정에서 빠졌다.
  - 제안: 13~16번째 줄에서 "webhook 알림" 을 제거하거나(현재 채널과 불일치), 만약 향후 webhook 알림 채널 도입을 전제로 남겨둔 것이라면 그 의도를 명시. 같은 정정 작업(plan 체크리스트 "과장된 첫 줄 정정")의 목적이 "문서한 보장이 구현보다 넓었다" 를 바로잡는 것이었으므로, 같은 문서 안의 다른 과장도 함께 잡는 편이 일관적이다.

- **[INFO]** 종결 3종 밖 — `execution.node.failed` 의 `NodeExecution.error.message` 도 SSE 로 외부에 노출되지만 이번 PR 범위 밖
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md` "## 범위 밖" 섹션(스코프 결정), spec 근거는 `spec/5-system/14-external-interaction-api.md` §11 표(`execution.node.failed` → SSE 이벤트명 동일 매핑, outbound notification 컬럼은 "—")
  - 상세: spec §11 표에 따르면 `execution.node.failed` 는 SSE 로는 노출되고(outbound webhook 화이트리스트 5종에는 없음), 그 payload 의 에러 메시지 출처인 `NodeExecution.error`(코드 상 `err instanceof Error ? err.message : String(err)` 패턴이 execution-engine.service.ts 여러 지점에 반복)는 이번 PR 의 `toTerminalErrorPayload`/`redactTerminalError` 를 거치지 않는다. 동일 클래스의 값-패턴 secret 노출 위험이 SSE 채널에 남아 있을 수 있으나, plan 문서가 "별개 표면·계약이 다르다" 로 명시적으로 스코프 아웃했고 이번 diff 가 그 표면을 건드리지 않으므로 이 PR 자체의 결함은 아니다. 후속 추적 여부만 확인 필요(현재 `spec-sync-external-interaction-api-gaps.md` 에도 별도 항목 없음).
  - 제안: (강제 아님) 후속 백로그로 `spec-sync-external-interaction-api-gaps.md` 에 "node-level error.message 값-패턴 마스킹 미적용" 항목 등재 검토.

## 정상 확인된 사항 (참고)

- `redactTerminalError` 는 `toTerminalErrorPayload` 의 **모든** 반환 경로(문자열/숫자·불리언·bigint/객체 실패/null-guard 이후 4개 분기)에 적용돼 있어 "한 곳만 빠뜨린다" 는 이 저장소의 반복 실패 형태를 재현하지 않는다 — 코드 레벨에서 직접 확인.
- `code`/`nodeId` 를 마스킹 대상에서 제외한 근거("닫힌 값 공간")는 실제 write 지점 감사로 뒷받침된다 — `Execution.error.code` 는 `ErrorPortFallbackError`/`ExecutionTimeLimitError` sentinel 이나 고정 문자열(`WORKER_HEARTBEAT_TIMEOUT` 등)에서만 온다(execution-engine.service.ts:4991-4999 확인).
- `details` copy-on-change(참조 보존) 테스트 및 "입력을 변형하지 않는다" 테스트가 실제 구현과 일치 — `deepRedactSecrets` 가 변화 없으면 동일 참조를 반환하므로 `redactTerminalError` 의 spread 를 거쳐도 `details` 참조가 보존된다.
- spec `§6.4`/R17 은 새니타이즈를 요구하지 않으므로(plan 문서 자체 인용 확인) 이 변경은 spec 위반이 아니라 자발적 하드닝 — spec fidelity 관점에서 CRITICAL 대상 없음.
- 3개 핵심 파일 tsc/eslint/jest 전부 통과(23/23).

## 요약

핵심 로직(`redactTerminalError` 도입, `toTerminalErrorPayload` 4개 분기 전체 배선, null-guard 유지, `details` 참조 보존)은 정확하고 테스트로 잘 뒷받침된다. 다만 이 PR 이 스스로 내세운 위협 모델(“자유 텍스트에 박힌 Bearer 토큰과 **연결 문자열**을 WS/SSE/webhook egress 에서 마스킹한다”) 중 연결 문자열/내부 호스트명 부분은 실제로 재사용한 `SECRET_LEAK_PATTERNS` 에 해당 패턴이 없어 방어되지 않는다 — 직접 재현으로 확인. 같은 파일의 docstring 정정도 "webhook 알림" 언급이 남아 자기모순이다. 둘 다 spec 위반(CRITICAL)은 아니지만, PR 이 명시한 목표 대비 완전성이 부족하다는 점에서 WARNING 으로 등재한다.

## 위험도
MEDIUM
