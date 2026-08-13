# 신규 식별자 충돌 검토

## 조사 방법 및 스코프 확인

prompt_file 이 지목한 target(`spec/5-system/`)의 본문은 컨텍스트 예산 초과로 모두 생략되어 있었다.
`git diff origin/main...HEAD --stat -- spec/5-system/` 를 절대경로 워크트리에서 직접 실행해
확인한 결과 **이번 diff 는 `spec/5-system/` 아래 어떤 파일도 변경하지 않는다** — 즉 신규
요구사항 ID·엔티티명·endpoint·이벤트명·spec 파일 경로는 이번 변경분에 하나도 없다
(EIA §6 outbound notification 계약 재작성은 plan 기록상 별도 PR #1166 으로 이미
`origin/main` 에 반영된 이력이며 본 diff 의 범위 밖).

이번 diff(`origin/main...HEAD`)가 실제로 건드리는 것은 backend 코드뿐이다:
- `codebase/backend/src/common/utils/assert-row-array.ts` (+`.spec.ts`, 신규 파일)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`

따라서 본 리뷰는 "이번 diff 가 새로 도입하는 코드 식별자"가 기존 spec/코드 사용처와
충돌하는지를 절대경로 워크트리 `git grep` 으로 전수 확인하는 방식으로 진행했다.

## 발견사항

신규 식별자 충돌 관점에서 CRITICAL/WARNING 급 발견 없음. 확인한 신규 식별자와 근거는 다음과 같다.

- **[INFO] 신규 유틸 함수 `assertRowArray` — 충돌 없음, 기존 명명 컨벤션과 정합**
  - target 신규 식별자: `assertRowArray(rows, detail)` (`codebase/backend/src/common/utils/assert-row-array.ts:16`)
  - 기존 사용처 대조: `git grep -n "assertRowArray"` 전체 결과가 신규 파일 4곳(정의 1 + 소비 3: `execution-engine.service.ts:202,2937,8218,8535`, `executions.service.ts:22,325`)뿐이며, 기존에 이 이름을 다른 의미로 쓰는 곳은 없다.
  - 상세: 같은 디렉터리·인접 모듈의 기존 런타임 가드 명명 패턴(`assertExecutionNotCancelled`, `assertTransition`, `assertProductionConfig`, `assertCorsOriginsConfigured`, `assertSafeOutboundUrl`, `assertDocumentIdPayload`, `assertActiveTimeWithinLimit` — 전부 `assert+대상` 형태)과 일관되어 오히려 컨벤션에 부합한다. 충돌 없음.
  - 제안: 조치 불필요.

- **[INFO] `SNAPSHOT_CACHE_MAX_ENTRIES` 신규 export — 충돌 없음**
  - target 신규 식별자: `export const SNAPSHOT_CACHE_MAX_ENTRIES = 256` (`codebase/backend/src/modules/executions/executions.service.ts:64`, 기존에는 module-local `const` 였으나 이번 diff 에서 테스트가 값을 직접 단언할 수 있도록 export 로 승격)
  - 기존 사용처 대조: `git grep -n "SNAPSHOT_CACHE_MAX_ENTRIES\|_CACHE_MAX\|MAX_ENTRIES\|_CACHE_SIZE"` 로 backend 전역을 조회한 결과, 같은 이름을 다른 의미로 쓰는 곳 없음. 가장 근접한 이름(`EMBED_CONFIG_CACHE_MAX_MINUTES`, `hooks.controller.ts`)은 완전히 다른 도메인(웹훅 embed 설정 캐시 TTL)이라 혼동 소지 낮음.
  - 상세: `spec/5-system/` 내 유사 캐시 상한 개념(`AGENT_MEMORY_MAX_PER_SCOPE=1000`, `STORAGE_MAX_TURNS`)과도 이름이 겹치지 않는다.
  - 제안: 조치 불필요.

- **[INFO] 신규 테스트 헬퍼 `buildDispatcherHarness` / `callHandle` — 파일 스코프 로컬, 충돌 없음**
  - target 신규 식별자: `chat-channel.dispatcher.spec.ts:711` (`buildDispatcherHarness`), `:758` (`callHandle`)
  - 기존 사용처 대조: 두 이름 모두 해당 spec 파일 내부에만 존재(`git grep` 결과 각 1개 정의 지점). export 되지 않는 파일 스코프 함수라 다른 모듈과 충돌 여지 없음.
  - 제안: 조치 불필요.

- **[INFO] 파일 경로 `common/utils/assert-row-array.ts` — 디렉터리 명명 컨벤션은 혼재, 신규 파일은 다수파 형태를 따름**
  - target 신규 식별자: 파일 경로 `codebase/backend/src/common/utils/assert-row-array.ts`
  - 기존 사용처: 같은 디렉터리에 `*.util.ts` 접미사를 쓰는 파일(`crypto.util.ts`, `password.util.ts`, `mask-sensitive-fields.util.ts`, `ssrf-safe-url.util.ts`, `workspace-context.util.ts`)과 접미사 없는 파일(`cors-origins.ts`, `process-in-batches.ts`, `smtp-host-guard.ts`, `timezone.ts`, `uuid.ts`, `with-timeout.ts`, `app-base-url.ts`, `oauth-stub-mode.ts`, `throttler-skip.ts`)이 공존한다.
  - 상세: 이 디렉터리는 애초에 정식 명명 규약이 없어(둘 다 공존) `assert-row-array.ts`(접미사 없음)가 어느 쪽과도 "충돌"하지는 않는다. 기존 파일과 겹치는 이름도 아니다.
  - 제안: 조치 불필요. (spec/conventions 에 이 디렉터리용 명명 규약이 별도로 없으므로 이번 PR 범위에서 통일을 요구할 근거 없음.)

target 범위(`spec/5-system/`)에 대해서는 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·
webhook/queue/SSE 이벤트명·환경변수/설정키·spec 파일 경로 중 어느 것도 이번 diff 로 신규
도입되지 않았으므로 해당 6개 관점 모두 "해당 사항 없음"이다.

## 요약

이번 diff 는 `spec/5-system/` 문서를 전혀 변경하지 않으며(변경은 코드 하드닝 4개 파일 + 2개
plan 문서에 한정), 새로 도입된 코드 식별자는 `assertRowArray`(신규 유틸 함수), 신규 export 된
`SNAPSHOT_CACHE_MAX_ENTRIES`, 파일 스코프 테스트 헬퍼 2개뿐이다. 절대경로 워크트리에서
`git grep` 전수 대조 결과 이들 중 어느 것도 기존 spec 문서나 코드베이스의 다른 의미 사용과
충돌하지 않으며, 명명 컨벤션과도 정합한다. 신규 식별자 충돌 관점에서 이번 변경분을 막을 사유
없음.

## 위험도

NONE
