# Code Review 통합 보고서

## 전체 위험도
**LOW** — 전 변경이 문서 문자열(doc-string) 정정 중심이며 런타임 로직 변경 없음. 공개 API 시그니처 1건 파라미터 변경이 가장 높은 위험이나 internal-only 패키지 + 현재 직접 호출자 없음 확인.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 부작용 | `startHeadlessChat` 함수 시그니처 파괴적 변경 — `firstMessage: string` 제거, `profile?: Record<string, unknown>` 추가, 파라미터 순서 변경(`(apiBase, endpointPath, firstMessage, handlers)` → `(apiBase, endpointPath, handlers, profile?)`). 현재 내부 직접 호출자 없음 + internal-only 패키지이나, README 에서 직접 참조하며 외부 개발자가 패턴 복사 가능. 기존 호출자가 있다면 컴파일 에러 없이 `handlers` 위치에 `firstMessage` 값이 silently 전달될 위험 | `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` | package.json exports 에 examples/ 포함 여부 확인. 포함 시 major version bump 또는 deprecation notice 필요. README 마이그레이션 가이드(before/after) 추가 권장 |
| 2 | 요구사항 / 타입 정합 | `topK` 필드에 `@IsNumber()` 사용 — spec `5-system/9-rag-search.md §2.1` 은 `"type": "integer"` 로 정의해 float도 허용하는 현 validator 와 불일치. 이번 변경 도입 문제 아닌 기존 잠재 버그이나, 이번 변경이 해당 필드 설명 수정하면서 검토 대상이 됨 | `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` L342-344 | `@IsNumber()` → `@IsInt()` 교체 검토 (`import { IsInt }` 추가). spec §2.1 integer 타입 요구사항과 일치시킴 |
| 3 | 유지보수성 | `UpdateKnowledgeBaseDto` rerank 관련 필드 5개(rerankMode, rerankConfigId, rerankCandidateK, rerankScoreThreshold, rerankLlmConfigId)에 JSDoc 블록 주석 누락. `CreateKnowledgeBaseDto` 는 동일 필드에 `/** ... */` JSDoc 존재 → IDE 자동완성 불균형 | `codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts` L526-568 | Create DTO 와 동일 패턴으로 최소 `/** 변경할 리랭킹 모드 */` 수준 JSDoc 추가 |
| 4 | 문서화 | plan 파일 `rag-webchat-doc-strings` 항목에 `(본 PR)` 자기참조 표현 사용. `makeshop-catalog-labels` 항목은 이미 `(PR #530)` 으로 명시돼 일관성 미흡 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L856 | PR 머지 후 `(PR #NNN)` 으로 갱신 또는 머지 전 번호 미리 기재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `rerankLlmConfigId` JSDoc 갱신됐으나 spec 미갱신 — `spec/5-system/9-rag-search.md §3.3` 및 `spec/2-navigation/5-knowledge-base.md §2.2` 에 `rerankLlmConfigId` API 필드명·설명 직접 표기 없음. 두 DTO 간 JSDoc 일관성 문제(update DTO JSDoc 없음)도 잔존 | `create-knowledge-base.dto.ts` L254 | 코드 유지. spec §3.3 또는 §2.2 에 `rerankLlmConfigId` 필드명·설명 추가 권장 (spec-coverage 갱신) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] README BYO-UI 섹션 설명이 spec `7-channel-web-chat/2-sdk.md §2` 보다 더 상세하고 정확함 — `firstMessage` 폐기 이유, `submit_message` 우선 원칙, 토큰 갱신 패턴이 README 에만 있고 spec 에 없음 | `codebase/packages/web-chat-sdk/README.md` L666-691 | 코드 유지. `spec/7-channel-web-chat/2-sdk.md §2` 에 BYO-UI 예제 흐름(webhook profile-only → submit_message 첫 텍스트, firstMessage 폐기 이유) 설명 보강 권장 |
| 3 | API 계약 | `rag-search.dto.ts` `default: 5` OpenAPI hint 제거 — codegen 기반 클라이언트가 있다면 재생성 필요. 런타임 동작은 서비스 레이어(`options?.topK ?? RAG_MAX_INJECT_COUNT`)에서 처리하므로 런타임 영향 없음 | `rag-search.dto.ts` | codegen 사용처 있다면 재생성 확인 |
| 4 | API 계약 | `triggerWebhook` payload `{ firstMessage }` → `{ profile }` 변경 — 서버 측 webhook 핸들러에서 `firstMessage` 가 완전 제거/무시되는지 확인 필요(이번 diff 범위 밖) | `byo-ui-headless.ts`, `README.md` | 백엔드 webhook 핸들러 `firstMessage` 처리 상태 확인 |
| 5 | 유지보수성 | Swagger description 에 내부 spec 절 번호 `(§3.4)` 노출 — 공개 Swagger 문서에 의미 없는 기호. 같은 파일 내 다른 필드 description 에는 spec 참조 없음 | `rag-search.dto.ts` L334-336 | `(§3.4)` 제거 또는 `(동적 점수 컷 적용)` 등 자체 설명 텍스트로 대체 |
| 6 | 유지보수성 | `워크스페이스` vs `ws` 약어 혼용 — Create DTO: `'미지정 시 워크스페이스 default chat.'`, Update DTO: `'미지정 시 ws default chat.'` | `create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts` | `ws` → `워크스페이스` 로 Update DTO 도 통일 |
| 7 | 유지보수성 | `default: 5` Swagger 제거에 대한 주석 없음 — 향후 유지보수자가 실수로 재추가할 수 있음 | `rag-search.dto.ts` | JSDoc 또는 `@ApiPropertyOptional` description 에 "Swagger default 없음 — 동적 결정" 한 줄 추가 |
| 8 | 테스팅 | `startHeadlessChat` 함수 시그니처 변경에 대한 전용 유닛 테스트 없음(`byo-ui-headless.spec.ts` 미존재). profile 없는 호출·있는 호출 두 케이스 미커버 | `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` | `triggerWebhook` mock + `startHeadlessChat` 단위 테스트 2케이스 추가 권장: (1) profile 없이 빈 payload, (2) profile 있을 때 `{ profile }` 전달 |
| 9 | 유지보수성 | `byo-ui-headless.ts` `onError` 핸들러에서 `sub.close()` 미호출 — 에러 후 SSE 연결 계속 열릴 수 있음. 이번 변경 도입 아닌 기존 코드 | `examples/byo-ui-headless.ts` L820 | `onError: (err) => { handlers.onError?.(err); sub.close(); }` 패턴 추가 권장 |
| 10 | 범위 | plan 파일 V-06/V-08 항목의 "본 PR" → "PR #530" 갱신이 이 브랜치의 직접 범위 밖이나, plan 일관성 유지 목적이므로 해악 없음 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 차단 없음. 이상적으로는 `makeshop-catalog-labels` 브랜치에서 처리 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (출력 파일 미존재) | 재시도 필요 |
| requirement | LOW | topK @IsNumber vs spec integer 타입 불일치(WARNING), startHeadlessChat 시그니처 breaking change(WARNING) |
| scope | LOW | plan 파일 V-06/V-08 갱신이 직접 범위 밖 소규모 일탈(INFO). 전반적으로 V-16/V-17 정정에 집중 |
| side_effect | LOW | startHeadlessChat 파라미터 순서 변경(WARNING). DTO 변경은 모두 문서 메타데이터 수준, 런타임 부작용 없음 |
| maintainability | LOW | UpdateKnowledgeBaseDto rerank JSDoc 5개 누락(WARNING), ws/워크스페이스 혼용·§3.4 internal 참조 노출 등 다수 INFO |
| testing | LOW | byo-ui-headless.ts 전용 테스트 없음(INFO). 기존 spec으로 rerank/rag-search/channel-web-chat 커버 충분 |
| documentation | LOW | plan 파일 "(본 PR)" 자기참조 갱신 필요(WARNING). 변경 문서 품질 전반적으로 개선됨 |
| api_contract | LOW | startHeadlessChat breaking change(WARNING), topK default 제거 codegen 영향(INFO), triggerWebhook payload 키 변경 서버 동기화 확인 필요(INFO) |

## 발견 없는 에이전트

security — 출력 파일 미존재(재시도 필요 1건).

## 권장 조치사항

1. **[W-1] `topK` `@IsNumber()` → `@IsInt()` 교체** — spec §2.1 integer 타입 요구사항과 일치. `rag-search.dto.ts` L342-344, `import { IsInt }` 추가 필요.
2. **[W-2] `startHeadlessChat` breaking change 문서화** — package.json exports 에 examples/ 포함 여부 확인 후, 포함 시 CHANGELOG + major bump, 포함 안 됨 시 README migration guide(before/after) 추가.
3. **[W-3] `UpdateKnowledgeBaseDto` rerank 필드 JSDoc 추가** — rerankMode 외 5개 필드에 `/** 변경할 ... */` 최소 JSDoc 블록 추가하여 Create DTO 와 균형 맞춤.
4. **[W-4] plan 파일 `(본 PR)` → `(PR #NNN)` 갱신** — PR 번호 확정 후 즉시 갱신.
5. **[I-1] SPEC-DRIFT: spec/5-system/9-rag-search.md §3.3 + spec/2-navigation/5-knowledge-base.md §2.2 에 `rerankLlmConfigId` 필드 설명 추가** (spec-coverage 갱신).
6. **[I-2] SPEC-DRIFT: spec/7-channel-web-chat/2-sdk.md §2 BYO-UI 섹션에 webhook profile-only → submit_message 흐름, firstMessage 폐기 이유 설명 보강**.
7. **[I-3] Swagger description 에서 `(§3.4)` 제거** — 공개 API 문서에 internal spec 절 번호 노출 제거.
8. **[I-4] `ws` → `워크스페이스` 통일** — `update-knowledge-base.dto.ts` L563.
9. **[I-5] `byo-ui-headless.ts` 단위 테스트 추가** — profile 없는 호출 + profile 있는 호출 2케이스.
10. **[I-6] security reviewer 재실행** — 출력 파일 미존재로 보안 검토 결과 없음.

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`):

- **실행 (8명)**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract
- **강제 포함(router_safety) (7명)**: documentation, maintainability, requirement, scope, security, side_effect, testing
- **제외 (6명)**:

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 변경이 문서 문자열 정정 중심으로 런타임 성능 영향 없음으로 판단 |
| architecture | 구조적 설계 변경 없음 |
| dependency | 의존성 추가/변경 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
| user_guide_sync | 라우터 제외 결정 |