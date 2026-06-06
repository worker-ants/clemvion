# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경이 없고 모든 수정이 e2e 테스트·인프라 설정·spec 문서에 국한됨. 기능 완전성 결함 없음. WARNING 4건은 spec fidelity 공백 및 테스트 위생 항목이며 즉각적 운영 위험 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | interaction token fallback secret `'interaction-fallback'` 리터럴이 공개 spec 문서에 노출됨. 프로덕션 fail-closed 가드 구현 여부 미확인 | `spec/5-system/14-external-interaction-api.md` §8.3 (L1907) | `main.ts` 또는 ConfigService 초기화 시 `INTERACTION_JWT_SECRET`/`JWT_SECRET` 미설정이면 production에서 fail-closed throw 하는 가드 적용 확인. spec에서 fallback 리터럴 값 제거 권장 |
| 2 | Security | `docker-compose.e2e.yml` ENCRYPTION_KEY가 순차 hex 패턴(`0123456789abcdef...`)으로 엔트로피 없음. 길이 교정(32→64hex)은 완료됐으나 값 자체가 예측 가능 | `docker-compose.e2e.yml` L886, L1038 | CI 시크릿 인젝션 또는 `$(openssl rand -hex 32)` 랜덤 값으로 교체 권장 |
| 3 | Documentation | `spec/5-system/7-llm-client.md` §7.1 에 `StubLlmClient`의 결정적 echo 응답 계약(`[stub] received: <msg>`, no tool call, 재-park 보장)이 미기재. spec-as-SoT 원칙상 구현 파일 링크도 누락 | `spec/5-system/7-llm-client.md` §7.1 | §7.1에 stub 응답 계약 1~2줄 추가 및 `stub.client.ts` bracket link 포함. project-planner 위임 |
| 4 | Testing | `ENCRYPTION_KEY` 64-hex 교정이 다른 e2e 스위트(`workflow-execution.e2e-spec.ts` 등)에 미치는 무회귀 실행 증거 미제공. plan ④항에 "기존 e2e(174+) 무회귀 확인" 명시됐으나 확인되지 않음 | `docker-compose.e2e.yml` ENCRYPTION_KEY 변경 전반 | 전체 e2e suite 실행 후 무회귀 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | e2e JWT_SECRET 하드코딩 fallback — 테스트 전용이며 환경변수 우선 구조 올바름 | `execution-park-resume.e2e-spec.ts` L495-497 | CI에서 JWT_SECRET 항상 주입 확인 |
| 2 | Security | `mintInteractionToken`이 production과 동형 JWT payload 직접 생성 — test 디렉토리 격리됨 | `execution-park-resume.e2e-spec.ts` L521-529 | 현상태 유지 |
| 3 | SPEC-DRIFT | `spec/5-system/7-llm-client.md §7.1` LLM_STUB_MODE 섹션 추가 — 코드 구현과 일치하는 정상 SPEC-DRIFT 반영 | `spec/5-system/7-llm-client.md` §7.1 | 코드 유지 + spec 반영 완료 |
| 4 | SPEC-DRIFT | `spec/5-system/14-external-interaction-api.md §8.3` `itk_*`/`iext_*` token family 분리 명시 — 코드 구현과 line-level 일치하는 SPEC-DRIFT 반영 | `spec/5-system/14-external-interaction-api.md` §8.3, §10.1 | 코드 유지 + spec 반영 완료 |
| 5 | SPEC-DRIFT | `spec/data-flow/3-execution.md` park/rehydration 시퀀스에 `resume_call_stack` 추가 — PR-B2b(V087) 구현의 누락 문서 보완 | `spec/data-flow/3-execution.md` L48-51, L107-110 | 코드 유지 + spec 반영 완료 |
| 6 | Requirement | `spec/5-system/7-llm-client.md §7.1` stub 응답 포맷(`[stub] received: <msg>`) spec 미기재 — 구현 오류 아닌 spec 보완 대상 | `spec/5-system/7-llm-client.md §7.1` | project-planner 위임으로 spec 보완 |
| 7 | Requirement | plan 항목 ①②③④ 모두 구현 완료됐으나 plan 파일이 `in-progress`에 잔류 — plan 마감 절차 미완 | `plan/in-progress/exec-park-b2a-followup.md` | 모든 항목 완료 시 `plan/complete/`로 이동 |
| 8 | Testing | `INTERACTION_JWT_SECRET` 미주입으로 secret fallback 체인에 암묵적 의존 — 현재 동작 정상이나 향후 env 분리 시 불일치 위험 | `docker-compose.e2e.yml`, `execution-park-resume.e2e-spec.ts` L416-421 | `docker-compose.e2e.yml`에 `INTERACTION_JWT_SECRET` 명시 설정 및 mint 경로 동기화 권장 |
| 9 | Testing | `waitForUserTurn` 주석이 "user 메시지가 thread에 push된 시점"으로 혼동 가능 — 실제 turn 완료는 후속 re-park poll로 확인됨 | `execution-park-resume.e2e-spec.ts` L544-562 | 주석을 "cold rehydration 1회 사이클 진행 중 확인"으로 보정 |
| 10 | Testing | `end_conversation` 응답 body `accepted: true` 검증 누락 — `submit_message`는 검증하나 일관성 없음 | `execution-park-resume.e2e-spec.ts` L749-754 | `expect(res.body.data?.accepted).toBe(true)` 추가 권장 |
| 11 | Testing | `StubLlmClient.embed`(zero 벡터) 및 `listModels`(stub-model 1건) 동작이 spec §7.1에 미언급 | `spec/5-system/7-llm-client.md §7.1`, `stub.client.ts` L45-56 | spec에 한 줄 추가 권장 |
| 12 | Maintainability | `createWorkflow`/`saveCanvas`/`poll` 헬퍼 함수가 두 describe 블록에 중복 정의됨 (poll timeoutMs만 상이: 15000 vs 20000) | `execution-park-resume.e2e-spec.ts` L155-200 vs L531-576 | `test/helpers/`로 추출해 공유 리팩터링 권장 |
| 13 | Maintainability | `as never` 타입 캐스팅이 8곳에 산재 — `TERMINAL_STATUSES.includes(s as never)` 패턴 | `execution-park-resume.e2e-spec.ts` L252, L284, L389, L430, L716, L754, L796, L832 | `isTerminal` 헬퍼 함수로 집약 권장 |
| 14 | Scope | plan §③(durable 컬럼 doc-sync — `data-flow/3-execution.md`) 이번 커밋 미포함 — project-planner 도메인으로 별도 진행 예정 | `plan/in-progress/exec-park-b2a-followup.md` §③ | 범위 이탈 아님. 별도 진행 확인 |
| 15 | Dependency | 신규 외부 패키지 없음, `jsonwebtoken` 9.0.3 고정 유지 — CVE 해당 없음 | `codebase/backend/package.json` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | interaction token fallback 리터럴 spec 노출(WARNING), ENCRYPTION_KEY 엔트로피 낮음(WARNING) |
| requirement | LOW | stub 응답 포맷 spec 미기재(WARNING), plan 마감 절차 미완(INFO). 기능 완전성 결함 없음 |
| scope | NONE | 5개 파일 모두 plan 항목 ①②③④ 범위 내. scope creep 없음 |
| side_effect | NONE | 의도하지 않은 부작용 없음. e2e 부작용 범위 확대는 의도된 변경 |
| maintainability | LOW | 헬퍼 함수 중복, `as never` 산재 — 기존 패턴 유지이며 신규 도입 아님 |
| testing | LOW | 무회귀 실행 증거 미제공(WARNING), `end_conversation` body 검증 누락, secret 경로 암묵적 의존 |
| documentation | LOW | `StubLlmClient` echo 계약 및 파일 링크 spec 미기재(WARNING) |
| dependency | NONE | 신규 외부 의존성 없음. 내부 의존 방향 개선됨 |

## 발견 없는 에이전트

- **dependency**: 신규 외부 패키지 추가 없음. 모든 항목 INFO 수준.
- **scope**: scope creep 발견 없음. 모든 항목 INFO 수준.
- **side_effect**: 의도치 않은 부작용 없음. 모든 항목 INFO 수준.

## 권장 조치사항

1. **[WARNING-1 · security]** `main.ts` 또는 ConfigService 초기화 시 `INTERACTION_JWT_SECRET`/`JWT_SECRET` 미설정 production fail-closed 가드 구현 여부 확인. 미구현이면 `LLM_STUB_MODE` 가드와 동일 패턴 적용. spec §8.3에서 fallback 리터럴 `'interaction-fallback'` 값 자체 제거.
2. **[WARNING-4 · testing]** 전체 e2e suite 실행 후 ENCRYPTION_KEY 교정의 무회귀 확인. 특히 `POST /api/llm-configs` 또는 AES-256-GCM 암호화 경로를 사용하는 타 스위트 점검.
3. **[WARNING-3 · documentation]** `spec/5-system/7-llm-client.md §7.1`에 `StubLlmClient` echo 응답 계약(`[stub] received: <msg>`, no tool call, 재-park 보장) 및 `embed`(zero 벡터)·`listModels`(stub-model 1건) 동작 추가. 구현 파일 링크(`stub.client.ts`) 포함. project-planner 위임.
4. **[WARNING-2 · security]** `docker-compose.e2e.yml` ENCRYPTION_KEY를 랜덤 값 또는 CI 시크릿 인젝션으로 교체 (정적 순차 패턴 제거).
5. **[INFO · testing]** `docker-compose.e2e.yml`에 `INTERACTION_JWT_SECRET` 명시 설정 및 `mintInteractionToken`과 동기화해 secret 경로를 명시적으로 고정.
6. **[INFO · testing]** `end_conversation` 응답 body `accepted: true` 검증 추가(`expect(res.body.data?.accepted).toBe(true)`).
7. **[INFO · plan]** 모든 plan 항목 완료 후 `plan/in-progress/exec-park-b2a-followup.md`를 `plan/complete/`로 이동.
8. **[INFO · maintainability]** (후속 PR) `createWorkflow`/`saveCanvas`/`poll` 헬퍼를 `test/helpers/`로 추출해 두 describe 블록이 공유하도록 리팩터링.

## 라우터 결정

라우터 미사용 — 전체 reviewer 강제 포함(router_safety).

- **실행(forced)**: `dependency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)
- **제외**: 없음
- **강제 포함(router_safety)**: 위 8개 전체