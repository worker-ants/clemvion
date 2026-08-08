STATUS=success convention_compliance: 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 방법
- Target: `spec/data-flow/` 전체 16개 문서(`0-overview.md` ~ `15-external-interaction.md`), 번들 전문 정독.
- 코드 diff: `origin/main...HEAD` 73개 파일 전수 스캔 (`codebase/backend/src/**`).
- 대조 규약: `spec/conventions/audit-actions.md`, `error-codes.md`, `node-cancellation.md`, `cafe24-api-catalog/*`, `cafe24-api-metadata.md`, `chat-channel-adapter.md`, `conversation-thread.md`, `execution-context.md`, `interaction-type-registry.md`, `makeshop-api-catalog/*`, `migrations.md` (번들 전문).
- 실제 코드 확인은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/backend-lint-gate-b72fdd`) 절대경로 기준 diff 로 수행.

## 핵심 판단 — 코드 diff 는 순수 lint/타입 정리, spec 이 규정한 어떤 표면도 건드리지 않음

73개 변경 파일을 전수 샘플링한 결과, 모든 hunk 가 다음 두 범주로 수렴한다.

1. **Union 타입 줄바꿈 포맷 변경** — `A | B | undefined` 를 여러 줄로 쪼개던 것을 한 줄로 병합 (prettier 룰 변경으로 추정). 의미 변화 없음.
2. **불필요 타입 단언(`as unknown as string[]`, `as LanguageLocale | undefined`) 제거** — `@typescript-eslint/no-unnecessary-type-assertion` 신규 lint 적용. `retry-turn.service.ts` 등 3곳은 오탐으로 판명돼 `eslint-disable-next-line` + 근거 주석으로 유지.

`@ApiProperty`/`@IsIn` 데코레이터, DTO 필드명, endpoint path, 에러 코드 문자열, audit action 문자열, queue 이름, WS 이벤트 이름 등 **spec/conventions 가 규율하는 어떤 식별자도 변경되지 않았다** (`git diff` 에 `spec/**` 파일 자체가 전혀 등장하지 않음도 확인). 따라서 diff 로 인한 신규 CRITICAL/WARNING 위반은 없다.

## 정식 규약 대조 결과 (standing 컴플라이언스)

### 1. 명명 규약
- `spec/data-flow/1-audit.md` §1.1 의 action 표기(`integration.created` 등 과거분사, `execution.re_run`/`workspace.transfer_ownership` 도메인 동사, `auth_config.*`/`model_config.*` 현재형)가 `spec/conventions/audit-actions.md` §2.1~§2.3 taxonomy·§3 레지스트리와 1:1 일치. 위반 없음.
- `spec/data-flow/3-execution.md`(§Rationale `WORKER_HEARTBEAT_TIMEOUT` 재정의 이력 등)가 `spec/conventions/error-codes.md` §1(의미 기반 명명)·§5(rename 이력)와 정합.
- 파일 prefix(`0-overview.md`~`15-*.md`)는 CLAUDE.md 의 "영역 폴더 내 `0-`=진입 문서" 관행과 일치.

### 2. 출력 포맷 규약
- diff 가 DTO/응답 envelope 을 건드리지 않아 `error-codes.md §Overview`(응답 envelope SoT = `5-system/2-api-convention.md §5.3`)와 충돌 소지 없음.
- `node-cancellation.md` §6 구현 현황 표가 `retry-turn.service.ts`/`execution-engine.service.ts`/`ai-turn-orchestrator.service.ts` 를 `code:` 로 명시하는데, 이번 diff 는 그 표가 서술하는 어떤 동작 계약(§2.4 DB 관측 가드, §5 AbortError 분류)도 변경하지 않았다 — 문서-구현 drift 없음.

### 3. 문서 구조 규약
- 샘플 검사한 `0-overview.md`, `1-audit.md`, `3-execution.md`, `7-llm-usage.md`, `11-workflow.md`, `12-workspace.md`, `2-auth.md`, `4-file-storage.md`, `5-integration.md`, `6-knowledge-base.md`, `8-notifications.md`, `9-observability.md` 전부 Overview → 본문(Source→Sink/Schema/상태전이/외부의존) → Rationale 3섹션 구조를 일관되게 따름.
- `spec/data-flow/*.md` 는 frontmatter(`id`/`status`/`code`) 가 없으나, 이는 `spec/conventions/spec-impl-evidence.md` §1 이 **명시적으로 제외**한 영역이다("`spec/data-flow/**` 는 ... frontmatter 의무 대상이 아니다"). 위반이 아니라 의도된 예외.

### 4. API 문서 규약
- diff 내 `@ApiProperty`/`@IsIn` 데코레이터는 값 변경 없이 타입 단언만 제거됐다(`interact.dto.ts`, `notification-config.dto.ts`). Swagger 노출 계약(enum 값·example)은 그대로 유지.
- `cafe24-api-catalog/*`·`cafe24-api-metadata.md`·`makeshop-api-catalog/*` 규약이 규율하는 카탈로그 표/동기 테스트 대상 파일은 이번 diff 에 등장하지 않음(빌드 스크립트/핸들러 리팩토링만).

### 5. 금지 항목
- `error-codes.md` §2(rename 금지), `audit-actions.md` §1(인라인 문자열 금지, prefix 없는 표기 금지) 에 해당하는 패턴이 diff 에 없음.
- eslint-disable 주석 신규 추가(`no-unnecessary-type-assertion` 3건)는 spec/conventions 어디에도 금지 대상으로 등재돼 있지 않은 코드 스타일 사안이라 본 규약 검토 범위 밖(코드 리뷰 영역).

## 발견사항

- **[INFO] frontmatter 부재는 의도된 예외 — 오탐 방지용 기록**
  - target 위치: `spec/data-flow/*.md` 전체 (frontmatter 없음)
  - 위반 규약: 해당 없음 (`spec/conventions/spec-impl-evidence.md §1` 이 명시적으로 제외)
  - 상세: 다른 `spec/**` 최상위 문서(`spec/1-data-model.md` 등)는 `id`/`status` frontmatter 를 갖는데 `spec/data-flow/*.md` 는 없어 표면적으로 불일치처럼 보일 수 있다. 그러나 이는 규약이 "구현 lifecycle 을 추적할 product surface 가 아님" 을 근거로 명시적으로 면제한 케이스다.
  - 제안: 조치 불필요. 향후 리뷰어가 동일 패턴을 재지적하지 않도록 기록만 남김.

## 요약

이번 diff(`backend-lint-gate`)는 73개 backend TS 파일에 걸친 순수 lint/타입-안전성 정리(union 타입 줄바꿈 통일, 불필요 타입 단언 제거)로, `spec/data-flow/` 가 규정하는 endpoint·DTO·이벤트·에러 코드·audit action 등 어떤 명명/출력 표면도 변경하지 않았다. `spec/data-flow/` 자체도 `spec/conventions/`(audit-actions, error-codes, node-cancellation 등)와 표기·구조·SoT 분리 원칙이 광범위하게 정합했다. 정식 규약 위반은 발견되지 않았다.

## 위험도
NONE
