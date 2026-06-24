# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `persistUserTurn` — 사용자 입력 content 가 trim/slice 이외의 새니타이징 없이 DB에 직접 저장됨
  - 위치: `assistant-turn-persistence.service.ts` L537–545 (`persistUserTurn`)
  - 상세: `content` 는 caller 에서 전달되는 사용자 입력 문자열이며, `appendMessage` 로 DB에 저장하기 전에 XSS 방어 목적의 이스케이프나 인젝션 방어 처리가 없다. 그러나 이 레이어는 LLM 컨텍스트 저장 목적이고, 출력 시 렌더링 레이어에서 처리해야 하는 패턴이므로 현 아키텍처상 설계 의도와 일치한다. ORM(TypeORM)을 통한 파라미터화 쿼리를 사용한다고 가정하면 SQL 인젝션 위험은 없으나, 호출 스택에서 `appendMessage` 구현이 raw query를 사용하는지 별도 확인 권장.
  - 제안: 기존 `appendMessage` 구현이 TypeORM의 파라미터화 쿼리를 사용하는지 확인. 렌더링 레이어(프론트엔드)에서 콘텐츠를 신뢰하지 않고 이스케이프하는지 점검.

- **[INFO]** `persistAssistantTurn` — `toolCalls` / `plan` / `usage` 등 LLM 응답 데이터가 검증 없이 persist됨
  - 위치: `assistant-turn-persistence.service.ts` L548–585 (`persistAssistantTurn`)
  - 상세: LLM 응답(content, toolCalls arguments, plan 등)은 외부 신뢰 경계 데이터이며, 본 서비스에서는 null 정규화 외에 스키마 검증이 없다. 그러나 이 변경은 기존 `streamMessage` 의 verbatim 이동이므로 기존 보안 수준을 유지한다. 스키마 검증은 상위 레이어(`shadow-workflow`, `recoverLeakedPlan` 등)에서 수행하므로 이 persist 서비스 자체의 역할 범위와 부합한다.
  - 제안: 신규 취약점 없음. 현행 상위 레이어 검증 체계 유지.

- **[INFO]** `content.trim().slice(0, 40)` 세션 title 도출 — DoS 위험 없음 확인
  - 위치: `assistant-turn-persistence.service.ts` L542–544
  - 상세: 40자 hard-cap 으로 title 도출 시 버퍼 오버플로우 위험이 없으며, whitespace-only 입력에 대한 방어 분기(`if (derived)`)도 존재.
  - 제안: 해당 없음.

- **[INFO]** `makeResumeMeta` — `stallRounds` 정수 범위 검증 부재
  - 위치: `assistant-turn-persistence.service.ts` L488–505
  - 상세: `stallRounds` 가 매우 큰 정수(예: Number.MAX_SAFE_INTEGER)로 전달될 경우 `autoResumeAttempt` 에 그대로 저장된다. 현재 호출자(`streamMessage`)가 `MAX_STALL_ROUNDS = 2` 상한을 이미 강제하므로 실제 위험은 없으나, 향후 다른 호출자가 생길 경우 범위 검증이 없다.
  - 제안: 방어 목적으로 `stallRounds` 에 대한 양수 범위 상한 검증(예: `Math.min(stallRounds, MAX_STALL_ROUNDS)`)을 헬퍼 내부에 추가하는 것 고려. 필수는 아님.

## 요약

이번 변경은 순수 리팩토링(메서드 verbatim 이동 + 생성자 주입)이며 새로운 보안 경계나 외부 입력 처리 경로를 도입하지 않는다. 하드코딩된 시크릿, 인증/인가 우회, SQL 인젝션, 커맨드 인젝션, 경로 탐색, 알려진 취약 의존성 추가, 암호화 저하, 민감 정보 에러 노출 등 OWASP Top 10 범주의 신규 취약점은 발견되지 않았다. 사용자 입력 새니타이징은 기존 아키텍처 수준을 그대로 유지하며, TypeORM 파라미터화 쿼리 사용 여부와 프론트엔드 출력 이스케이프는 이 PR 범위 외의 기존 설계에 의존한다.

## 위험도

NONE
