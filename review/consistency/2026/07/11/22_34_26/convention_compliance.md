# 정식 규약 준수 검토 — convention_compliance

target: `spec/5-system/14-external-interaction-api.md` (impl-done, diff-base=origin/main)

## 검토 범위 요약

diff 는 `spec/` 변경을 포함하지 않는 순수 코드 리팩터다:

1. `WebchatIdleReaperService` → `WebChatIdleReaperService` 및 관련 메서드/함수(`markWebchatIdleTimeout`→`markWebChatIdleTimeout`, `findIdleWebchatExecutionIds`→`findIdleWebChatExecutionIds`, `resolveWebchatIdleReapGraceMs`→`resolveWebChatIdleReapGraceMs`) 대소문자 정정.
2. 4개 취소 경로(`cancelParkedExecution`/`markExecutionCancelled`/`markQueueWaitTimeout`/`markWebChatIdleTimeout`)가 공유하던 `try{emit}catch{warn}` 보일러플레이트를 `emitCancellationEvent` 헬퍼로 단일화.
3. `InteractionTokenService.reconcileTerminalRevocations` / `WebChatIdleReaperService.reap` 의 중복 청크-배치 루프를 공용 `processInBatches` 유틸(`codebase/backend/src/common/utils/process-in-batches.ts`)로 추출.

## 발견사항

- **[INFO]** 식별자 대소문자 규약이 문서화돼 있지 않음
  - target 위치: 해당 없음 (target 문서 자체는 이번 diff 로 변경되지 않음)
  - 위반 규약: 직접 위반 아님 — `spec/conventions/**` 어디에도 "WebChat" 복합어 대소문자(예: `WebChat` vs `Webchat`) 규칙을 명시한 문서가 없음 (`grep -rn "WebChat" spec/conventions/*.md` 0건)
  - 상세: 이번 diff 는 코드베이스 전역에 이미 정착된 `WebChat`(예: `WebChatAppearanceDto`, `WebChatCorsOriginResolver`, `web-chat-cors` 모듈) 표기와 어긋나 있던 `Webchat`(단일 대문자 W) 표기를 EIA-RL-07 표면 전체(서비스 클래스·메서드·함수·describe 블록)에서 정정한 것으로 확인됨(`git -C <worktree> grep -rn "\bWebchat[A-Za-z]*\b"` → 0건 잔존). 즉 이번 변경은 규약 위반이 아니라 **기존 위반의 교정**이다. 다만 이 규칙 자체가 conventions 문서에 명문화돼 있지 않아, 향후 유사 복합어(예: 새 채널 어댑터 명명)에서 동일한 표류가 재발할 여지가 있다.
  - 제안: 규약 갱신이 적절한 경우 — `spec/conventions/swagger.md` 또는 신규 경량 문서에 "고유 도메인 복합어(WebChat 등)는 각 단어를 대문자로 시작해 표기하고 프로젝트 전체에서 단일 표기를 유지한다" 정도의 1문장 원칙을 추가하면 회귀를 예방할 수 있음. 필수는 아님(INFO).

## 정합성 확인 (위반 없음, 기록용)

아래는 diff 가 `spec/conventions/**` 및 target 문서와 실제로 **정합**함을 확인한 항목이다 (별도 조치 불요).

- **`error-codes.md` §2 rename 안정성 정책 준수**: `emitCancellationEvent` 헬퍼 추출 과정에서 공개 wire 값 `error.code = 'WEBCHAT_IDLE_TIMEOUT'`, 큐명 `WEBCHAT_IDLE_REAPER_QUEUE`, env 이름 `WEBCHAT_IDLE_REAP_GRACE_MS` 는 전혀 변경되지 않았다. 대소문자 정정은 **내부** 클래스/메서드/함수명에만 적용되고 클라이언트 계약(에러 코드 문자열)은 그대로다 — "에러 코드 rename 은 breaking change" 원칙(§2)을 정확히 지킴.
- **`2-api-convention.md` §5.4 (`null` vs 키 생략) 및 target `6-websocket-protocol.md` §4.1 `execution.cancelled` 스펙 준수**: `emitCancellationEvent(opts)` 의 `...(opts.error ? { error: opts.error } : {})` 분기는 "일반 user cancel 에는 `error` 부재" (WS §4.1 표기)를 그대로 보존한다. 신규 회귀 테스트(`execution-engine.service.spec.ts` `applyCancellation` — `cancelledBy:'user'` 케이스)가 `emittedPayload` 에 `error` 키가 없음을 명시적으로 고정해, 헬퍼 통합 과정에서 4경로 중 `cancelParkedExecution` 만 `error` 를 싣지 않던 기존 계약이 깨지지 않았음을 검증한다.
- **target §6.5 / §Rationale `cancelledBy` 닫힌 3값 union 준수**: 헬퍼 시그니처 `cancelledBy: 'user' | 'system' | 'timeout'` 은 target 문서가 명시한 닫힌 union 과 정확히 일치하며 새 값을 추가하지 않았다.
- **문서 구조 규약**: target 문서는 `## Overview (제품 정의)` → 본문 → `## Rationale` 3섹션 구성을 유지(코드 변경과 무관하게 이번 검토에서 재확인).
- **파일 명명**: `webchat-idle-reaper.service.ts` 등 파일명은 kebab-case 로 유지(클래스명만 PascalCase 정정) — NestJS 관례 및 기존 `throttler-skip.ts` 류 유틸 배치 패턴과 일치.
- **API 문서 규약(swagger.md)**: 이번 diff 는 신규/변경 DTO·컨트롤러·엔드포인트가 없어 swagger 데코레이터·DTO 명명 패턴 검토 대상 자체가 없음(N/A).
- **`code:` frontmatter 커버리지**: 변경된 EIA 모듈 파일들은 target 문서 frontmatter 의 `code: codebase/backend/src/modules/external-interaction/**` 글로브에 포함됨. 신규 `common/utils/process-in-batches.ts` 는 EIA 전용이 아닌 범용 유틸이라 별도 등재 불요.

## 요약

이번 diff 는 spec 문서(`spec/5-system/14-external-interaction-api.md`) 자체를 변경하지 않는 순수 백엔드 리팩터이며, 정식 규약 관점에서 위반 사항을 찾지 못했다. 오히려 코드베이스 전역에 이미 정착된 `WebChat` 표기(WebChatAppearanceDto 등)와 어긋나 있던 `Webchat` 표기를 EIA-RL-07 관련 표면 전체에서 정정해 명명 일관성을 개선했고, 공개 에러 코드·큐명·env 변수 등 클라이언트 계약 문자열은 그대로 보존해 `error-codes.md` §2 의 rename-안정성 원칙을 지켰다. `emitCancellationEvent` 헬퍼로 통합된 `EXECUTION_CANCELLED` emit 페이로드는 `api-convention.md §5.4`(present-when-available)와 target 문서 §6.5/`6-websocket-protocol.md` §4.1 이 명시한 "user cancel 에는 `error` 부재" 계약을 신규 고정 테스트로 보호하며 정확히 재현한다. 유일하게 남는 것은 INFO 수준 제안(복합어 대소문자 규칙을 conventions 에 명문화하면 향후 유사 표류 예방)뿐이다.

## 위험도

NONE
