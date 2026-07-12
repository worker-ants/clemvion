# maintainability-reviewer (journal 복구 — disk-write gap 로 원본 output 유실, wf_62c80b6c-072 journal.jsonl 에서 복원)

### 발견사항

- **[WARNING]** `EMBED_CONFIG_CACHE_MAX_MIN` 네이밍이 기존 코드베이스의 `_MIN` 컨벤션과 충돌
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:44` (`const EMBED_CONFIG_CACHE_MAX_MIN = Math.ceil(EMBED_CONFIG_CACHE_SEC / 60);`)
  - 상세: 이 상수는 "분(minutes)" 단위 상한을 뜻하지만, 동일 백엔드 코드베이스에서 `_MIN` 접미사는 이미 "최솟값(minimum)" 의미로 쓰이고 있다 (`execution-engine.service.ts` 의 `PARALLEL_BRANCH_COUNT_MIN`, `PARALLEL_MAX_CONCURRENCY_MIN`). 반면 "분 단위 기간"을 뜻하는 기존 상수들은 전부 `_MINUTES` 를 쓴다 (`ai-turn-executor.ts` `DEFAULT_RETRY_STATE_TTL_MINUTES`, `system-status.constants.ts` `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`). `EMBED_CONFIG_CACHE_MAX_MIN` 은 "MAX_MIN" 조합이라 "최대·최소" 범위처럼도 읽혀 특히 모호하다.
  - 제안: `EMBED_CONFIG_CACHE_MAX_MINUTES` 또는 `EMBED_CONFIG_CACHE_MAX_DELAY_MINUTES` 로 개명해 기존 `_MINUTES` 컨벤션과 정렬하고 `_MIN`="minimum" 의미와의 혼동을 제거.

- **[INFO]** ApiOperation description 블록의 문자열 결합 스타일이 바로 아래 ApiResponse 블록과 불일치
  - 위치: `hooks.controller.ts:46-51` (`'...' + EMBED_CONFIG_CACHE_CONTROL + '...' + EMBED_CONFIG_CACHE_MAX_MIN + '...'`) vs `hooks.controller.ts:158` (``` `${EMBED_CONFIG_CACHE_CONTROL} — ... ${EMBED_CONFIG_CACHE_MAX_MIN}분 ...` ```)
  - 상세: 같은 파일 내 같은 목적(상수 값을 문서 문자열에 삽입)에 대해 한쪽은 `+` 문자열 결합, 다른 쪽은 템플릿 리터럴을 쓴다. 이유는 이해 가능 — description 문자열 안에 마크다운용 리터럴 백틱(`` ` ``)이 다수 포함돼 있어 템플릿 리터럴로 바꾸면 그 백틱들을 전부 이스케이프해야 해 오히려 가독성이 떨어진다. 그 트레이드오프를 감안하면 현재 선택은 실용적이지만, 스타일 일관성 관점에서는 옥에 티.
  - 제안: 현행 유지 가능. 더 다듬고 싶다면 마크다운 백틱을 포함한 description 전체를 별도 헬퍼 함수(`buildEmbedConfigDescription()`)로 뽑아 결합 로직을 격리하면 두 스타일 혼재가 덜 두드러진다. 우선순위 낮음.

- **[INFO]** 변경 자체는 실제 DRY 결함을 해소하는 긍정적 리팩터
  - 위치: `hooks.controller.ts:39-44, 61-62, 79-80, 169`
  - 상세: 기존에 `300`/"5분" 이 실제 헤더 값과 Swagger 문서 문자열 2곳에 개별 하드코딩돼 드리프트 위험이 있었다(선행 ai-review INFO, plan 문서에 근거 기재됨). 이번 변경으로 `EMBED_CONFIG_CACHE_SEC` 단일 진실에서 `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MIN` 을 파생시켜 4개 사용처가 전부 상수를 참조하도록 정리했고, 렌더 결과는 byte-identical(300→5분 유지)이라 behavior-preserving 하다. 각 상수에 목적을 설명하는 JSDoc 주석도 기존 스타일과 일치.
  - 제안: 없음 (긍정 평가).

### 요약
이번 변경은 `hooks.controller.ts` 의 embed-config 캐시 TTL 하드코딩 중복을 상수 파생으로 단일화하는 소규모 behavior-preserving DRY 리팩터로, 함수 길이·중첩·복잡도에 영향이 없고 매직 넘버 제거라는 본래 목적을 잘 달성했다. 유일한 실질적 지적은 신설 상수 `EMBED_CONFIG_CACHE_MAX_MIN` 의 네이밍이 코드베이스 기존 `_MIN`(최솟값) / `_MINUTES`(분 단위 기간) 컨벤션과 충돌해 향후 다른 개발자가 오독할 소지가 있다는 점이며, 문자열 결합 스타일 불일치는 마크다운 백틱 제약을 고려하면 감수할 만한 수준이다. plan 문서(`plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`)는 배경·방침·체크리스트가 명확해 별도 지적사항 없음.

### 위험도
LOW