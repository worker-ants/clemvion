# 보안(Security) Review

대상: `ai-usage-attribution-hardening` (llm_usage_log attribution 배선 — B1 타입 주석 + C1 메모리 요약 chat 배선)

## 발견사항

- **[INFO]** attribution ID(`workflowId`/`executionId`/`nodeExecutionId`) 가 런타임 미검증 캐스트로 DB insert 컬럼에 도달
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:294-298` (`args.config.workflowId as string | undefined`, `args.config.nodeExecutionId as string | undefined`), 소비처 `codebase/backend/src/modules/llm/llm.service.ts:186-195` → `codebase/backend/src/modules/llm/llm-usage-log.service.ts:48-63`
  - 상세: `args.config` 는 `Record<string, unknown>` (resume state) 이고 `workflowId`/`nodeExecutionId` 필드는 런타임 타입 검증 없이 `as string | undefined` 로 단순 캐스트된다. 다만 하류가 TypeORM `repository.insert(...)` (파라미터 바인딩) 이므로 SQL 인젝션 경로는 없고, 값이 문자열이 아니면 insert 자체가 실패해 `try/catch` 로 삼켜지고 경고 로그만 남는다(가용성/정확성 저하이지 인젝션/권한상승은 아님). 이 값들은 엔진(`buildRetryReentryState`)이 주입하는 내부 시스템 식별자이고 워크플로 노드 config 로 사용자가 직접 지정 가능한 필드가 아니므로 공격자 통제 입력 표면으로 보기는 어렵다.
  - 제안: 현재로선 조치 불요(관측 인프라 성격, DB write 는 파라미터화됨). 향후 이 세 필드가 사용자-입력 가능한 config 경로로 확장될 경우 `typeof === 'string'` narrow 를 명시적으로 추가해 오염 데이터가 `llm_usage_log`(과금/원가 리포트에 쓰이는 attribution 테이블)에 잘못 적재되는 것을 방지 권장.

- **[INFO]** 신규 `llmContext` 배선 자체는 시크릿/PII 를 포함하지 않음 — 확인만
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:2733-2743` (`llmService.chat(llmConfig, {...}, llmContext)`), `agent-memory-injection.spec.ts:2014-2040`
  - 상세: 전달되는 3개 필드는 워크플로/실행/노드실행 PK(UUID 성격) 뿐이며, API 키·자격증명 등은 `llmConfig`(ModelConfig 엔티티, 기존 경로 그대로) 를 통해서만 흐르고 이번 diff 로 신규 노출 경로가 생기지 않는다. 테스트 픽스처 값(`'wf-1'`, `'exec-1'`, `'nodeexec-row-1'`) 은 명백한 더미이며 실제 시크릿이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `LlmCallContext` 명시 타입 주석 추가(B1) 는 순수 컴파일 타임 강화 — 긍정적 보안 영향
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:485-491`
  - 상세: `const llmContext: LlmCallContext = {...}` 로 excess-property check 를 활성화해 attribution 필드 오탈자/오사입을 컴파일 타임에 차단한다. 이는 회귀 방지 목적의 방어적 강화이며 새로운 공격 표면을 만들지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 `llm_usage_log` attribution(과금/집계 추적용 워크플로우·실행·노드실행 ID) 을 AI Agent 자동 메모리 롤링 요약 chat 경로까지 배선하고, 기존 turn-executor 배선에 명시 타입을 부여하는 좁은 범위의 변경이다. 인젝션(SQL/XSS/커맨드), 하드코딩 시크릿, 인증/인가, 암호화, 에러 노출 관점에서 새로운 취약점을 도입하지 않는다 — 전달되는 값은 사용자 자유 입력이 아닌 엔진 발급 내부 ID 이고, 최종 저장 경로는 TypeORM 파라미터 바인딩(`repository.insert`) 이라 인젝션 여지가 없다. 유일한 잔여 관찰점은 `args.config.*` 캐스트가 런타임 미검증이라는 점인데, 현재 값 출처(엔진 내부 주입)를 고려하면 실질 위험은 낮다.

## 위험도

NONE
