# 정식 규약 준수 검토 — `spec/data-flow/` (EIA §R8 캐시 키 스코프)

## 조사 범위 메모
- 이번 diff(3개 파일: `idempotency.interceptor.ts`/`.spec.ts`, `external-interaction.e2e-spec.ts`)는 **spec 파일을 건드리지 않는다** — `git log --oneline origin/main..HEAD` 확인 결과, `spec/data-flow/15-external-interaction.md` 및 `spec/5-system/14-external-interaction-api.md` 의 §R8 캐시 키 스코프 서술은 이미 origin/main 에 선행 병합된 문서 PR(#1154·#1155·#1156)에서 완성돼 있고, 본 diff 는 그 spec 을 뒤늦게 구현으로 따라잡는 코드 변경이다. 즉 target 문서(`spec/data-flow/`)는 이번 PR 로 신규/변경되지 않았다.
- 따라서 검토는 (a) target 문서 현행 상태가 conventions 를 준수하는지, (b) 이번 코드 diff 가 target 문서에 새로 반영해야 할 이름·포맷을 어긋나게 도입하지 않았는지 두 축으로 수행했다.
- `spec/conventions/**` 는 orchestrator 번들에서 예산 초과로 다수 잘려 있어(`conversation-thread.md`/`error-codes.md`/`execution-context.md`/`node-output.md`/`swagger.md`/`spec-impl-evidence.md` 등), 워크트리 절대경로에서 직접 원문을 읽어 대조했다.

## 발견사항

없음. 아래 항목별로 확인했으나 CRITICAL/WARNING 급 위반을 찾지 못했다.

1. **명명 규약**
   - Redis 키 `interaction:idempotency:<executionId>:<route>:<key>` — 같은 문서·같은 모듈 내 기존 키(`iext:blacklist:<jti>`, `exec:seq:<executionId>`)와 동일한 `<segment>:<segment>` 콜론 구분·angle-bracket placeholder 표기를 따른다. 새 명명 규약 위반 없음.
   - 에러 코드(`EXECUTION_TERMINATED`, `VALIDATION_ERROR`, `STATE_MISMATCH`)는 모두 기존 `UPPER_SNAKE_CASE` 코드 재사용이며 신규 코드를 도입하지 않았다 — `spec/conventions/error-codes.md` §1(의미 기반 명명)·§3(예외 레지스트리) 대상 아님.
   - `RequestWithInteraction`(interaction.guard.ts) 타입 import 등 TS 식별자는 PascalCase/camelCase 관례를 벗어나지 않는다.

2. **출력 포맷 규약**
   - 이번 diff 는 controller/DTO 응답 shape 를 변경하지 않는다(인터셉터의 캐시 키만 스코프 확장). API 응답 envelope(`{ data }`)·에러 응답 포맷(`spec/conventions/error-codes.md`, `5-system/2-api-convention.md §5.3`)에 영향 없음.

3. **문서 구조 규약**
   - `spec/data-flow/0-overview.md` §2 "도메인 인덱스" — 15개 형제 문서 전부(감사·실행·워크플로우·워크스페이스·External Interaction 포함)를 링크로 포함, `spec-area-index.test.ts` 요구(영역 index + 전 sibling 링크)를 충족.
   - `15-external-interaction.md` 는 Overview(System role) → 1~4(Source→Sink / Schema 매핑 / 상태 전이 / 외부 의존) → Rationale 5요소 템플릿(§3 in `0-overview.md`)을 그대로 따른다. §R8 캐시 스코프 서술은 §1.2 Source→Sink, §2.2 Schema 매핑 표, Rationale "Fail-open 정책의 일관 표기" 세 곳에 일관되게 반영돼 있다.
   - frontmatter — `spec/conventions/spec-impl-evidence.md §1` 이 `spec/data-flow/**` 를 frontmatter(`id`/`status`/`code`) 의무 대상에서 명시적으로 제외한다("데이터 흐름 다이어그램·엔티티↔플로우 매핑 문서로 … frontmatter 자체가 없다"). 실제로 `15-external-interaction.md`/`0-overview.md` 모두 frontmatter 없이 정상 — 위반 아님.

4. **API 문서 규약(swagger)**
   - `IdempotencyInterceptor` 는 swagger 데코레이터·DTO 표면과 무관한 cross-cutting 인터셉터이며, `spec/conventions/swagger.md` 는 이 인터셉터를 대상으로 문서화 요구를 두지 않는다(응답 envelope `TransformInterceptor` 관련 서술만 존재). 이번 diff 가 컨트롤러·DTO 를 변경하지 않으므로 swagger 갱신 의무도 발생하지 않는다.

5. **금지 항목**
   - "전역 키 fallback 금지"(ctx 부재 시 캐시 skip, `logger.warn` 후 `next.handle()`)는 인터셉터의 기존 fail-open 패턴(Redis 미주입 시 skip)과 동일한 방향의 저하 정책이라 별도 금지 패턴을 새로 만들지 않는다.
   - 새로 등장한 `lower_snake_case` 코드나 breaking rename 등 `error-codes.md` §2/§3 이 경계하는 패턴 없음.

## 참고로 확인한 conventions 파일 (직접 원문)
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/error-codes.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/execution-context.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/interaction-type-registry.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/spec-impl-evidence.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/node-output.md` (일부)
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/conventions/swagger.md` (일부, grep)
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/data-flow/0-overview.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/data-flow/15-external-interaction.md`

## 요약
이번 PR 의 diff 는 spec 문서를 변경하지 않으며, target 인 `spec/data-flow/`(특히 §R8 캐시 키 스코프를 다루는 `15-external-interaction.md`)는 이미 선행 병합된 문서 PR 에서 conventions 를 준수하는 형태로 확정돼 있었다. 명명(Redis 키·에러 코드)·문서 구조(Overview/본문/Rationale, 영역 index)·frontmatter 면제·API 문서 규약 다섯 관점 모두 위반이 확인되지 않았고, 이번 코드 diff 도 새로운 명명·출력 포맷을 도입하지 않아 target 문서와 실제로 상충하는 지점이 없다.

## 위험도
NONE
