# Code Review 통합 보고서

## 전체 위험도

**LOW** — 전체 변경이 doc-string 정정·예제 코드 패턴 교체 중심이며, 런타임 동작 변경은 `@IsNumber()` → `@IsInt()` 교체(spec 정합 방향) 1건에 한정됨. Critical 발견사항 없음.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | SIDE_EFFECT | `@IsNumber()` → `@IsInt()` validator 변경 — float topK 요청에 대해 기존 통과하던 요청이 400 Bad Request 로 거절되는 런타임 동작 변화 | `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` L91–92 | spec §2.1 `integer` 정합 변경으로 정당하나, 기존 클라이언트(channel-web-chat 포함)가 float topK 값을 전송하는 경로가 없는지 확인 권장. RESOLUTION에서 "spec 준수 방향 수용" 처리됨. |
| W-2 | DOCUMENTATION | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-16/V-17 항목의 `(본 PR)` 자기참조 — `(PR #530)` 방식과 불일치하여 히스토리 추적 혼란 가능 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-16/V-17 항목 | 머지 후 확정된 PR 번호로 `(본 PR)` 갱신 (관행 일치). 차단 불요. |
| W-3 | DOCUMENTATION | `startHeadlessChat` JSDoc 에 `@param profile`, `@param handlers` 태그 없음 — 파라미터 순서 변경 후 IDE 자동완성 맥락에서 혼동 가능 | `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` JSDoc 블록 | `@param profile` 과 `@param handlers` JSDoc `@param` 태그 추가. 예제 파일이므로 차단 불요. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | SPEC-DRIFT | [SPEC-DRIFT] `cross_encoder_llm` DTO description 이 spec §3.3.1 conditional escalate 동작과 정합(코드가 최신, spec 보강 필요) | `create-knowledge-base.dto.ts` L36–37, `update-knowledge-base.dto.ts` L217–218 | spec/5-system/9-rag-search.md §3.3, spec/2-navigation/5-knowledge-base.md §2.2 에 rerankLlmConfigId 필드명·동작 설명 추가 (project-planner 위임). 코드 유지. |
| I-2 | SPEC-DRIFT | [SPEC-DRIFT] `firstMessage` → `profile` 교체 — spec/7-channel-web-chat/2-sdk.md §2 BYO-UI 섹션에 webhook profile-only → submit_message 흐름·firstMessage 폐기 근거 미기재 | `codebase/packages/web-chat-sdk/README.md` M2 BYO-UI 섹션, `byo-ui-headless.ts` | spec/7-channel-web-chat/2-sdk.md §2 에 흐름 보강 (project-planner 위임). 코드 유지. |
| I-3 | SPEC-DRIFT | [SPEC-DRIFT] `topK` `@IsInt()` 교체 — spec §2.1 `"type":"integer"` 정합 수정(기존 버그 수정) | `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` L93 | 코드 유지. 요구사항 충족. |
| I-4 | TESTING | `topK` `@IsInt()` 교체에 대한 DTO 단위 테스트 없음 — float 거부 동작이 테스트로 증명되지 않음 | `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` | `validate(plainToInstance(RagSearchDto, { ..., topK: 2.5 }))` 형태의 DTO 단위 테스트 추가 (백로그 등록 권장). float 거부·정수 허용·경계 케이스 커버. |
| I-5 | TESTING | `startHeadlessChat` 시그니처 변경(`profile` 분기 로직 `profile ? { profile } : {}`)에 대한 전용 테스트 없음 | `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` | `examples/byo-ui-headless.spec.ts` 생성(백로그): (1) profile 미전달 시 `triggerWebhook(path, {})` 호출 확인, (2) profile 전달 시 `{ profile }` 래핑 확인, (3) 토큰 미발급 시 throw 확인. |
| I-6 | TESTING | `create-knowledge-base.dto.ts` / `update-knowledge-base.dto.ts` rerank 필드 DTO validator 테스트 커버리지 갭 — 본 PR 이전부터의 구조적 갭 | `codebase/backend/src/modules/knowledge-base/dto/` | 백로그 등록 권장. `rerankMode` invalid value 거부·`rerankLlmConfigId` UUID 형식 검증 우선. |
| I-7 | MAINTAINABILITY | JSDoc `/** cross_encoder_llm grading LLMConfig */` 와 `@ApiPropertyOptional({ description: '...' })` 이원화 — CLI 플러그인 `introspectComments:true` 환경에서 충돌 가능 | `create-knowledge-base.dto.ts` rerankLlmConfigId 필드 | JSDoc 을 단일 진실(SoT)로 유지하거나 인라인 description 이 override 함을 확인 후 JSDoc 제거. 기능 버그 아님. |
| I-8 | SCOPE | plan 파일 V-06/V-08 항목 갱신에 타 브랜치 소관(`makeshop-catalog-labels` / PR #530) 편집 포함 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 기능적 문제 없음. 향후 타 브랜치 소관 항목 함께 수정 시 commit message 에 명시하면 추적성 향상. |
| I-9 | API_CONTRACT | `topK` `default: 5` OpenAPI hint 제거 — codegen 기반 클라이언트가 있다면 재생성 필요 | `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` diff L90 | codegen 사용 여부 확인. 런타임 동작 무관. |
| I-10 | DOCUMENTATION | CHANGELOG 갱신 없음 — `startHeadlessChat` 시그니처 변경(firstMessage 제거, profile? 추가, 파라미터 순서 변경)이 패키지 변경 이력에 미기재 | `codebase/packages/web-chat-sdk/` 패키지 루트 | `examples/byo-ui-headless.ts` 변경 사유(firstMessage 폐기, spec §R6)를 CHANGELOG 또는 README 변경 이력 섹션에 한 줄 기재 권장. |
| I-11 | SECURITY | `profile?: Record<string, unknown>` 도입 — 비구조적 unknown 딕셔너리가 서버로 전달되나, 예제 코드이며 기존 `firstMessage: string` 대비 새로운 위험면 없음 | `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` | 서버 측 webhook 핸들러의 `profile` 필드 허용 키 화이트리스트·크기 제한·스키마 검증 적용 여부 별도 확인 권장 (본 diff 범위 밖). |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. `@IsInt()` 교체는 오히려 입력 검증 강화. `profile?: Record<string, unknown>` 도입은 서버 사이드 검증 의존이나 새로운 위험면 없음. |
| requirement | LOW | 모든 변경이 spec 본문과 정합. spec/7-channel-web-chat/2-sdk.md §2 및 spec/5-system/9-rag-search.md §3.3 보강 누락은 SPEC-DRIFT 방향(코드가 맞고 spec이 낡음). |
| scope | LOW | 주 목적(V-16/V-17 doc-string 정정) 충실. `@IsInt()` 교체·JSDoc 5개 추가·plan 파일 타 브랜치 항목 갱신은 경미한 범위 확장이나 모두 정당. |
| side_effect | LOW | `@IsInt()` 교체(W-1)가 유일한 실질 런타임 동작 변화. `startHeadlessChat` 파라미터 순서 변경은 examples 범위 밖, 직접 호출자 0. |
| maintainability | NONE | 이전 세션(08_30_07) RESOLUTION에서 식별된 수정 항목 모두 해소됨. 잔존 관찰사항 전부 INFO 수준. |
| testing | LOW | DTO 단위 테스트·examples 전용 테스트 부재는 본 PR 이전부터의 구조적 갭. 기존 서비스 레이어 테스트의 회귀 위험 낮음. |
| documentation | LOW | `(본 PR)` 자기참조(W-2)·JSDoc @param 태그 누락(W-3)·SPEC-DRIFT 2건. 런타임 로직 변경 없어 문서화 위험도 낮음. |
| api_contract | LOW | Breaking change 없음. `@IsInt()` 교체·`default: 5` 제거·`startHeadlessChat` 시그니처 변경 모두 수용됨. codegen 재생성 확인 권장(I-9). |

---

## 발견 없는 에이전트

없음 (모든 에이전트에서 발견사항 있음. NONE 위험도 에이전트: security, maintainability).

---

## 권장 조치사항

1. **(W-1 확인)** 기존 클라이언트(channel-web-chat 및 기타)가 float topK 값을 전송하는 경로가 없는지 코드베이스 검색 후 확인. 이상 없으면 머지 가능.
2. **(W-2 즉시)** PR 머지 후 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-16/V-17 항목의 `(본 PR)` → `(PR #NNN)` 갱신.
3. **(W-3 선택)** `startHeadlessChat` JSDoc 에 `@param profile` 및 `@param handlers` 태그 추가 — 예제 파일이므로 이번 PR 또는 후속 PR 처리 모두 무방.
4. **(I-1, I-2 SPEC-DRIFT 백로그)** project-planner 위임: spec/5-system/9-rag-search.md §3.3 에 rerankLlmConfigId 동작 보강, spec/7-channel-web-chat/2-sdk.md §2 에 BYO-UI webhook profile-only → submit_message 흐름 및 firstMessage 폐기 근거 추가.
5. **(I-4, I-5, I-6 테스트 백로그)** `RagSearchDto` topK `@IsInt()` 단위 테스트, `examples/byo-ui-headless.spec.ts` profile 분기 테스트, rerank 필드 DTO validator 테스트 — 본 PR 이전부터의 구조적 갭. 별도 작업 등록 권장.
6. **(I-9 확인)** codegen 기반 클라이언트 사용 여부 확인. 사용 중이면 재생성 처리.

---

## 라우터 결정

라우터가 선별 실행됨 (`routing=done`).

- **실행** (8명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`
- **강제 포함 (router_safety)** (8명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전체 실행 목록과 동일하게 모두 강제 포함됨.
- **제외** (6명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | doc-string·예제 코드 변경 위주, 성능 관련 로직 변경 없음 |
| architecture | 구조적 설계 변경 없음, 기존 패턴 유지 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | DB 스키마·쿼리·마이그레이션 변경 없음 |
| concurrency | 비동기·동시성 로직 변경 없음 |
| user_guide_sync | 사용자 가이드 동기화 대상 없음 (examples/README 변경은 코드 리뷰 범위 내 처리) |