# API 계약(API Contract) 리뷰 결과

## 발견사항

이번 변경은 공개 HTTP API 엔드포인트를 추가·수정·삭제하지 않습니다.
변경 범위는 다음 세 가지입니다.

1. `terminal-revoke-reconciler.service.ts` — BullMQ `@Processor` + `WorkerHost` 기반 내부 스케줄러. 외부 HTTP 경로 없음.
2. `interaction-token.service.ts` — `reconcileTerminalRevocations()` 내부 메서드 추가. 컨트롤러/가드/인터셉터 계층에 노출되지 않음.
3. `external-interaction.module.ts` — `TerminalRevokeReconcilerService` 및 `TERMINAL_REVOKE_RECONCILE_QUEUE` 등록. 컨트롤러·exports 배열 미변경.
4. `plan/complete/spec-fix-eia-token-error-codes.md` — plan 문서 (코드 아님).
5. spec 파일 직접 변경 없음 (plan 문서에만 참조됨).

### [INFO] 내부 서비스 등록 — 외부 계약 영향 없음
- 위치: `external-interaction.module.ts` L49, L57
- 상세: `BullModule.registerQueue` 및 `providers` 배열에 신규 서비스 추가. 모듈의 `controllers`, `exports` 배열은 변경 없음. 기존 클라이언트가 호출하는 REST 엔드포인트(`/interact`, `/cancel`, `/refresh-token`, `/status`, SSE stream) 는 영향받지 않음.
- 제안: 없음.

### [INFO] `reconcileTerminalRevocations` 반환 타입 — 내부 메서드
- 위치: `interaction-token.service.ts` L291
- 상세: `Promise<{ swept: number; revoked: number }>` 반환. 컨트롤러 레이어로 노출되지 않으므로 외부 API 응답 스키마에 영향 없음.
- 제안: 없음.

### [INFO] BullMQ 큐 이름 상수 공개 export — 모듈 내부 사용
- 위치: `terminal-revoke-reconciler.service.ts` L1 `export const TERMINAL_REVOKE_RECONCILE_QUEUE`
- 상세: 큐 이름 문자열 `'terminal-revoke-reconcile'` 이 공개 export 로 선언되어 있으나, 동일 모듈 내 `BullModule.registerQueue` 와 `@InjectQueue` 에서만 소비됨. 외부 HTTP API 경로와 무관.
- 제안: 없음.

## 요약

이번 변경은 execution 종료 후 누락될 수 있는 토큰 revoke 를 at-least-once 로 보완하기 위한 내부 BullMQ 주기 스케줄러(`TerminalRevokeReconcilerService`)와 토큰 서비스의 내부 sweep 메서드 추가입니다. 공개 REST 엔드포인트, 응답 스키마, HTTP 상태 코드, 인증/인가 미들웨어, URL 경로 중 어느 것도 변경되지 않았습니다. 기존 API 클라이언트에 대한 하위 호환성 파괴(breaking change) 가 전혀 없으며, API 버전·페이지네이션·에러 응답 형식·요청 검증 로직도 이번 diff 에서 수정되지 않았습니다.

## 위험도

NONE
