# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 및 방법

- **scope**: `spec/5-system/` — 이번 브랜치의 spec 델타는 **0개 파일**(`git diff origin/main...HEAD --stat -- spec/5-system/ spec/conventions/` 실측, 무변경). 즉 본 검토는 신규 spec 위반이 아니라, **이번 구현 diff(31파일/2279줄, 응답-DTO 필드 선언·§5.4 스윕)가 기존 `spec/5-system/1-auth.md`·`spec/5-system/2-api-convention.md` 및 `spec/conventions/**`(swagger.md·error-codes.md·audit-actions.md)와 정합적으로 맞물리는가**를 표준(standing) 감사로 확인했다.
- 프롬프트 자체는 컨텍스트 예산으로 `spec/5-system/` 17개 중 2개(`1-auth.md`·`2-api-convention.md`) 본문만, `spec/conventions/**` 는 목록만(본문 0) 실려 있었다. 판정에 필요한 실제 규약 본문은 워킹트리에서 직접 `Read`했다: `spec/conventions/swagger.md`(598줄 전체) · `spec/conventions/error-codes.md`(관련 절) · `spec/conventions/audit-actions.md`(전체 96줄). 코드 diff는 `git diff origin/main...HEAD -- <path>` 로 절대 워크트리에서 직접 대조했다.

## 발견사항

이번 diff·현행 spec/5-system 본문 모두에서 **CRITICAL·WARNING 급 정식 규약 위반은 발견하지 못했다.** 아래는 확인 근거와 INFO 두 건이다.

- **[INFO] "*RefDto" 명명 패턴이 신규 도입됐지만 `swagger.md`에 성문화되지 않음**
  - target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` (`TriggerWorkflowRefDto`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (`ScheduleTriggerRefDto`, `ScheduleTriggerWorkflowRefDto`)
  - 관련 규약: `spec/conventions/swagger.md` §1-4 (nested/enum/union) — nested object 표기(`@ApiProperty({ type: () => NestedDto })`)는 규정하지만, "조인된 엔티티를 참조 수준으로 좁힌 DTO"의 명명 규칙은 없음.
  - 상세: 이번 diff가 "엔티티 전체가 새는" 문제(트리거·워크플로우 조인)를 고치면서 `*RefDto` 접미어로 참조-전용 DTO를 두 파일에서 독립적으로 도입했다. 이유가 §5.4/§1-4 원칙(닫힌 필드 집합으로 좁히기)과 정확히 일치하고 실행도 올바르지만(§5.4 null/optional 선언 형태 전수 확인 — 아래 참조), 이 패턴이 이번이 처음이라 규약에는 아직 없다. 향후 유사 조인-축소 케이스가 반복될 가능성이 높다(§5.4 검증자가 "선언되지 않은 키" 축을 계속 스윕 중이므로).
  - 제안: 위반이 아니므로 target 수정은 불요. 다음에 `swagger.md` §1-4를 건드릴 때 "조인 엔티티를 참조 수준으로 좁힐 때는 `<Parent><Child>RefDto` 로 명명" 한 줄을 추가하면 향후 명명 이탈(예: `...Summary`, `...Preview` 등 동의어 난립)을 막을 수 있다.

- **[INFO] `consecutiveNetworkFailures` 노출 축소 후속 트래킹 — 본 검토 범위 밖 확인 필요**
  - target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 필드 주석 — "프런트엔드 참조가 0곳 … 빼는 것은 wire 변경(파괴적)이라 CHANGELOG 를 동반해야 한다 — 별도 항목으로 트래커에 남긴다"
  - 관련 규약: 직접적인 conventions 위반은 아님(§5.4는 선언-실제 정합만 요구하며, 이 필드는 현재도 상시 존재해 정합함). `plan/` 트래킹 여부는 `.claude/docs/plan-lifecycle.md` 관할이라 본 checker(정식 규약 준수, `spec/conventions/**` 한정) scope 밖.
  - 상세: 참고용 기록. cross_spec/plan_coherence 검토 대상으로 넘겨도 무방.

## 확인한 준수 근거 (위반 아님 — 교차검증 결과)

- **§5.4 null-vs-키생략 선언 형태**: `AlertRuleDto.createdBy/lastTriggeredAt`, `IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt`, `TriggerDto.chatChannel*/notification*` 전 필드가 "상시 존재 → `@ApiProperty({ nullable: true })` + `T | null`" 규칙을 정확히 따른다. `field?: T | null`(요청 전용 tri-state 조합, 응답 바디 금지) 패턴은 diff 전체에서 0건 (`git diff origin/main...HEAD -- 'codebase/backend/src/modules/*/dto/responses/*.ts' | grep 'ApiPropertyOptional({ nullable: true'` → 결과 없음). CHANGELOG.md 자체가 "첫 판에 17개를 이 금지 조합으로 잘못 썼다가 되돌렸다"는 자기반증 이력을 남기고 있어(§Unreleased "같은 조합이 조용히 넓어지지 못하게 래칫을 세웠다"), 최종 상태만이 아니라 그 과정도 규약을 향해 수렴했음을 확인.
- **swagger.md §3 "JSDoc은 공개 API, `//`는 내부 서사" 분리**: 5개 diff DTO 파일 모두 리뷰 참조·정정 경위(`review/code/...`, `#1288` 등)를 `//` 블록에, 소비자용 설명은 `/** */`에 정확히 분리해서 적재.
- **audit-actions.md ↔ 1-auth.md §4.1 카탈로그 정합**: `audit-actions.md §3` 레지스트리(resource/pattern/action 표)와 `1-auth.md §4.1`의 "현재 구현된 액션" 표를 항목 단위로 대조 — integration·user·auth_config·execution·workspace·member·workflow·trigger·schedule·model_config 전 카테고리 일치. 불일치 없음.
- **error-codes.md §3 historical-artifact 레지스트리 ↔ 1-auth.md §1.5.4**: `invitation_not_found`/`invitation_expired`/`invitation_already_used`/`invitation_email_mismatch`/`forbidden`/`rate_limited` (lower_snake_case) 예외가 양쪽 문서에 "초대 API 한정" 문구까지 동일하게 등재됨을 확인.
- **§5.4 검증자(response-contract.ts / swagger-dto-contract-guard.ts) 등재**: `spec/5-system/2-api-convention.md`와 `spec/conventions/swagger.md` 양쪽 frontmatter `code:`에 `repo-guards/__tests__/swagger-dto-contract*.ts` · `shared/testing/response-contract*.ts` · `shared/testing/swagger-probe*.ts` 가 동일하게 등재되어 있어, api-convention.md §5.4 "두 검증자는 양쪽 문서의 `code:` 에 모두 등재" 서술과 실제가 일치.
- **문서 구조(Overview/본문/Rationale)**: `1-auth.md`(Overview L78-89 · 본문 L92-573 · Rationale L576-940), `2-api-convention.md`(Overview L971-980 · 본문 L983-1414 · Rationale L1418-1473) 모두 3섹션 구성 준수.
- **명명 컨벤션**: `spec/0-overview.md`(`0-` prefix) · `spec/5-system/_product-overview.md`(`_product-overview.md`) 파일 존재 확인(`ls` 실측). URL/DTO 파일 위치(`dto/responses/*-response.dto.ts`)도 `swagger.md §5-1` 규칙과 일치.
- **numeric wire 타입(§1-6)**: 이번 diff에 `numeric`/`decimal` 패스스루 필드 신규 추가 없음(대상 필드는 uuid/date-time/string/boolean/enum/number-예산-derived 뿐) — 위반 표면 자체가 없음.

## 요약

이번 브랜치는 `spec/5-system/`·`spec/conventions/` 문서 자체를 건드리지 않았고(델타 0), 구현 diff(응답 DTO 필드 보강 + §5.4 스윕 + response-contract 검증자)는 기존에 확정된 규약(swagger.md §1-4/§1-6/§3/§5-1, api-convention.md §5.4, audit-actions.md, error-codes.md historical-artifact 레지스트리)과 필드 단위로 대조해도 어긋남이 없다. 오히려 CHANGELOG.md 자체가 "금지 조합을 한 번 잘못 썼다가 되돌린" 자기반증 이력을 남겨, 규약이 실제로 작동하는 가드 역할을 했음을 보여준다. CRITICAL·WARNING 은 없고, 신규 `*RefDto` 명명 패턴을 규약에 소급 등재하면 좋겠다는 INFO 1건만 남긴다.

## 위험도

NONE
