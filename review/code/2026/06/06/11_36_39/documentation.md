# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] StubLlmClient 클래스 문서 — 양호, 메서드 JSDoc 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/clients/stub.client.ts` L8–23 (클래스 JSDoc), L25/L39/L44/L48 (메서드)
- 상세: 클래스 수준 JSDoc 블록이 목적·활성화 조건·동작·프로덕션 비활성화 근거를 명확히 서술하고 있어 문서화 품질이 우수하다. 그러나 공개 메서드 4개(`chat`, `embed`, `listModels`, `testConnection`) 에는 개별 JSDoc 이 없다. `embed` 는 인라인 주석("결정적 3차원 zero 벡터 — embedding 경로 e2e 가 없으므로 형태만 충족")이 있어 의도를 전달하지만, `chat` 의 echo 슬라이싱 한계(200자)·`model` fallback 동작·`finishReason` 고정값 같은 계약 사항은 스펙 문서로서 기록되지 않았다.
- 제안: 최소한 `chat` 메서드에 `@returns` 간략 JSDoc 추가: 슬라이싱 한계, 항상 `toolCalls: []`(멀티턴 waits 보장 이유), `finishReason: 'stop'` 고정 이유를 1~2줄로 명시. `embed` 의 차원 임의성 주석("embedding e2e 추가 시 실제 차원과 일치하도록 교체 필요")도 클래스 JSDoc 또는 메서드 JSDoc 으로 격상 권장.

### [INFO] `llm.service.ts` — `createClient` 인라인 주석 양호, 단 환경변수 문서화 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/llm.service.ts` L71–85
- 상세: `LLM_STUB_MODE` 분기 앞의 인라인 주석이 목적·전제·리뷰 추적 참조(W5/I7)를 포함해 충분히 자세하다. 그러나 이 환경변수 자체가 어디에서도 공식 문서화(README, `.env.example`, spec 환경변수 목록)되지 않은 상태인지 확인 필요. `OAUTH_STUB_MODE` 선례 주석에 의존하는데, `OAUTH_STUB_MODE` 가 문서화된 위치가 있다면 `LLM_STUB_MODE` 도 같은 위치에 등재되어야 한다.
- 제안: `.env.example` 또는 e2e 설정 문서에 `LLM_STUB_MODE=true # e2e 전용, 프로덕션 절대 사용 금지` 항목 추가. 이미 `docker-compose.e2e.yml` 에만 주입된다면, compose 파일 내 주석이 SoT 역할을 하고 있는지 확인하고 명시.

### [INFO] `main.ts` — `LLM_STUB_MODE` 가드 인라인 주석 적절
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/main.ts` L203–211
- 상세: 신규 추가된 fail-closed 가드 블록 앞 주석이 목적("e2e only"), 동작("모든 LLM provider call 을 결정적 stub 으로 대체"), 위험("프로덕션에서 AI 응답 전체 대체"), 선례 참조("OAUTH_STUB_MODE 와 동일 패턴")를 포함해 충분히 자세하다. 별도 JSDoc 불요.
- 제안: 없음.

### [INFO] `stub.client.spec.ts` — 파일 수준 JSDoc 양호, 경계값 의도 명시적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/clients/stub.client.spec.ts` L1–13
- 상세: 파일 상단 JSDoc 블록이 테스트 목적과 검증 계약(echo·200자 슬라이싱·tool call 부재·embed/listModels/testConnection 형태)을 한눈에 설명한다. 각 `it` 설명도 한국어로 동작을 명확히 기술한다. 문서화 수준 우수.
- 제안: 없음.

### [INFO] `llm.service.spec.ts` — 신규 describe 블록 인라인 레이블 충분
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` L607 (describe 레이블 `'LLM_STUB_MODE (createClient) — review W3'`)
- 상세: `describe` 레이블이 목적과 리뷰 추적 태그를 포함한다. 각 `it` 설명이 기대 동작을 명확히 기술한다. 별도 파일 수준 JSDoc 추가는 불필요.
- 제안: 없음.

### [INFO] `package.json` — devDependency 추가, 문서화 관점 이슈 없음
- 위치: `codebase/backend/package.json` (신규: `jsonwebtoken: 9.0.3`, `@types/jsonwebtoken: ^9.0.0`)
- 상세: `package.json` 자체는 별도 문서가 필요 없는 설정 파일이다. 버전을 pin 한 이유(전이 의존성 신뢰성)가 RESOLUTION.md 에 기록되어 있어 추적 가능하다.
- 제안: 없음.

### [INFO] CHANGELOG/README 업데이트 필요성 — 내부 인프라 변경으로 공개 문서 불요
- 위치: 전체 변경 범위
- 상세: 이번 변경은 `LLM_STUB_MODE` env-gated stub 추가와 e2e 테스트 확장이다. 공개 API 엔드포인트나 사용자 대면 기능 변경이 없으므로 README 사용자 가이드·CHANGELOG 갱신 의무는 없다. 단, 개발자 온보딩 문서(`.env.example` 또는 PROJECT.md)에 e2e 전용 환경변수 목록이 유지된다면 `LLM_STUB_MODE` 항목 추가가 권장된다.
- 제안: 팀 개발자 온보딩 문서 또는 `docker-compose.e2e.yml` 상단 주석 블록에 `LLM_STUB_MODE` 설명 한 줄 추가. 이미 compose 파일에 주석이 있는지 확인 후 결정.

## 요약

이번 PR-B2a 변경(LLM stub + e2e 멀티턴 AI park 테스트)의 문서화 수준은 전반적으로 양호하다. `StubLlmClient` 클래스 JSDoc 은 목적·동작·프로덕션 비활성화 근거를 포함해 잘 작성됐고, `main.ts` 가드·`llm.service.ts` 분기 인라인 주석도 충분히 자세하다. 유일한 개선 기회는 (1) `StubLlmClient` 의 `chat` 메서드 계약(200자 슬라이싱, `toolCalls: []` 이유)이 메서드 수준 JSDoc 없이 클래스 JSDoc 에만 암시적으로 기술된 점, (2) `LLM_STUB_MODE` 환경변수가 `.env.example` 또는 개발자 온보딩 문서에 명시적으로 등재되지 않은 점이다. 두 항목 모두 INFO 수준으로 기능 동작에 영향 없으며, 즉각 수정이 요구되는 문서 결함은 없다.

## 위험도

NONE
