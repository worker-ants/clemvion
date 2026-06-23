# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 기능 계약·API 계약·RBAC·데이터 모델 어느 측면에서도 spec 위반 없음. `spec/5-system/15-chat-channel.md` frontmatter `code:` 및 §7 파일 구조 트리의 경로 동기화 누락이 WARNING 2건 존재하나, 빌드/테스트 차단 수준은 아니다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/5-system/15-chat-channel.md` frontmatter `code:` 에 이동된 `chat-channel-token-rotator.service.ts` 경로 누락 — `spec/conventions/spec-impl-evidence.md §2.1` 위반 | `spec/5-system/15-chat-channel.md` frontmatter lines 4–17 | `spec/conventions/spec-impl-evidence.md §2.1` (code: 는 본 spec 이 약속한 surface 의 구현 경로를 열거) | frontmatter `code:` 에 `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 추가 |
| 2 | Convention Compliance | `spec/5-system/15-chat-channel.md` §7 구현 파일 구조 목록에서 `triggers.controller.ts` 및 이동된 `chat-channel-token-rotator.service.ts` 미반영 — 단일 진실 원칙 훼손 | `spec/5-system/15-chat-channel.md` §7 lines 449–480 | CLAUDE.md 정보 저장 위치 단일 진실 원칙, `spec/conventions/spec-impl-evidence.md §2.1` | §7 `triggers/` 블록에 `triggers.controller.ts` (C-2: rotateBotToken 이전) 와 `chat-channel-token-rotator.service.ts` (C-2: chat-channel 에서 이전) 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/15-chat-channel.md` frontmatter `code:` 에 rotator 서비스 파일 2종 누락 (WARNING #1 과 중복 — WARNING 으로 통합) | `spec/5-system/15-chat-channel.md` frontmatter | WARNING #1 참고 |
| 2 | Cross-Spec | §7 파일 구조 미갱신 (기존 갭이 구조 변경으로 더 두드러짐) | `spec/5-system/15-chat-channel.md` §7 | WARNING #2 참고 (data-flow spec 에는 이미 최신 경로 반영됨) |
| 3 | Rationale Continuity | `spec/5-system/15-chat-channel.md §7` `triggers/` 항목에 C-2 이후 추가된 `triggers.controller.ts` 와 `chat-channel-token-rotator.service.ts` 미반영 | `spec/5-system/15-chat-channel.md` §7 lines 449–475 | WARNING #2 참고 — data-flow spec 이미 반영, 가독성 개선 수준 |
| 4 | Convention Compliance | `triggers.controller.ts` `rotateBotToken` 핸들러에 Swagger 응답 데코레이터(`@ApiOkWrappedResponse`, `@ApiBadRequestResponse` 등) 누락 — `spec/conventions/swagger.md §5-4` 미달 | `codebase/backend/src/modules/triggers/triggers.controller.ts` (rotateBotToken 핸들러) | `spec/conventions/swagger.md §5-4` 새 엔드포인트 체크리스트 | `rotateBotToken` 에 `@ApiParam({ name: 'id', format: 'uuid' })`, `@ApiOkWrappedResponse(RotateBotTokenResponseDto)`, `@ApiBadRequestResponse`, `@ApiNotFoundResponse` 추가; `RotateBotTokenResponseDto` 를 `triggers/dto/responses/rotate-bot-token-response.dto.ts` 에 신설 (spec 변경 불필요 — 구현 fix 사안) |
| 5 | Plan Coherence | C-2 클러스터5 완료 — plan 기술과 구현 완전 일치, 조치 불요 | `plan/in-progress/refactor/02-architecture.md` §C-2 항목5 | 없음 |
| 6 | Plan Coherence | C-2 클러스터4(llm↔model-config)는 본 diff 와 직교하며 별건으로 올바르게 분리됨 | `plan/in-progress/refactor/02-architecture.md` §C-2 클러스터4 | 없음 |
| 7 | Naming Collision | `spec/5-system/14-external-interaction-api.md` 의 `triggers.controller.ts` 설명 목록에 `POST :id/chat-channel/rotate-bot-token` 누락 — 충돌 아닌 나열 미완성 | `spec/5-system/14-external-interaction-api.md` line 785 | SoT 는 15-chat-channel.md 이므로 차단 불필요. 이후 spec 갱신 시 `POST :id/chat-channel/rotate-bot-token (CCH-SE-04)` 추가 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | frontmatter `code:` 및 §7 파일 구조 트리에서 rotator 서비스 신규 경로 2종 누락. 기능 계약·API·RBAC·데이터 모델은 모두 일치 |
| Rationale Continuity | NONE | spec Rationale 에 C-2 를 금지하는 결정 없음. `forwardRef` 관련 4-execution-engine.md 언급은 구조적 필수 순환에 한정된 맥락. data-flow spec 은 이미 C-2 이후 상태 반영 완료 |
| Convention Compliance | LOW | frontmatter `code:` 경로 누락(spec-impl-evidence §2.1) + §7 목록 미갱신 각 WARNING 1건. Swagger 응답 데코레이터 누락 INFO 1건(구현 fix 사안, spec 위반 아님) |
| Plan Coherence | NONE | C-2 클러스터5 구현이 plan 기술과 완전 일치. 미해결 선행 조건 없음, 다른 in-progress plan 과 충돌 없음 |
| Naming Collision | NONE | 신규 식별자 없음. 이전된 식별자 모두 이미 갱신된 spec 에 반영됨. 14-external-interaction-api.md 나열 미완성은 충돌 아닌 보완 권장 |

## 권장 조치사항

1. **(WARNING 해소 — 우선)** `spec/5-system/15-chat-channel.md` frontmatter `code:` 에 두 줄 추가:
   ```
   - codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts
   - codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.spec.ts
   ```
2. **(WARNING 해소 — 우선)** `spec/5-system/15-chat-channel.md` §7 `triggers/` 블록 갱신:
   - `triggers.controller.ts` (C-2: rotateBotToken 엔드포인트 이전) 추가
   - `chat-channel-token-rotator.service.ts` (C-2: chat-channel 에서 이전, CCH-SE-04-C) 추가
3. **(INFO — 다음 spec-sync 또는 별도 PR)** `triggers.controller.ts` `rotateBotToken` 핸들러에 Swagger 응답 데코레이터 보완 (구현 fix, spec 변경 불필요)
4. **(INFO — 선택적)** `spec/5-system/14-external-interaction-api.md` line 785 의 `triggers.controller.ts` 설명에 `POST :id/chat-channel/rotate-bot-token (CCH-SE-04)` 추가

---

*검토 범위*: C-2 chat-channel↔triggers 순환 의존 해소 리팩토링 (diff origin/main...HEAD), spec `spec/5-system/15-chat-channel.md`, 2026-06-24