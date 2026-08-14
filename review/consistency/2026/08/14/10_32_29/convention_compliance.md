# 정식 규약 준수 검토 — spec/5-system/ (impl-done)

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `git diff origin/main...HEAD --stat`(현재 worktree) 확인 결과, 이번 세션에서 `spec/5-system/**` 자체에는 diff 가 **없다**. 실질 코드 변경은 `codebase/backend/src/modules/websocket/websocket.service.ts`(`llmCalls` strip 을 depth-1 → 깊이 무관으로 하드닝, 커밋 `81f2c60d6`) 뿐이며, 이는 REST DTO/API 데코레이터가 아닌 내부 서비스 함수라 Swagger/DTO 명명 규약의 적용 대상이 아니다.
- 따라서 본 검토는 프롬프트가 번들한 `spec/5-system/2-api-convention.md`(전문) · `spec/5-system/6-websocket-protocol.md`(전문) 을 대상으로, 관련 `spec/conventions/**` 항목과 대조했다.
- **중요 제약**: 프롬프트의 "정식 규약 모음(spec/conventions/)" 섹션은 컨텍스트 예산 초과로 **271개 파일 전부가 본문 없이 생략**되어 있었다. 이 상태로는 정합 여부를 판단할 근거가 프롬프트 안에 전혀 없으므로, `swagger.md` · `node-output.md` · `error-codes.md` · `node-cancellation.md` · `redis-keys.md` · `interaction-type-registry.md` 를 리포지토리에서 직접 `Read`/`grep` 하여 대조했다 (호출 규약의 "여기 없다는 사실을 근거로 삼지 말 것" 지시 이행).

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 규약 위반은 발견하지 못했다. 두 대상 문서는 과거 다수의 consistency 라운드(§11 webhook 정합화, §4.4 wire caveat, EIA §6 단일화 등)를 거치며 이미 규약과 상당히 정합화된 상태다. 아래는 검증한 주요 항목과 결과.

- **명명 규약**: URL 케밥케이스·복수형 리소스, HTTP 메서드 표(PUT 미사용), 에러 코드(`VALIDATION_ERROR` 등)·WS 에러 코드(`INVALID_EXECUTION_STATE` 등) 전부 `UPPER_SNAKE_CASE` — `spec/conventions/error-codes.md §1` 규약과 일치. 예외 레지스트리(§3, lowercase 초대 코드군 등)에 속하는 코드는 대상 문서에 등장하지 않는다.
- **출력 포맷 규약**: §5.2 목록 응답의 `{ data:[...], pagination:{...} }` 형제 구조, §5.4 부재표현(`null` vs 키 생략) 은 `swagger.md §2-5`·`§1-3`(Optional 필드) 서술과 정합. §5.2 의 "공용 `PaginatedResponseDto`" 명칭도 `swagger.md §5-2` 헬퍼 표의 실제 명칭과 일치. Rate limiting 표(§7)의 `PROVIDER_PROBE_THROTTLE`/`SENSITIVE_ACTION_THROTTLE`(별칭 `INVITATION_THROTTLE`) 는 `codebase/backend/src/common/constants/throttle.ts` 및 `llm-model-config.controller.ts`/`workspaces.controller.ts` 실제 코드와 대조해 이름·별칭 관계까지 정확히 일치함을 확인했다.
- **비-페이징 고정 컬렉션(`{data:{items}}`)**: `swagger.md §6` 이 금지하는 "페이지네이션 메타를 `items` 옆에 뒤섞은" 이중 래핑 버그와 명확히 구분해 서술하고 있어(§5.2 blockquote, Rationale), 금지 패턴 오인용이 아니다.
- **Redis 키 명명**: 6-websocket-protocol.md §2.2 의 `exec:seq:<executionId>`(소유: `modules/websocket`) 는 `spec/conventions/redis-keys.md §3` 인벤토리 표와 소유 모듈까지 정확히 일치.
- **interactionType enum**: 6-websocket-protocol.md §4.4 의 4값(`form`/`buttons`/`ai_conversation`/`ai_form_render`) 은 `spec/conventions/interaction-type-registry.md §1.1` 의 backend/frontend SoT 선언과 정확히 일치(4↔3 매핑 설명도 일관).
- **문서 구조**: 두 문서 모두 `## Overview` 헤더 없이 바로 본문으로 시작하나, 이는 위반이 아니다 — `project-planner/SKILL.md §Spec 문서 구조`가 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"로 Overview 를 분리하도록 규정하며, `spec/5-system/_product-overview.md` 가 실재하고 두 문서 모두 상단에서 이를 링크한다. 양쪽 다 말미에 `## Rationale` 섹션을 갖춰 3섹션 구성 취지를 충족한다.
- **AI Agent multi-turn `llmCalls[]` strip 서술**: 코드가 이번 PR 에서 depth-1 → 깊이 무관 strip 으로 강화됐으나, 6-websocket-protocol.md 본문(§4.4 새 blockquote)·Rationale("`ai_message.llmCalls[]` 외부 수신자 strip") 모두 "strip 된다"고만 서술할 뿐 "top-level 전용"이라는 구현 세부를 spec 본문에 약속한 적이 없다. 따라서 이번 하드닝은 spec 이 약속한 계약과 상충하지 않으며 spec 갱신 의무도 없다(코드 주석만 자체 갱신됨, 정상).

### [INFO] §5.4 인용 절 번호가 실제로는 §1-4 사례까지 포괄

- target 위치: `spec/5-system/2-api-convention.md` §5.4 "DTO 선언이 wire 를 반영해야 한다" 문장
- 위반 규약: 명시적 위반은 아님 — 인용 정확도에 대한 참고
- 상세: "`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`" 서술에 `[Swagger 규약 §1-3](../conventions/swagger.md#1-3-optional-필드)` 하나만 인용하고 있다. 그러나 `nullable: true` + `| null` 조합의 실제 예시 코드는 `swagger.md §1-3`(plain optional, `order?: 'asc' | 'desc'`)가 아니라 `§1-4`(닫힌 union 예시 `context?: ButtonsContextDto | NodeOutputContextDto | null` + `nullable: true`)에 있다. §1-3 은 키 생략 패턴(`field?: T`, `| null` 없음)의 근거로는 정확하지만, `nullable: true` 패턴까지 §1-3 하나로 인용하는 것은 다소 부정확하다.
- 제안: `[Swagger 규약 §1-3·§1-4]` 로 인용을 확장하거나, 두 문장을 분리해 각각 정확한 절을 인용. 사소한 표기 정확도 문제라 CRITICAL/WARNING 급은 아니다.

## 요약

이번 세션의 실제 코드 diff(`websocket.service.ts` strip 하드닝)는 REST DTO/API 데코레이터 표면이 아니라 내부 fanout 유틸리티라 정식 규약(명명·Swagger 데코레이터·문서 구조) 적용 대상 밖이며, spec 문서(`spec/5-system/**`)도 이번 diff-base 대비 변경이 없었다. 프롬프트에 번들된 `2-api-convention.md`·`6-websocket-protocol.md` 전문을 관련 `spec/conventions/**`(swagger·node-output·error-codes·node-cancellation·redis-keys·interaction-type-registry, 프롬프트에 본문이 누락되어 리포지토리에서 직접 재확인) 와 대조한 결과 CRITICAL/WARNING 급 위반은 없었다. 에러 코드 표기·응답 wrapping·Redis 키·interactionType enum·throttle 상수명 등 교차검증 가능한 항목은 전부 실제 코드/타 규약 문서와 정확히 일치했다. 유일한 지적은 §5.4 의 인용 절 번호 정확도에 대한 INFO 성 제안이다.

## 위험도

NONE
