# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. `rotateBotToken` UUID 파이프 추가는 500 마스킹→400 검증 전환으로 순보안개선이며, 잔여 지적은 문서 정합성(spec 표 미반영·plan 오진단·docstring 수치 오차)과 행위 변경에 대한 실행 테스트 부재 4건의 WARNING뿐이다. 라우터 강제 화이트리스트(forced: documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표가 이번 PR 이 새로 만든 관측 가능한 실패 분기(`400 VALIDATION_ERROR` — `:id` 가 UUID 형식이 아님, `ParseUUIDPipe`)를 등재하지 않는다. 이 표는 해당 endpoint(CCH-SE-04)가 낼 수 있는 모든 `error.code`를 나열하는 canonical 문서라 성격상 반영 필요 | `spec/5-system/15-chat-channel.md` §5.4; 대응 코드 `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` `@ApiBadRequestResponse` | `project-planner` 가 표에 `400 \| VALIDATION_ERROR \| :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행 추가(developer 자기-반증형 소정정 조건 1 미충족 — planner 턴 필요) |
| 2 | requirement | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 와 `plan/in-progress/spec-draft-nullable-notation-followups.md`가 `LLM_AUTH_ERROR`를 "근접 오기"로 진단했으나, `spec/5-system/7-llm-client.md:345`는 이를 **Planned(미구현) 세분화 에러 코드**로 명시 등재한다 — 오기가 아니라 가이드가 미구현 기능을 이미 나온 것처럼 서술한 문제 | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C; `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff ~3141-3159행) | 두 plan 문서의 문구를 "근접 오기" 대신 "spec 이 Planned 로 이미 등재한 미구현 코드 — 가이드가 기 구현처럼 서술"로 정정(코드 변경 불요, 이번 PR 범위 밖이나 향후 착수자 오판 방지) |
| 3 | documentation | 신규 가드 docstring 의 실측 수치 "127건"(`@ApiParam` 인라인 리터럴 개수)이 직접 재측정(`grep -roE "@ApiParam\("` → 144건)과 약 12% 어긋난다. 정성적 결론(전부 인라인 리터럴이라 스캔 안전)은 참이나 정량 수치가 stale | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` `apiParamUuidFlags` docstring | 수치를 144로 정정하거나, 컨트롤러 추가 시 stale 해지지 않도록 "전수(N건, 실측 시점)" 형태로 완화 |
| 4 | testing | `rotateBotToken` 의 500→400 행위 변경(CHANGELOG 에 "Behavior change" 로 명시)을 검증하는 실행 가능한 테스트가 없다. 컨트롤러 spec 은 `new TriggersController(...)` 직접 생성이라 Nest 파이프라인이 실행되지 않아 `ParseUUIDPipe` 자체가 동작하지 않고, 관련 e2e 도 0건. 신규 가드는 "선언 존재"만 정적으로 확인 | `codebase/backend/src/modules/triggers/triggers.controller.ts:291`; `triggers.controller.spec.ts` | `Test.createTestingModule` + mock `TriggersService` + supertest 로 `POST .../rotate-bot-token` 비-UUID id → 400 확인하는 가벼운 통합 테스트 추가(DB·e2e 인프라 불요) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `rotateBotToken` 의 `ParseUUIDPipe` 추가는 실질적 보안 개선 — 비-UUID 입력이 DB 까지 흘러 SQLSTATE 22P02 로 500 마스킹되던 것을 400 명시적 검증으로 전환. SQL 인젝션 경로 아니며 정보 노출 없음(security·performance·database·api_contract 다중 확인) | `triggers.controller.ts:291` | 조치 불요 |
| 2 | 보안 | `GlobalExceptionFilter` 는 여전히 SQLSTATE 22P02 를 분류하지 못한다 — 이번 PR 은 컨트롤러 파이프로 우회했을 뿐 필터 자체 방어선은 미보강. 향후 새 엔드포인트가 파이프 부착을 누락하면 같은 500-마스킹 재발 가능 | `codebase/backend/src/common/filters/http-exception.filter.ts` | (범위 밖) 후속으로 22P02→400 분기를 필터에 추가하면 이중 방어 |
| 3 | 아키텍처 | `ERROR_KO` 가 서로 다른 layer(chat-channel API vs webhook 인입 경로)의 에러 코드를 하나의 flat record 에 주석만으로 구분 — 이번 `TRIGGER_NOT_FOUND` 오귀속 버그의 구조적 원인이며 경계가 주석에만 의존해 재발 가능 | `codebase/frontend/src/lib/i18n/backend-labels.ts:602-614` | 후속으로 origin 별 네임스페이스(`{hooks:{...}, chatChannel:{...}}`) 분리 검토 |
| 4 | 테스트/아키텍처 | `scanUuidParams` 의 `ParseUUIDPipe` 판정이 텍스트 부분일치 — 별칭 import(`ParseUUIDPipe as X`) 시 조용히 우회 가능(저장소 실측 별칭 0건, 주석에 한계 명시됨) | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` | 별칭 import 도입 시 심볼 해석 기반으로 강화 검토 |
| 5 | 범위 | 가드 baseline-zero 설계로 원 신고 대상(트리거 1곳) 밖 `auth.controller.ts`(`switchWorkspace`)도 함께 수정됨 + 원 결함(1줄) 대비 신규 가드 인프라(3파일, ~300줄)가 상당히 무거움 — 둘 다 plan/`--impl-prep` 근거가 문서화되어 있어 임의 확장은 아님 | `codebase/backend/src/modules/auth/auth.controller.ts:433-440`; `param-uuid-pipe-guard.ts` 등 | 조치 불요 — merge 시 diff 크기 과소평가 주의만 |
| 6 | 범위 | MCP 환경변수명 오탈자 수정(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)이 이번 배치 주제(trigger UUID·chat-channel 가이드 코드)와 직접 관련 없는 영역에 포함 — 감사 방법론 확장 과정에서 함께 발견·수정된 것으로 plan 에 투명하게 기록됨 | `mcp-servers.mdx:39`, `mcp-servers.en.mdx:28` | 조치 불요, 리스크 낮음(정확성 확인됨) |
| 7 | 성능 | `param-uuid-pipe.spec.ts` 안에서 두 `it` 블록이 각각 `scanUuidParams()`를 재호출 — 컨트롤러 35개 전량 AST 재파싱이 중복(대조군 블록은 이미 1회 계산 패턴 사용) | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:65,71` | `beforeAll`/블록 최상단에서 1회만 계산 후 `.scanned`/`.violations` 재사용 |
| 8 | 유지보수성 | `CHAT_CHANNEL_CODES` 배열명이 실제 원소(`TRIGGER_NOT_FOUND` 포함, hooks 코드)와 어긋남 — 이번 PR 이전(#568)부터 있던 pre-existing 부채, 이번 정정과 같은 클래스의 잔여 문제 | `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (`CHAT_CHANNEL_CODES` 선언부) | 후속으로 배열명 개명 또는 `TRIGGER_NOT_FOUND` 분리 검토(이번 PR 스코프 아님) |
| 9 | 문서화 | `rotate-bot-token`의 신규 `400 VALIDATION_ERROR` 케이스가 이번에 수정한 유저가이드 Callout(`triggers.mdx`/`.en.mdx`) 목록에는 반영되지 않음 — `VALIDATION_ERROR`가 API 전반의 범용 400 fallback 코드라 의도된 스코프 배제로 판단됨(user_guide_sync 도 "조치 불요"로 결론) | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` Callout | 선택 — 완전성 원하면 한 줄 추가, 블로킹 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `ParseUUIDPipe` 추가=보안 개선, 신규 취약점 없음. `GlobalExceptionFilter` 22P02 근본 갭은 잔존(INFO) |
| performance | LOW | 신규 가드 spec 내 `scanUuidParams` 중복 호출(INFO), 런타임 영향은 순증(net positive) |
| architecture | LOW | `ERROR_KO` flat record 구조적 취약점, 가드 텍스트매칭 한계(둘 다 INFO) — 새 안티패턴 없음 |
| requirement | LOW | spec §5.4 표 미반영(WARNING), plan `LLM_AUTH_ERROR` 오진단(WARNING) — 핵심 코드 변경 3곳은 전부 실측 일치 |
| scope | LOW | baseline-zero 설계 파생 확장(auth.controller.ts), 원 결함 대비 무거운 가드, MCP 오탈자 곁다리 포함 — 전부 근거 문서화됨(INFO) |
| side_effect | LOW | `rotateBotToken` 500→400 공개 계약 변경은 CHANGELOG 에 고지·검증됨. 나머지는 순수 가법적 변경 |
| maintainability | LOW | `CHAT_CHANNEL_CODES` 배열명 불일치(pre-existing, INFO) 외 특기사항 없음 |
| testing | LOW | 500→400 행위 변경을 검증하는 실행 테스트 부재(WARNING). 신규 가드 자체 테스트 품질은 높음 |
| documentation | LOW | 가드 docstring 수치 오차(WARNING: 127 vs 144), Callout 미기재(INFO) 외 대부분 실측 정확 |
| dependency | NONE | 신규 외부 의존성 없음, 기존 devDependency(`typescript`)·내부 유틸 재사용 |
| database | NONE | 스키마·쿼리·트랜잭션·마이그레이션 관련 변경 없음 |
| concurrency | NONE | 공유 상태·락·비동기 오케스트레이션 관련 변경 없음 |
| api_contract | LOW | 500→400 breaking change 는 영향평가·CHANGELOG 고지 동반, 형제 엔드포인트 정합성 확인됨 |
| user_guide_sync | NONE | 매칭된 `backend-api-change` 행 동반 갱신 전부 이행. 선재 결함(TRIGGER_NOT_FOUND 6곳, MCP 오탈자 2곳)도 같은 turn 에 정정 |

## 발견 없는 에이전트

- database — 데이터베이스 스키마·쿼리·트랜잭션·마이그레이션·커넥션 관련 변경 없음(해당 없음)
- concurrency — 공유 자원 동시 접근·락·비동기 오케스트레이션 관련 변경 없음(해당 없음)

## 권장 조치사항

1. (`project-planner`) `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표에 `rotate-bot-token`의 신규 `400 VALIDATION_ERROR`(`:id` UUID 형식 오류, `ParseUUIDPipe`) 행 추가
2. `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C 및 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 `LLM_AUTH_ERROR` "근접 오기" 진단을 "spec Planned 미구현, 가이드 오기술"로 정정
3. `param-uuid-pipe-guard.ts` docstring 의 실측 수치 "127건"을 재검증하여 정정(또는 시점 명시 표현으로 완화)
4. `rotateBotToken`의 500→400 행위 변경을 검증하는 가벼운 통합 테스트(`Test.createTestingModule` + mock service + supertest) 추가 검토
5. (선택, 범위 밖) `GlobalExceptionFilter`에 SQLSTATE 22P02(invalid_text_representation) → 400 분기를 추가해 파이프 부착 누락에 대한 이중 방어 검토
6. (선택) `triggers.mdx`/`.en.mdx` Callout 에 신규 400 케이스 한 줄 추가

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer(14명) 실행.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(forced 미이행 없음).