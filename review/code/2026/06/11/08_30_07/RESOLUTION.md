# RESOLUTION — V-16/V-17 doc-string ai-review (session 08_30_07)

risk LOW (Critical 0 + Warning 4 + INFO 10). 전 변경이 문서 문자열·예제 정정이라 런타임 영향 없음. 정당하고 본 변경 관련인 항목은 코드 수정, 나머지는 수용/백로그. 병행 `/consistency-check --impl-done`(08_30_57) = **BLOCK: NO**.

## 조치 항목

| # | 카테고리 | 판정 | 근거·조치 |
|---|----------|------|-----------|
| Warning #2 | Requirement | **수정 완료** | `rag-search.dto.ts` `topK` `@IsNumber()` → `@IsInt()` (spec §2.1 `"type":"integer"`). `IsInt` import 추가. 청크 개수는 정수라 정당 — 본 PR 이 해당 필드 description 을 건드려 검토 대상. |
| Warning #3 | Maintainability | **수정 완료** | `UpdateKnowledgeBaseDto` rerank 5필드(rerankMode/ConfigId/CandidateK/ScoreThreshold/LlmConfigId)에 `/** 변경할 … */` JSDoc 추가 — Create DTO 와 균형. |
| INFO #5 (≈I-3/I-5) | Maintainability | **수정 완료** | `rag-search.dto.ts` topK description 의 internal spec 절 번호 `(§3.4)` 제거 — 공개 Swagger 에 무의미. |
| INFO #6 | Maintainability | **수정 완료** | `update-knowledge-base.dto.ts` rerankLlmConfigId description `ws` → `워크스페이스` 통일(Create DTO 와 일치). |
| Warning #1 | API 계약 / 부작용 | **수용 (예제·호출자 0)** | `startHeadlessChat` 시그니처 변경(firstMessage 제거, profile? 추가, 순서 변경)은 **예제 파일**(`examples/byo-ui-headless.ts`)이고 직접 호출자 0(README 문서 링크만). package.json `files`/`exports` 미정의·`main: dist/index.js` 라 published 표면은 dist 한정 — examples 는 패키지 빌드(tsconfig `src/**`)·배포 표면 밖. README 가 새 패턴을 보여주므로 마이그레이션 혼선 없음. profile 은 옵션이라 끝에 배치(자연스러운 순서). |
| Warning #4 | 문서화 | **머지 후 갱신 (관행)** | plan `(본 PR)` 자기참조 → 머지 시 PR 번호로 갱신. V-06/V-08 항목도 동일 관행(머지 후 #530 기재)이라 일관. |
| INFO #1/#2 | SPEC-DRIFT | **spec-coverage 백로그** | spec §3.3/§2.2 에 `rerankLlmConfigId` 필드 표기 추가(#1), `2-sdk.md §2` 에 BYO-UI webhook profile-only→submit_message 흐름 보강(#2). 코드는 정확 — spec 본문 보강은 spec-coverage 갱신 영역(project-planner). |
| INFO #4 | API 계약 | **코드 무관 (확인)** | triggerWebhook payload `{firstMessage}`→`{profile}` 의 서버 처리: webhook 은 generic trigger input 수신이고 `firstMessage` 는 예제가 임의로 넣던 키. multi_turn 이 webhook 입력을 첫 턴으로 소비 안 해 증발(spec §R6) — 서버 코드 변경 불요, spec 이 이미 설명. |
| INFO #8/#9 | 테스트/유지보수 | **백로그** | byo-ui-headless 단위 테스트(#8), onError 시 sub.close()(#9 — pre-existing 예제 코드) — 예제 품질 백로그. |
| INFO #3/#7 | API 계약/유지보수 | **수용** | topK `default:5` 제거의 codegen 영향(#3 — 런타임 무관, 서비스 레이어가 결정)·재추가 방지 주석(#7) — description 에 "고정 default 가 아니라 동적 컷이 결정" 명시로 충분. |

## consistency-check (08_30_57) 반영

- **BLOCK: NO** (Critical 0). W-1(`unified-model-mgmt-5af7ee` 가 create-knowledge-base.dto.ts 병렬 편집, 라인 범위 상이 L98 vs L151/193) → **PR 설명에 "rag-webchat-doc-strings 먼저 머지 후 unified-model-mgmt rebase" 명시**. I-3(webchat-eager-start backlog V-17 해소) · I-4(spec-code-cross-audit V-16/V-17 등재) → plan 갱신 완료.

## TEST 결과

- backend build : 통과 (knowledge-base 에러 0)
- backend lint  : 통과 (변경 DTO)
- (web-chat-sdk 예제: 패키지 빌드 tsconfig `src/**` 제외 · 호출처 0 · 타입 자명)

## 후속·백로그

- INFO #1/#2 SPEC-DRIFT(rerankLlmConfigId spec 표기·2-sdk BYO-UI 흐름 보강) — spec-coverage 갱신.
- INFO #8/#9 byo-ui-headless 단위 테스트·onError SSE close — 예제 품질 백로그.
- plan `(본 PR)` → PR 번호: 머지 후 갱신.
