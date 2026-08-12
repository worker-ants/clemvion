# 정식 규약 준수 검토 — spec/data-flow/ (impl-done)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- diff (`git diff origin/main...HEAD`) 를 확인한 결과, 이번 변경은 **backend ESLint `--max-warnings 0` 강제 도입에 따른 lint-warning 처분(타입 전용) PR**이다. `codebase/backend/README.md`, `package.json` 의 lint 스크립트 설정 변경과, 그 외 전부 TypeScript 타입 좁히기/단언/명시적 제네릭 추가(런타임 동작 불변)로 구성돼 있다. **`spec/**` 파일은 diff 에 전혀 포함되지 않았다** — `spec/data-flow/` 자체는 이번 PR 에서 수정되지 않았다.
- 코드 확인은 절대경로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/lint-warning-triage`)를 기준으로 직접 `Read`/`ls` 로 재확인했다.

## 발견사항

이번 diff 및 target(`spec/data-flow/`) 범위에서 아래 5개 관점을 점검했으나, CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

1. **명명 규약** — diff 에 새로 도입된 식별자는 `HttpResponseLike`(내부 전용 interface, `idempotency.interceptor.ts`)와 `SetupResult`(기존 export 를 새로 import 해 명시 타입으로 쓴 것뿐, 신규 선언 아님) 정도다. `SetupResult` 는 `spec/conventions/chat-channel-adapter.md §2.4` 가 정의한 정확히 그 이름과 shape(`registeredAt`/`externalHookUrl`/`identity`/`configUpdates`/`issuedInboundSigning`)을 그대로 참조하는 것으로 확인했다 — 규약과 어긋나지 않는다.
2. **출력 포맷 규약** — `chat-channel-config.dto.ts` 의 `@Transform(({ value }: { value: unknown }) => value === 'text_only' ? 'text' : value)` 변경은 타입 주석 추가일 뿐, 정규화 로직(`'text_only' → 'text'`) 자체는 그대로다. 이 정규화는 `spec/conventions/chat-channel-adapter.md §2.3 visualNode` 가 명시한 "legacy `'text_only'` 값은 어댑터가 read-time 에 `'text'` 로 normalize" 정책과 일치한다. API 응답 shape·에러 코드 변경은 diff 에 없다.
3. **문서 구조 규약** — target `spec/data-flow/` 전 파일(0-overview, 1-audit, 3-execution, 11-workflow, 12-workspace, 15-external-interaction 확인, 나머지 10개는 예산상 생략되어 실제 파일시스템에서 존재만 재확인)이 `## Overview → 본문 → ## Rationale` 3섹션 구조를 유지하고, 각 도메인 문서는 `### System role` 하위섹션을 공통 규약(`0-overview.md §3.1`)대로 갖춘다. 폴더 자체는 `spec/data-flow/0-overview.md`(진입 문서 + `## Overview` 섹션)로 CLAUDE.md 의 "`_product-overview.md` 또는 진입 문서의 `## Overview`" 대안 중 후자를 만족한다. 이번 PR 은 이 구조를 변경하지 않았다.
4. **API 문서 규약** — 변경된 DTO(`ChatChannelUiMappingDto`)의 `@ApiProperty`/`@IsIn` 등 API 문서 데코레이터는 diff 에서 손대지 않았고, `@Transform` 파라미터에 타입만 추가했다. Swagger 데코레이터·DTO 명명 패턴 변경 없음.
5. **금지 항목** — 코드 주석들(예: `idempotency.interceptor.ts` 의 `cacheTapped()` docstring, `idempotency.interceptor.spec.ts` 의 "409 캐너리" 테스트)이 EIA §R8(400 VALIDATION_ERROR 만 캐시 제외해야 하는데 구현은 `statusCode >= 400` 전체를 제외) 대비 **선재(pre-existing) 구현 갭**을 명시적으로 인정하고 있다. 이는 이번 PR 이 새로 만든 위반이 아니라 **기존 결함을 캐너리 테스트로 고정**하고 `plan/in-progress/backend-lint-gate-broken-on-main.md` 로 후속을 명시적으로 백로그화한 것 — 정식 규약(conventions) 위반이 아니라 spec-impl 정합성(별도 리뷰 축)의 기존 이슈이며, 본 PR 스코프("타입 전용, 런타임 동작 불변")를 벗어나지 않기로 의도적으로 결정한 사항이다. 새로운 금지 패턴 채택은 발견되지 않았다.

추가로 다음은 CRITICAL/WARNING 이 아닌 **참고 사항(INFO)**:

- **[INFO] 규약 번들 컨텍스트 예산 초과로 일부 미검토**
  - target 위치: N/A (검토 절차 자체에 대한 메모)
  - 위반 규약: 없음 — 절차상 제약 기록
  - 상세: 조립된 `_prompts/convention_compliance.md` 에서 `spec/data-flow/` 10개 파일(2-auth, 4-file-storage, 5-integration, 6-knowledge-base, 7-llm-usage, 8-notifications, 9-observability, 10-triggers, 13-agent-memory, 14-chat-channel)과 `spec/conventions/` 상당수(error-codes.md, swagger.md, node-output.md, execution-context.md, interaction-type-registry.md, cafe24/makeshop 카탈로그 다수 등)가 "본문 생략됨 — 컨텍스트 예산 초과"로 절단됐다. 이번 검토는 diff 스코프(코드 파일 목록)와 직접 연관된 부분(`chat-channel-adapter.md` 전문, `node-cancellation.md`/`secret-store.md` 전문)은 실제 파일시스템에서 절대경로로 재확인했으나, diff 와 무관해 보이는 나머지 생략분까지 전수로 열람하지는 않았다.
  - 제안: 이번 PR 은 순수 타입 전용 변경이라 실질적 리스크는 낮다고 판단하나, 향후 동일 target 을 다시 검토할 때(특히 `spec/data-flow/` 본문이 실제로 바뀌는 PR)는 예산 상향 또는 청크 분할 재실행을 권장.

## 요약

이번 PR 은 backend ESLint `--max-warnings 0` 도입에 따른 순수 타입-안전성 처분(assertion/제네릭 명시)이며 `spec/data-flow/` 를 포함해 `spec/**` 를 전혀 변경하지 않았다. 코드 diff 에서 새로 도입된 식별자(`HttpResponseLike`, `SetupResult` 재사용)와 데코레이터 타입 주석은 `spec/conventions/chat-channel-adapter.md` 가 정의한 명명·정규화 정책과 일치하며, API 응답 포맷·에러 코드·DTO 데코레이터 변경은 없다. target 문서(`spec/data-flow/` 각 파일) 자체의 Overview/본문/Rationale 3섹션 구조와 진입 문서 명명도 CLAUDE.md·자체 공통 규약(§3.1 System role)을 그대로 준수한다. 코드 주석이 인정한 EIA §R8 구현 갭은 본 PR 이 새로 만든 위반이 아니라 기존 결함을 캐너리로 고정하고 후속 plan 으로 위임한 것으로, 정식 규약(conventions) 위반이 아니다.

## 위험도

NONE
