# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- `codebase/backend/src/nodes/core/error-codes.ts`
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-fixture.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` (신규)
- `plan/complete/exec-intake-followups.md` / `plan/in-progress/exec-intake-followups.md` (plan 이동, 문서만)

## 변경 성격

엔진 레이어 에러 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT` / `WORKER_HEARTBEAT_TIMEOUT` /
`SERVER_INTERRUPTED` / `WEBCHAT_IDLE_TIMEOUT`)와 이미 `ErrorCode` 에 있던
`LLM_RATE_LIMIT` / `LLM_CALL_FAILED` 를 하드코딩 문자열 리터럴에서 신설
`EngineErrorCode` / 기존 `ErrorCode` const 참조로 치환하는 **순수 리팩터**다. 각
치환 지점을 대조한 결과 문자열 값 자체는 완전히 동일하다(`'LLM_RATE_LIMIT'` →
`ErrorCode.LLM_RATE_LIMIT`(값 `'LLM_RATE_LIMIT'`) 등) — 런타임 동작·DB 영속값·직렬화
형태에 변화가 없다. 나머지는 그 회귀를 막는 AST 기반 repo-guard(신규 테스트)와
plan 문서 이동(`in-progress/` → `complete/`)이다.

### 발견사항

없음. 인젝션·시크릿 하드코딩·인증/인가·입력 검증·암호화·에러 메시지 노출·의존성
관련해 새로 도입되는 위험이 확인되지 않았다.

참고로 확인한 항목 (문제 없음, 기록용):

- `ai-turn-orchestrator.service.ts` 의 `extractAiTurnErrorPayload` 는 이번 diff 의
  전/후 모두 `sanitizeLastErrorMessage(rawMessage)` 를 거쳐 클라이언트/DB 로 나가는
  메시지를 정제한다(`ai-turn-orchestrator.service.ts:1345` 부근, 본 diff가 건드리지
  않은 기존 로직) — 이번 변경은 `code` 필드만 리터럴→enum 참조로 바꿨고 메시지 정제
  경로는 그대로다.
- 신규 repo-guard(`engine-error-code-anchor-guard.ts`)는 `ts.createSourceFile` 로
  고정된 상대경로 상수(`ENGINE_DIR`, `CODES_SOURCE`)만 읽는다 — 사용자 입력이나
  외부 데이터로 경로가 구성되지 않아 경로 탐색(path traversal) 위험이 없고, CI/테스트
  전용 도구라 공격 표면도 아니다.
- `UPPER_SNAKE` 정규식(`/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/`)은 중첩 정량자가 없는
  선형 패턴 — ReDoS 우려 없음.
- `plan/complete/exec-intake-followups.md` 이동분은 문서 텍스트 변경뿐이며 시크릿·
  민감정보 포함 없음.

## 요약

이번 변경은 엔진 레이어 에러 코드 문자열을 타입 앵커(enum 상수)로 리다이렉트하는
기계적 리팩터로, 치환 전후 문자열 값이 완전히 동일해 동작·계약에 영향이 없다.
동봉된 AST 기반 repo-guard 는 오히려 향후 "맨 문자열 코드" 회귀(오탈자로 인한
DB persist / FE·알림 분기 오작동)를 예방하는 방향의 보강이다. 인젝션·시크릿·
인증/인가·입력 검증·암호화·에러 노출·의존성 어느 관점에서도 새로 도입된 취약점이
없다.

## 위험도

NONE
