# 보안(Security) 리뷰 — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

보안 관점에서 실제 취약점에 해당하는 신규 발견사항 없음.

### [INFO] `stallRounds` 파라미터 범위 상한 미검증
- 위치: `assistant-turn-persistence.service.ts` — `makeResumeMeta(stallRounds: number)`
- 상세: `stallRounds` 에 대한 상한 검증이 없다. 현재 유일한 호출자가 `MAX_STALL_ROUNDS=2` 로 내부 제한을 두고 있어 실질적 공격 표면은 아니다. 그러나 향후 외부 입력이 연결되거나 다른 호출자가 생길 경우, 비정상적으로 큰 값이 `autoResumeAttempt` 컬럼에 기록될 수 있다. 외부 입력과 직접 연결되지 않는 내부 헬퍼이므로 현재로서는 LOW보다 낮은 INFO 수준.
- 제안: 방어적 `Math.min(stallRounds, MAX_STALL_ROUNDS)` 클램프 고려 (필수 아님). 향후 `makeResumeMeta` 가 외부 입력을 수신하는 경로로 확장될 경우 반드시 적용.

### [INFO] `content` 원문 그대로 DB 저장 — 입력 검증 부재 (pre-existing)
- 위치: `assistant-turn-persistence.service.ts` — `persistUserTurn` 내 `appendMessage(sessionId, { role: 'user', content })`
- 상세: `content` 파라미터에 대한 길이 제한, 특수 문자 새니타이징, 인젝션 방지 처리가 `AssistantTurnPersistenceService` 레이어에 존재하지 않는다. 단, 이 계층은 서비스 레이어이며 실제 DB 접근은 `WorkflowAssistantSessionService.appendMessage`(TypeORM ORM 경유)가 담당한다. TypeORM 은 파라미터 바인딩으로 SQL 인젝션을 차단한다. 입력 검증(길이 제한 등)은 DTO/컨트롤러 레이어에서 이루어져야 하며, 이번 변경이 새로운 검증 공백을 만든 것은 아니다. Pre-existing.
- 제안: 서비스 레이어의 책임 외 사항이나, 컨트롤러 레이어(`AssistantMessageRequestDto`)에 `content` 필드 최대 길이 `@MaxLength` 가드가 적용되어 있는지 확인 권장.

### [INFO] `sessionId` 신뢰 전제 — 인가 검증 부재 (pre-existing, out-of-scope)
- 위치: `assistant-turn-persistence.service.ts` — `persistUserTurn`, `persistAssistantTurn` 모두 `sessionId: string` 을 신뢰
- 상세: `AssistantTurnPersistenceService` 는 `sessionId` 의 소유권(요청 사용자가 해당 세션에 접근 권한을 가지는지)을 검증하지 않는다. 이는 계층 분리 원칙상 컨트롤러/가드 레이어에서 처리해야 할 사항이며, verbatim 이동 전 `streamMessage` 에서도 동일하게 검증하지 않던 pre-existing 패턴이다. 이번 변경이 새 검증 공백을 도입한 것이 아니다.
- 제안: 인가 검증이 컨트롤러 레이어(예: `@UseGuards`, `JwtAuthGuard`) 에서 적절히 적용되는지 확인 권장 (본 변경 범위 외).

## 요약

이번 변경(`AssistantTurnPersistenceService` 분리)은 `WorkflowAssistantStreamService` 에서 세션/메시지 영속 책임을 verbatim 이동한 behavior-preserving 순수 리팩토링이다. 신규 SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 암호화 취약점, 민감 정보 노출 중 어느 항목도 도입되지 않았다. 발견사항 3건은 모두 INFO 수준이며, 2건은 이동 전 코드에 이미 존재하던 pre-existing 패턴(TypeORM ORM 레이어 보호 포함)이고, 1건은 향후 호출 범위 확장 시 고려할 방어적 클램프이다. OWASP Top 10 해당 취약점 없음. 의존성 신규 추가 없음.

## 위험도

NONE
