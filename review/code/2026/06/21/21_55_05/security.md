# 보안(Security) 리뷰

> 대상 커밋: 960968b4 — AiMemoryManager 테스트 커버리지 보강 (14→17 케이스)
> 리뷰 세션: 2026/06/21 21_55_05

## 발견사항

### [INFO] `_retry_state.json` 에 개발 머신 절대 경로 포함
- 위치: `review/code/2026/06/21/21_43_55/_retry_state.json` — `session_dir`, `summary_output_file`, `router_prompt_file`, `router_output_file`, `prompt_file`, `output_file` 등 다수 필드
- 상세: `/Volumes/project/private/clemvion/.claude/worktrees/...` 형태의 개발 머신 절대 경로가 git 이력에 커밋된다. 파일시스템 구조(볼륨명·프로젝트 경로)가 공개 이력에 영구 노출되며, 소셜 엔지니어링 또는 타깃 공격 시 환경 정보로 활용될 수 있다. production 코드나 시크릿 노출은 아니므로 즉각적 취약점은 아니나 정보 최소화 원칙 위반이다.
- 제안: `review/**/_retry_state.json` 을 `.gitignore` 에 추가해 향후 커밋을 방지한다. 현재 이력에 이미 포함된 파일은 별도 위생 작업(git history rewrite 또는 수용 결정) 대상.

### [INFO] 테스트 픽스처의 `as unknown as` 연쇄 캐스팅 — 런타임 검증 부재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` — `agentMemFake()`, `llmFake()`, `threadFake()` 팩토리 함수 반환부 및 호출 측 캐스팅 다수
- 상세: `as unknown as Ctor[N]` 이중 캐스팅으로 fake 객체가 실제 타입에 할당된다. 테스트 파일이므로 production 보안 위험은 없다. 단, 본 패턴이 production 코드로 복제될 경우 런타임 타입 불일치를 컴파일러가 감지하지 못한다. 현재 변경은 test-only이며 verbatim 이동 패턴의 일부로 신규 위험은 아니다.
- 제안: 중장기적으로 production `ai-memory-manager.ts` 내 `config as number`/`as string` 강제 캐스팅에 Zod 스키마 또는 런타임 검증 헬퍼를 적용한다(test 변경 범위 밖, 별도 개선).

### [INFO] 테스트 픽스처 내 하드코딩된 식별자 값
- 위치: `ai-memory-manager.spec.ts` — `workspaceId: 'ws-1'`, `executionId: 'exec-1'`, `selfNodeId: 'node-1'`, `memoryKey: 'k1'`, `summaryModelConfigId: 'sum-cfg'`
- 상세: 테스트 픽스처의 상수값이므로 실제 시크릿·토큰이 아니다. 의미 없는 더미값이며 보안 위험 없음. 언급하는 이유는 완전성을 위해서이며, 실제 API 키·비밀번호 등이 하드코딩된 경우는 발견되지 않았다.
- 제안: 현 상태 유지. 별도 조치 불필요.

## 요약

이번 변경은 production 로직 무변경(주석 4줄 + 단위 테스트 17건 신설)이므로 보안 관점 실질 위험은 매우 낮다. SQL 인젝션·XSS·커맨드 인젝션·경로 탐색·하드코딩된 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 민감 정보 노출 등 OWASP Top 10 범주의 취약점은 발견되지 않았다. 신규 의존성 추가도 없다. 유일한 보안 관련 관찰사항은 `_retry_state.json` 에 커밋된 개발 머신 절대 경로인데, 이는 이전 리뷰 세션(21_26_26)에서 이미 식별된 패턴의 동일 반복이며 production 코드나 시크릿과 무관하다. 기존 RESOLUTION.md에서도 INFO로 분류하고 `.gitignore` 추가를 권장한 사항과 동일하다.

## 위험도

NONE
