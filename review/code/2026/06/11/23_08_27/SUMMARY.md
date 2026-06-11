# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 동작에 영향을 주는 Critical 이슈 없음. 유저 가이드 미갱신 및 아키텍처·요구사항 경계 관련 WARNING 4건 존재.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | USER_GUIDE_SYNC | 임베딩 차원 자동 감지 동작 변경(probe embed, dimension 자동 저장, read-only 잠금)이 유저 가이드에 미반영. Step 4 수동 입력 안내·Callout·FieldTable Dimension 행·API 레퍼런스가 실제 UX와 불일치 | `codebase/frontend/src/content/docs/06-integrations-and-config/models.en.mdx`, `models.mdx` | Step 4, Callout, FieldTable, API 레퍼런스를 자동 감지 동작 기준으로 en/ko 양 언어 갱신 |
| 2 | ARCHITECTURE | `LlmModule ↔ ModelConfigModule` 양방향 `forwardRef` 순환 의존이 이번 변경으로 강화됨. `LlmService`가 설정 조회·클라이언트 생성·kind별 probe 분기까지 담당해 책임 범위 과다 | `codebase/backend/src/modules/llm/llm.service.ts`, `llm.module.ts` | `testConnection(config: ModelConfig)` 형태로 외부 주입 전환, 설정 조회 책임을 컨트롤러/유스케이스로 이전 (plan W4 백로그 추적) |
| 3 | REQUIREMENT | rerank kind가 `LlmService.testConnection`에 도달할 경우 spec("rerank 연결 테스트 미제공")과 서비스 레이어 동작(chat과 동일 경로 통과) 간 암묵적 충돌. UI 가드 충분 여부 불명확 | `codebase/backend/src/modules/llm/llm.service.ts` L250–279, `spec/2-navigation/6-config.md` L276 | spec 의도 확인 후: (a) "UI 가드 충분"이면 spec 문구 명확화, (b) "API 레벨 차단 필요"이면 서비스/컨트롤러 가드 추가. project-planner 판단 위임 |
| 4 | SIDE_EFFECT | `testMutation.onSuccess`가 연결 테스트 외에 `PATCH /model-configs/:id`를 추가 발행하는 숨겨진 사이드이펙트. 사용자 인지 없이 서버 상태 2회 변경, TanStack Query가 async 핸들러 반환 Promise를 무시해 silent failure 위험 | `codebase/frontend/src/components/models/model-config-manager.tsx` `testMutation.onSuccess` | onSuccess에 "PATCH 추가 발생" 주석 명시 또는 `useTestConnection` 커스텀 훅으로 사이드이펙트 캡슐화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md §B.3` — embedding probe embed 분기·dimension 자동 감지 동작 미명시 (구현이 spec보다 앞서 있음) | `spec/2-navigation/6-config.md` L172–177 | 코드 유지 + spec 갱신 (`plan/in-progress/spec-update-embedding-testconnection.md §3` 반영) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md §B.5` — dimension 행이 "수동 입력" 전제, read-only 자동 전환 동작 미기술 | `spec/2-navigation/6-config.md` L202 | 코드 유지 + spec 갱신 (`plan/in-progress/spec-update-embedding-testconnection.md §4` 반영) |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/7-llm-client.md §8.3` — embedding probe 전략·kind-agnostic 조회·반환 타입 확장(`{ success, dimension? }`) 미기술 | `spec/5-system/7-llm-client.md` L374, L412 | 코드 유지 + spec 갱신 (`plan/in-progress/spec-update-embedding-testconnection.md §1·§2` 반영) |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md §3 API 표` — `POST /api/model-configs/:id/test` 응답 shape(`{ success, dimension? }`) 미기술 | `spec/2-navigation/6-config.md` L276 | 코드 유지 + spec 갱신 (`plan/in-progress/spec-update-embedding-testconnection.md §5` 반영) |
| 5 | ARCHITECTURE | `LlmService.testConnection` 내 `if (config.kind === 'embedding')` 분기 — rerank/multimodal 추가 시 OCP 위반 구조로 진행 가능 | `codebase/backend/src/modules/llm/llm.service.ts` L263–271 | kind 분기 3개 이상 시점에 `LLMClient.probeConnection()` 인터페이스 추가 및 분기 제거 기준점으로 삼음 |
| 6 | ARCHITECTURE | `ModelConfigFormDialog.dimensionAutoDetected`에서 `dimension: 0` 케이스가 "감지됨"으로 처리되는지 명시 없음 | `codebase/frontend/src/components/models/model-config-form-dialog.tsx` L373–374 | `editConfig?.dimension != null && editConfig.dimension > 0` 조건 명시 또는 인라인 주석 추가 |
| 7 | ARCHITECTURE | `LlmService` 반환 타입 `{ error? }` vs `ModelTestConnectionResultDto.message?` 필드명 불일치, 명시적 매핑 함수 없음 | `codebase/backend/src/modules/llm/llm.service.ts` L253, `model-config-response.dto.ts` | 내부 인터페이스 `TestConnectionResult` 명명 + 컨트롤러 명시적 매핑 함수 추가 |
| 8 | MAINTAINABILITY | `llm.service.spec.ts` 내 embedding 픽스처 객체가 3개 테스트 케이스에 동일하게 중복 | `codebase/backend/src/modules/llm/llm.service.spec.ts` | `const EMBEDDING_CONFIG_FIXTURE = {...}` 공유 상수 추출 |
| 9 | MAINTAINABILITY | 매직 리터럴 `1536`/`3072`가 백엔드·프론트엔드 테스트 양쪽에 산재, 모델명과 연결 근거 없음 | `llm.service.spec.ts`, `model-config-manager.test.tsx` | 로컬 상수(`OPENAI_SMALL_DIM = 1536`) 또는 인라인 주석으로 의미 명시 |
| 10 | MAINTAINABILITY | `ModelTestConnectionResultDto.dimension` Swagger description이 한국어로 작성돼 동일 DTO 내 영어 필드와 언어 혼재 | `model-config-response.dto.ts` L58–62 | 영문으로 통일: `'Detected embedding dimension via probe embed when kind=embedding. Omitted if detection fails.'` |
| 11 | TESTING | `listModels`의 kind-agnostic 변경(`'chat'` 인수 제거)에 대한 테스트 케이스 없음 | `codebase/backend/src/modules/llm/llm.service.ts` `listModels`, `llm.service.spec.ts` | `listModels` describe 블록에 `findEntity`가 kind 인수 없이 호출됨을 검증하는 케이스 추가 |
| 12 | TESTING | 백엔드 컨트롤러 레이어에서 `dimension` 필드 직렬화 검증 부재 | `model-config-response.dto.ts`, 컨트롤러 spec/e2e | embedding testConnection 응답 body에 `dimension` 포함을 컨트롤러 또는 e2e 테스트로 검증 |
| 13 | TESTING | `invalidate()` 호출 사이드이펙트 미검증 — dimension 저장 후 query 갱신 로직 누락 시 발견 불가 | `model-config-manager.test.tsx` | `queryClient.invalidateQueries` spy 또는 `waitFor`로 refetch 트리거 검증 |
| 14 | TESTING | chat kind 경로에서 `dimension` 필드가 반환되지 않음을 명시적으로 assert하는 케이스 없음 | `llm.service.spec.ts` `describe('testConnection')` | 기존 chat 성공 케이스에 `expect(result).toEqual({ success: true })` assert 추가 |
| 15 | TESTING | `dimensionAutoDetected=false`(dimension이 null인 편집 모드)에서 필드가 writable임을 검증하는 반대 케이스 없음 | `model-config-manager.test.tsx` | `dimension: null` 설정 편집 시 readOnly 아님을 assert하는 케이스 추가 |
| 16 | DOCUMENTATION | `testConnection` 메서드에 JSDoc 없음 — `dimension`이 embedding 전용이고 벡터 길이 0 시 omit된다는 조건이 시그니처에서 불투명 | `codebase/backend/src/modules/llm/llm.service.ts` L250–279 | `@returns` JSDoc 추가: `dimension은 kind=embedding일 때만 포함, probe 결과 벡터 길이 0이면 omit` |
| 17 | DOCUMENTATION | `llm.module.ts` forwardRef 주석에 양방향 의존 출처 미명시 | `codebase/backend/src/modules/llm/llm.module.ts` | `LlmService → ModelConfigService (testConnection/listModels)` 및 역방향 경로 주석에 명시 |
| 18 | SECURITY | `findEntity`가 workspaceId를 WHERE 조건에 강제 포함하는지 기존 구현 확인 권장(이번 diff 범위 외) | `codebase/backend/src/modules/llm/llm.service.ts` | 기존 구현 점검; 이번 변경 자체는 추가 취약점 미도입 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. 테스트 픽스처 가짜 키, probe 입력 하드코딩, 에러 새니타이징 모두 정상 |
| architecture | LOW | LlmModule ↔ ModelConfigModule forwardRef 순환 의존 강화, kind 분기 OCP 위반 잠재성 |
| requirement | LOW | SPEC-DRIFT 4건(spec 갱신 필요), rerank testConnection 도달 시 spec 충돌 WARNING 1건 |
| scope | NONE | 핵심 버그픽스 집중, 추가 기능(dimension 자동저장·read-only UI)은 PR 의도 내 |
| side_effect | LOW | onSuccess PATCH 숨겨진 사이드이펙트, mutationFn 인자 타입 변경, findEntity kind 제거 |
| maintainability | LOW | 픽스처 3중 중복, 매직 리터럴 1536/3072, async onSuccess 오류 소멸 위험, Swagger 언어 혼재 |
| testing | LOW | listModels 변경 테스트 없음, DTO 직렬화 미검증, invalidate 사이드이펙트 미검증 |
| documentation | LOW | testConnection JSDoc 없음, Swagger description 한국어, forwardRef 주석 미흡 |
| user_guide_sync | WARNING | 유저 가이드 수동 입력 안내·Callout·FieldTable·API 레퍼런스가 자동 감지 동작과 불일치 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항 보고)

---

## 권장 조치사항

1. **(WARNING — 즉시)** 유저 가이드 갱신: `models.en.mdx`·`models.mdx`의 Step 4, Callout, FieldTable Dimension 행, API 레퍼런스를 probe embed 자동 감지·저장·read-only 잠금 동작 기준으로 en/ko 양 언어 갱신.
2. **(WARNING — 즉시)** rerank testConnection spec 의도 명확화: `spec/2-navigation/6-config.md §B.6.2·§3`의 "rerank 미제공" 문구가 UI 가드만을 의미하는지 API 레벨 차단도 의미하는지 project-planner 판단 후 코드 또는 spec 갱신.
3. **(WARNING — 즉시)** `testMutation.onSuccess`에 "이 핸들러는 PATCH 추가 발행" 주석 명시, 또는 `useTestConnection` 커스텀 훅으로 사이드이펙트 캡슐화.
4. **(SPEC-DRIFT — 별도 turn)** `plan/in-progress/spec-update-embedding-testconnection.md` draft를 바탕으로 project-planner가 `spec/5-system/7-llm-client.md §8.3`, `spec/2-navigation/6-config.md §B.3·§B.5·§3 API 표` 4건 갱신.
5. **(INFO — 단기)** `llm.service.spec.ts` embedding 픽스처 상수 추출, 매직 리터럴 `1536`/`3072` 명명 상수 또는 주석 처리.
6. **(INFO — 단기)** `ModelTestConnectionResultDto.dimension` Swagger description 영문으로 통일.
7. **(INFO — 단기)** `listModels` kind-agnostic 변경 테스트 케이스 추가, chat 경로 `dimension` 미포함 assertion 추가.
8. **(INFO — 중기)** `LlmService.testConnection(config: ModelConfig)` 시그니처 전환으로 `LlmModule ↔ ModelConfigModule` forwardRef 순환 의존 해소 (plan W4 백로그).
9. **(INFO — 중기)** kind 분기 3개 이상 시점에 `LLMClient.probeConnection()` 인터페이스 추가 및 서비스 레이어 분기 제거.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 제외 결정 |
| dependency | 라우터 제외 결정 |
| database | 라우터 제외 결정 |
| concurrency | 라우터 제외 결정 |
| api_contract | 라우터 제외 결정 |