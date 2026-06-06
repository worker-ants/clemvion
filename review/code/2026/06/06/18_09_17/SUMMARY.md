# Code Review 통합 보고서

## 전체 위험도
**LOW** — 전반적으로 안전한 polish/refactor 변경. Critical 발견 없음. SPEC-DRIFT 1건(spec 본문 구 메서드명 잔존) + 테스트 중복 블록 + dev fallback secret 이 주요 WARNING.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `driveResumeDetached` → `driveResumeAwaited` rename 이 spec 본문 4곳(L128, L903, L1306, L1311)에 미반영. 코드가 옳고 spec 이 낡은 이름을 보유 | `spec/5-system/4-execution-engine.md` L128, L903, L1306, L1311 | 코드 유지 + spec 갱신: 4곳의 `driveResumeDetached` → `driveResumeAwaited` 교체. project-planner 역할로 수행 |
| 2 | Testing | `constructor — secret 미설정 시 prod fail-closed` describe 블록이 `iext_*` 와 `itk_*` 두 상위 describe 에 완전히 동일한 내용으로 중복 추가됨. 기능 오류는 없으나 향후 유지보수 부담 증가 | `interaction-token.service.spec.ts` L430~L452 (itk) / L1912~L1952 (iext) | 두 상위 describe 바깥 최상위 독립 `describe('InteractionTokenService — constructor guards', ...)` 단일 블록으로 통합 |
| 3 | Security | `dev/test` 환경에서 `INTERACTION_JWT_SECRET`/`JWT_SECRET` 미설정 시 `'interaction-fallback'` 고정 문자열로 JWT 서명 가능. 기존 동작 유지(신규 도입 아님)이나 dev 서버 외부 노출 시 위조 위험 | `interaction-token.service.ts` — `this.secret = envSecret ?? 'interaction-fallback'` | dev/test 전용 격리 환경이면 허용 가능. 보안 강화 원하면 부팅 시 randomBytes 생성 secret 으로 대체 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `driveResumeAwaited` JSDoc 마지막 줄에 `(메서드명은 옛 detach 모델의 잔재 — 현재는 awaited 구동.)` 자기모순 주석 잔존. 메서드명이 이미 `driveResumeAwaited` 로 변경됐으므로 부적절 | `execution-engine.service.ts` JSDoc 마지막 줄 | 해당 parenthetical 제거 또는 긍정형으로 교체 |
| 2 | Documentation | `ProcessTurnResult` 정의 블록 내 `ai-review W11 —` 태그는 내부 리뷰 시스템 식별자로 프로덕션 소스에 노이즈 | `execution-engine.service.ts` `ProcessTurnResult` 정의 | `ai-review W11 —` 참조 태그 제거 또는 자연어로 교체 |
| 3 | Maintainability | `LLM_STUB_MODE` 가 `# OAuth` 섹션 헤더 아래에 위치해 섹션 경계 모호 | `.env.example` L265-270 | `# LLM stub — local/e2e 전용` 소섹션 헤더 추가 또는 OAuth 섹션 헤더를 `# Dev stubs (OAuth / LLM)` 으로 확장 |
| 4 | Security | `.env.example` 의 `ENCRYPTION_KEY` 가 실제 16진수 값으로 기본 설정됨(이번 diff 범위 외). 개발자가 그대로 복사 사용 시 위험 | `.env.example` L198 | `ENCRYPTION_KEY=change-me-64-hex-chars` placeholder 로 변경 또는 "절대 운영 그대로 사용 금지" 주석 강조 |
| 5 | Side Effect | `InteractionTokenService` 생성자 throw 는 NestJS DI 컨테이너 초기화 단계에서 원시 오류로 프로세스 중단. 의도된 동작이나 기존 `main.ts` 명시적 가드 패턴과 구조적 차이 있음 | `interaction-token.service.ts` constructor | 생성자 주석에 "NODE_ENV=production + secret 미설정 시 throw" 명시(이미 일부 문서화됨). 현재는 무결 |
| 6 | Testing | `process.env.NODE_ENV` 캡처가 `beforeEach` 가 아닌 describe 레벨 상수로 이루어져 Jest worker 병렬 설정 변경 시 환경 경합 가능성 | `interaction-token.service.spec.ts` `const OLD_ENV = process.env.NODE_ENV` | `const OLD_ENV` 캡처를 `beforeEach` 안으로 이동 |
| 7 | Testing | prod fail-closed 가드 테스트가 "secret 전무" 케이스만 커버. prod + `INTERACTION_JWT_SECRET` 만 설정, prod + `JWT_SECRET` 만 설정 케이스 미검증 | `interaction-token.service.spec.ts` | 선택적으로 "prod 에서 둘 중 하나라도 있으면 정상 부팅" 케이스 추가 |
| 8 | Requirement | `InteractionTokenService` prod fail-closed 가드(생성자 throw) 계약이 spec §8.3 에 명시되지 않음(spec 위반 아님, spec 누락) | `spec/5-system/14-external-interaction-api.md` §8.3 | spec §8.3 에 "NODE_ENV=production 에서 비밀 미설정 시 생성자 throw (fail-closed)" 계약 추가 |
| 9 | Maintainability | `interaction-token.service.ts` throw 메시지 특정 문자열(`NODE_ENV=production`)에 의존하는 테스트와 묵시적 결합 | `interaction-token.service.ts` L2458-L2461 + 테스트 | 에러 코드 기반 커스텀 에러 클래스 또는 테스트에서 에러 코드 검증(현재 규모에서는 허용 가능) |
| 10 | Documentation | `spec/4-nodes/3-ai/1-ai-agent.md` §7 변경 문장에 구현 상세(`exec-park full B3`, `processAiResumeTurn`)가 괄호 표현으로 과밀 노출 | `spec/4-nodes/3-ai/1-ai-agent.md` §7 | spec 목적(무엇)과 구현 상세(어떻게) 분리. 구현 참조는 Rationale 섹션으로 위임 |
| 11 | Maintainability | plan 파일이 구현 완료 기록됐으나 `plan/in-progress/` 에 위치함 | `plan/in-progress/exec-park-polish.md` | 리뷰 완료 후 plan-lifecycle 규약에 따라 `plan/complete/` 로 이동 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | dev/test fallback secret 고정 문자열(기존 동작 유지), prod fail-closed 가드 추가는 보안 개선 |
| requirement | LOW | [SPEC-DRIFT] spec 본문 4곳에 구 메서드명 `driveResumeDetached` 잔존. 코드가 옳고 spec 이 낡음 |
| side_effect | LOW | 생성자 throw 는 의도된 fail-closed. 런타임·공개 API·전역 상태 부작용 없음 |
| maintainability | LOW | constructor 가드 테스트 블록 중복, JSDoc 자기모순 주석, plan 파일 이동 필요 |
| testing | LOW | constructor 가드 describe 블록 중복, process.env 캡처 타이밍, partial secret 케이스 미검증 |
| documentation | LOW | JSDoc 잔재 표현, ai-review 내부 태그 노출, LLM_STUB_MODE 섹션 배치 불일치 |
| scope | NONE | 9개 변경 파일 모두 plan A1·A2·A3·B1·B2·C1 항목에 직접 매핑. 범위 이탈 없음 |

## 발견 없는 에이전트

없음 (모든 에이전트에서 발견사항 있음. scope 는 NONE 위험도이나 INFO 수준 중복 발견 포함).

## 권장 조치사항

1. **[SPEC-DRIFT] spec 본문 4곳 갱신**: `spec/5-system/4-execution-engine.md` L128, L903, L1306, L1311 의 `driveResumeDetached` → `driveResumeAwaited` 교체. project-planner 역할로 수행.
2. **테스트 중복 블록 통합**: `interaction-token.service.spec.ts` 의 `constructor — secret 미설정 시 prod fail-closed` describe 블록을 두 상위 describe 바깥 최상위 단일 블록으로 통합.
3. **JSDoc 자기모순 주석 제거**: `execution-engine.service.ts` `driveResumeAwaited` JSDoc 마지막 괄호 표현 제거.
4. **`ai-review W11` 태그 제거**: `ProcessTurnResult` 정의 블록 내 내부 리뷰 식별자 태그 제거.
5. **plan 파일 이동**: 리뷰 완료 후 `plan/in-progress/exec-park-polish.md` → `plan/complete/` 이동.
6. (선택) `.env.example` `LLM_STUB_MODE` 앞 소섹션 헤더 추가로 섹션 경계 명확화.
7. (선택) spec §8.3 에 `InteractionTokenService` 생성자 fail-closed 계약 명시 추가.

## 라우터 결정

- **실행**: `security`, `requirement`, `side_effect`, `maintainability`, `testing`, `documentation`, `scope` (7명 전원)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 강제 포함)