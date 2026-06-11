# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능·보안·범위 모두 이상 없음. spec 갱신 필요(SPEC-DRIFT 1건)와 테스트 개선 권고 다수.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/1-auth.md` §"Production fail-closed 가드" 대상 목록(558–566행)이 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 를 누락하고 있으며, 섹션 제목도 이 플래그를 언급하지 않는다. 코드 구현은 올바르고 되돌리는 것이 오답이다. | `spec/5-system/1-auth.md` L558–566 | 코드 유지. `spec/5-system/1-auth.md` §"Production fail-closed 가드" 대상 목록에 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 불릿 추가 및 섹션 제목 갱신. `project-planner` 위임. |
| 2 | Testing | `MIN_JWT_SECRET_LENGTH` 경계값 테스트 없음 — 정확히 31자(throw)와 32자(pass) 케이스가 없어, 상수 값 변경 시 테스트가 탐지하지 못한다. | `production-guards.spec.ts` L263–274 | `'x'.repeat(MIN_JWT_SECRET_LENGTH - 1)` throw 케이스, `'x'.repeat(MIN_JWT_SECRET_LENGTH)` pass 케이스 추가. |
| 3 | Testing | `beforeAll` 내 `readFileSync` 실패 시 `envExampleContent` 가 `undefined` 인 채로 남아 타입 계약 위반 — 런타임엔 Jest skip 이 방어하나 컴파일러 수준 표현이 부정확. | `production-guards.spec.ts` L195 | `let envExampleContent!: string;` 로 definite assignment assertion 적용. |
| 4 | Testing | `beforeAll` 내 I/O 실패 시 오류 메시지가 불명확 — 워크트리·CI 경로 차이 디버깅 비용 증가. | `production-guards.spec.ts` L382–383 | `beforeAll` 에 `try/catch` 추가하여 파일 경로 포함 가독성 있는 오류 메시지 출력. |
| 5 | Testing | `blacklist Set sync` describe 에 stub 모드 동기화 테스트가 없는 이유가 명시되지 않아 향후 유지보수자 혼란 가능성. | `production-guards.spec.ts` `blacklist Set sync` describe | 해당 describe 상단 주석에 "stub 모드는 Set 블랙리스트 방식이 아닌 `isFlagOn` 논리로 처리하므로 동기화 테스트 불필요" 한 줄 추가. |
| 6 | Testing | `assertProductionConfig` 수준에서 `OAUTH_STUB_MODE='false'` 명시 시 pass 케이스 테스트 없음. | `production-guards.spec.ts` assertProductionConfig describe | `OAUTH_STUB_MODE='false'` 명시 pass 케이스 추가. |
| 7 | Documentation | README 환경변수 목록에 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 항목 미열거 — 배포 주의 callout 과 연결성 부족. | `codebase/backend/README.md` L24–34 | 환경변수 목록에 두 변수 한 줄 추가. |
| 8 | Documentation | README 환경변수 목록에 `MCP_ALLOW_INSECURE_URL` 미열거 — 배포 주의 callout 에 등장하지만 목록에 없음. | `codebase/backend/README.md` L24–34 | 환경변수 목록에 `MCP_ALLOW_INSECURE_URL` 항목 추가. |
| 9 | Documentation | `production-guards.spec.ts` 파일 최상위 docblock 이 `blacklist Set sync` describe 블록의 파일 I/O 패턴을 설명하지 않아 "전부 순수 함수 테스트"로 오해 가능. | `production-guards.spec.ts` L1–4 | 최상위 docblock 에 `beforeAll` 지연 로드 이유 한 줄 추가. |
| 10 | Documentation | `jwt.config.ts` 에 모듈 수준 JSDoc 없음 — 테스트 파일 주석에서 정정한 `registerAs` 반환 동작 설명이 소스에 반영되지 않음. | `codebase/backend/src/common/config/jwt.config.ts` 전체 | `export const jwtConfig` 위에 JSDoc 한 줄 추가. |
| 11 | Security | `jwt.config.ts` dev fallback `'dev-jwt-secret'` 이 소스에 평문 리터럴로 존재. `INSECURE_JWT_SECRETS` 블랙리스트에 등재되어 production 부팅 시 차단되므로 실질 위험 없음. | `codebase/backend/src/common/config/jwt.config.ts` L4 | 현행 차단 충분. `INSECURE_JWT_SECRETS` 와 동기화 유지 (이미 테스트로 검증됨). |
| 12 | Testing | `process.env` 직접 조작 후 `try/finally` 복원 패턴은 단일 스레드 직렬에서 안전하지만, Jest worker 격리 환경 확장 시 경쟁 조건 잠재 가능성. | `production-guards.spec.ts` L396–405 | 주석에 "Jest 파일 내부 직렬 실행이므로 안전" 명시 또는 `jest.replaceProperty` 적용 검토. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-closed 가드 설계 양호, 새 취약점 없음 |
| requirement | LOW | SPEC-DRIFT: `spec/5-system/1-auth.md` stub 플래그 목록 누락 |
| scope | NONE | 3가지 변경 모두 범위 내, 이탈 없음 |
| side_effect | — | 출력 파일 없음 (재시도 필요) |
| maintainability | NONE | README 구조화·테스트 격리·주석 정정 모두 개선 방향 |
| testing | LOW | 경계값 테스트 누락, definite assignment assertion, I/O 오류 메시지 개선 권고 |
| documentation | LOW | README 환경변수 목록 미완성, jwt.config.ts JSDoc 누락 |

## 발견 없는 에이전트

- **security**: 새 취약점·보안 이슈 없음 (INFO만)
- **scope**: 범위 이탈 없음 (INFO만)
- **maintainability**: 구조적 문제 없음 (INFO만)

## 권장 조치사항

1. **[SPEC-DRIFT] `spec/5-system/1-auth.md` 갱신** — `project-planner` 에 위임하여 §"Production fail-closed 가드" 대상 목록에 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 추가 및 섹션 제목 수정. 코드 revert 금지.
2. **경계값 테스트 추가** — `MIN_JWT_SECRET_LENGTH - 1` (throw) / `MIN_JWT_SECRET_LENGTH` (pass) 케이스를 `production-guards.spec.ts` 에 추가.
3. **`beforeAll` I/O 방어 강화** — `readFileSync` 를 `try/catch` 로 감싸 파일 경로 포함 진단 메시지 출력 + `let envExampleContent!: string` definite assignment assertion 적용.
4. **README 환경변수 목록 보완** — `OAUTH_STUB_MODE`/`LLM_STUB_MODE`/`MCP_ALLOW_INSECURE_URL` 항목 추가.
5. **테스트 주석 보완** — `blacklist Set sync` describe 상단에 stub 모드 동기화 테스트 불필요 이유 명시. `process.env` 조작 패턴에 직렬 안전성 주석 추가.
6. **`jwt.config.ts` JSDoc 추가** — `registerAs` 반환 팩토리 동작 설명 한 줄.
7. **`spec.ts` 최상위 docblock 갱신** — `beforeAll` 지연 로드 이유 한 줄 추가.

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행 (forced)**: `security`, `requirement`, `scope`, `side_effect`, `testing`, `maintainability`, `documentation` (7명, 전원 router_safety 강제 포함)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | router_safety 미포함 (라우터 제외) |
| architecture | router_safety 미포함 (라우터 제외) |
| dependency | router_safety 미포함 (라우터 제외) |
| database | router_safety 미포함 (라우터 제외) |
| concurrency | router_safety 미포함 (라우터 제외) |
| api_contract | router_safety 미포함 (라우터 제외) |
| user_guide_sync | router_safety 미포함 (라우터 제외) |

**참고**: `side_effect` reviewer 의 출력 파일(`side_effect.md`)이 디스크에 존재하지 않아 내용을 읽을 수 없음 — 재시도 필요 1건.