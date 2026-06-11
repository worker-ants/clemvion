# Code Review 통합 보고서

## 전체 위험도
**LOW** — embedding 연결 테스트의 kind-agnostic 조회 회귀 수정 + 차원 자동 감지 기능 추가. 기능 안전성 문제는 없으며, 아키텍처 개선 대상(forwardRef 순환·OCP)과 spec 갱신 누락([SPEC-DRIFT])이 중기 과제로 남는다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `LlmModule`↔`ModelConfigModule` 간 `forwardRef()` 순환 의존 — SRP 위반 신호. `LlmService`가 설정 조회·클라이언트 생성·kind별 probe 분기까지 담당 | `llm.module.ts`, `llm.service.ts` 생성자 | `testConnection(config: ModelConfig)` 처럼 이미 조회된 엔티티를 인자로 받도록 인터페이스 변경 → 순환 의존 제거. 설정 조회 책임은 컨트롤러/유스케이스 레이어로 이동 |
| 2 | Architecture | `testConnection` 내 `config.kind === 'embedding'` 분기 내재 — OCP 위반 가능성. `rerank` 등 kind 추가 시 동일 메서드에 else-if 누적 | `llm.service.ts` L1526–1534 | `LLMClient` 인터페이스에 `probeConnection(): Promise<{ dimension?: number }>` 추가, 각 클라이언트가 구현. kind 분기 3개 이상 시 리팩터링 기준 |
| 3 | Testing | `testConnection` 서비스 스펙에 `kind='rerank'` 경로 미검증 — embedding 분기를 타지 않고 `client.testConnection()`을 호출해야 하는데 케이스 없음 | `llm.service.spec.ts`, `testConnection` describe 블록 | `kind='rerank'` 설정 반환 시 `mockClient.testConnection`이 호출됨을 검증하는 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `LlmService.testConnection` 반환 타입에 `dimension` 필드 추가 — spec 침묵 영역의 의도적 기능 확장. 코드 유지, spec 갱신 필요 | `llm.service.ts` L1517, `model-config-response.dto.ts` L1817–1823 | `spec/2-navigation/6-config.md §B.3` 및 `spec/5-system/7-llm-client.md`에 `dimension?: number` 반환 및 embedding probe 동작 명세 반영 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` `LlmService.testConnection`이 `ModelConfigService.findEntity`(kind-agnostic)를 직접 사용 — 의존 방향이 spec에 미명시 | `llm.service.ts` L1522–1525, `llm.module.ts` | `spec/5-system/7-llm-client.md` 또는 `spec/2-navigation/6-config.md §3`에 설계 결정 반영 (`plan/in-progress/unified-model-management.md §7 W4` 백로그와 연동) |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` 프론트엔드: embedding 연결 테스트 시 차원 자동 감지 및 퍼시스트 + dimension 필드 read-only 전환 — spec에 없는 UX 개선 | `model-config-manager.tsx` L2941–2966, `model-config-form-dialog.tsx` L2650–2651 | `spec/2-navigation/6-config.md §B.3·§B.5`에 (a) probe 차원 자동 저장, (b) read-only 표시, (c) 저장 실패 시 성공 toast 유지 동작 반영 |
| 4 | Maintainability | `model-config-manager.test.tsx`에 동일 describe 블록(`embedding connection test dimension auto-detect`)이 두 번 존재 — 불필요한 중복 실행 발생 | `model-config-manager.test.tsx` L1860–1975 vs L2416–2531 | 중복 describe 블록 하나 제거 |
| 5 | Maintainability | 테스트 픽스처 객체 삼중 중복 — embedding config `{ id: 'emb-1', kind: 'embedding', ... }` 각 테스트 케이스에 인라인 반복 | `llm.service.spec.ts` L147–153, L172–178, L186–192 | `describe('testConnection')` 스코프에 `const EMBEDDING_CONFIG_FIXTURE = { ... }` 공유 상수 추출 |
| 6 | Maintainability | 매직 리터럴 `1536` — 의미 불명시 (text-embedding-3-small 기본 차원) | `llm.service.spec.ts` L154, `model-config-manager.test.tsx` 다수 | `const OPENAI_SMALL_EMBEDDING_DIM = 1536` 같은 named 상수 또는 인라인 주석으로 근거 명시 |
| 7 | Architecture | 프레젠테이션 레이어에서 도메인 사이드이펙트 실행 — `testMutation.onSuccess`에서 `modelConfigsApi.update` 직접 호출 | `model-config-manager.tsx` L954–959 | 백엔드 `testConnection`이 차원 persist까지 담당하거나, 커스텀 훅 `useTestConnection`으로 사이드이펙트 캡슐화 |
| 8 | Architecture | `LlmService.createClient`가 deprecated `LlmConfigService.getDecryptedApiKey`에 의존 — 복호화 책임 분리 불완전 | `llm.service.ts` L1357 | 복호화 로직을 `ModelConfigService` 또는 공통 `EncryptionService`로 이전 |
| 9 | Architecture | `LlmService.testConnection` 반환 타입 `{ success, error? }` vs `ModelTestConnectionResultDto { success, message? }` 필드명 불일치 — 암묵적 매핑 | `model-config-response.dto.ts` L1816–1821, `llm.service.ts` L1516 | 내부 인터페이스 `TestConnectionResult` 명명 + 컨트롤러에서 DTO로의 명시적 매핑 함수 도입 |
| 10 | Testing | 컨트롤러 레벨 `testConnection`/`listModels` 스펙 전무 — DTO-서비스 계약 단위 보증 없음 | `model-config.controller.spec.ts` | `controller.testConnection` → `{ success: true, dimension: 1536 }` 반환 검증 케이스 추가 |
| 11 | Testing | 프론트엔드: embedding이지만 서버가 `dimension` 없이 응답 시(`{ success: true }`) 토스트 동작 미검증 | `model-config-manager.test.tsx`, `embedding connection test` describe | `testConnectionMock.mockResolvedValue({ success: true })` 케이스로 `connectionSucceeded` 토스트 확인 |
| 12 | Testing | 프론트엔드: 퍼시스트 실패 시나리오에서 `updateMock` 호출 자체 단언 누락 | `model-config-manager.test.tsx` L1936–1956 | `expect(updateMock).toHaveBeenCalledWith("emb-1", { dimension: 3072 })` 단언 추가 |
| 13 | Testing | `testConnection` 기존 chat 케이스에서 `mockModelConfigService.findEntity` 호출 여부 미검증 — `llmConfigService.findEntity` 재호출 회귀 검출 불가 | `llm.service.spec.ts` L544 | `expect(mockModelConfigService.findEntity).toHaveBeenCalledWith('config-1', 'ws-1')` 단언 추가 |
| 14 | Documentation | `testConnection` 메서드에 JSDoc 없음 — `embed`, `hasDefaultLlmConfig` 등은 JSDoc 보유, 일관성 깨짐 | `llm.service.ts` `testConnection` 메서드 (~L1513) | `@returns` 에 `dimension` 필드가 embedding kind 시에만 반환됨 및 probe embed 방식 명시 |
| 15 | Documentation | `ModelTestConnectionResultDto.dimension` Swagger description 한국어 작성 — 영문 API 문서 일관성 저해 | `model-config-response.dto.ts` | `'Detected embedding dimension via probe embed when kind=embedding. Omitted if detection fails.'`로 변경 |
| 16 | Performance | `embed` 배치 처리 직렬 for 루프 — 대규모 임베딩 적재 시 latency 누적 (기존 코드, 이번 변경 직접 도입 아님) | `llm.service.ts` L1495–1509 | 대규모 적재 시 `Promise.all` + p-limit 동시성 제한 패턴 고려. 현재 testConnection 용 1건 호출에는 해당 없음 |
| 17 | API Contract | `PATCH /model-configs/:id`에 `{ dimension }` 단독 전송 — `UpdateModelConfigDto` 부분 업데이트 지원 여부 미확인 | `model-config-manager.tsx` `onSuccess` 핸들러 | `UpdateModelConfigDto`가 `dimension` 단독 PATCH 허용하는지 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | — | 출력 파일 미생성 (결과 불명) |
| performance | LOW | testConnection probe embed 네트워크 비용·배치 직렬화 — 모두 INFO, 기능 안전 |
| architecture | LOW | forwardRef 순환 의존(WARNING), OCP 위반 가능성(WARNING), 프레젠테이션 레이어 사이드이펙트(INFO) |
| requirement | LOW | 3건 SPEC-DRIFT(spec 갱신 필요), 프론트엔드 테스트 minor coverage gap |
| scope | NONE | 변경 5개 파일 모두 단일 목적에 직결, 불필요한 변경 없음 |
| side_effect | — | 출력 파일 미생성 (결과 불명) |
| maintainability | LOW | describe 블록 중복(실질적 중복 실행), 픽스처 삼중 중복, 매직 리터럴 |
| testing | LOW | rerank 경로 미검증(WARNING), 컨트롤러 스펙 부재, 일부 엣지 케이스 누락 |
| documentation | LOW | JSDoc 누락, Swagger description 한국어, spec 갱신 여부 불명확 |
| concurrency | NONE | 신규 변경은 공유 상태 미접촉. 기존 listModels duplicate-fetch 패턴만 약간 확장 |
| api_contract | NONE | additive 선택적 필드 추가, 하위 호환성 유지. 에러 코드·URL·인증 변경 없음 |

## 발견 없는 에이전트

- **scope**: 변경 파일 모두 목적에 직결된 최소 범위, 이슈 없음
- **concurrency**: 신규 위험 없음 (기존 duplicate-fetch는 이번 변경 전부터 존재)
- **api_contract**: 모든 변경 하위 호환, 이슈 없음
- **security**: 출력 파일 미생성 (결과 통합 불가)
- **side_effect**: 출력 파일 미생성 (결과 통합 불가)

## 권장 조치사항
1. **[WARNING #3 — Testing]** `kind='rerank'` testConnection 경로 테스트 추가 — `client.testConnection()` 호출 검증으로 embedding 분기 오염 회귀 방지
2. **[WARNING #1 — Architecture]** `LlmModule`↔`ModelConfigModule` forwardRef 순환 의존 — `plan/in-progress/unified-model-management.md §7 W4` 백로그 항목으로 중기 리팩터링 추적. 당장 런타임 위험 없음
3. **[INFO #4 — Maintainability]** `model-config-manager.test.tsx` 중복 describe 블록 제거 — 동일 테스트 이중 실행 해소
4. **[SPEC-DRIFT #1·#2·#3]** spec 3곳 갱신: `spec/2-navigation/6-config.md §B.3·§B.5`, `spec/5-system/7-llm-client.md` — dimension 반환·probe embed·kind-agnostic 설계 결정 반영 (`project-planner` 위임)
5. **[INFO #14 — Documentation]** `testConnection` JSDoc 추가 — dimension 반환 조건 명시
6. **[INFO #15 — Documentation]** Swagger description 영문화
7. **[INFO #5·#6 — Maintainability]** 픽스처 공유 상수 추출 + 매직 리터럴 named 상수화
8. **[INFO #10·#11·#12·#13 — Testing]** 컨트롤러 스펙 추가 및 엣지 케이스 보강 (medium priority)

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing_status=done`).

- **실행** (11명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract
- **강제 포함(router_safety)** (6명): maintainability, requirement, scope, security, side_effect, testing
- **제외** (3명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단으로 생략 |
  | database | 라우터 판단으로 생략 |
  | user_guide_sync | 라우터 판단으로 생략 |

> **비고**: `security.md`, `side_effect.md` 두 파일이 디스크에 존재하지 않아 해당 reviewer 결과를 통합하지 못했습니다. 두 reviewer 의 실제 출력은 확인 불가 상태이며, 위험도 판정은 나머지 9개 reviewer 결과 기준입니다.