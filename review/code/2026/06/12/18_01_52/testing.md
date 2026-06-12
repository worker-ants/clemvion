# Testing Review

## 발견사항

### 파일 3+4: backend-labels.test.ts + backend-labels.ts (i18n 에러 코드 추가)

- **[WARNING]** 신규 chat-channel 에러 코드 5종에 대한 `translateBackendError` 직접 단위 테스트 부재
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` `translateBackendError — 직접 단위 테스트` describe 블록 (현재 케이스 (1)~(6) 중 chat-channel 코드 없음)
  - 상세: P3-C-2 parity 가드(line 311–336)는 "매핑 키 존재 여부"만 검증한다. 이와 달리 `translateBackendError` 직접 단위 테스트 describe(line 416+)에는 `GRAPH_VALIDATION_FAILED`, `HTTP_BLOCKED`, `DB_HOST_BLOCKED` 각각의 케이스((1)/(5)/(6))가 있으나, 새로 추가된 `INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED` 에 대해서는 "ko → 한국어 반환, en → fallback 반환" 행동 검증 케이스가 없다. 기존 패턴 대비 일관성 갭.
  - 제안: 기존 (5)/(6) 패턴을 참조하여 `INVALID_BOT_TOKEN` 대표 1건(또는 5종 일괄)의 `translateBackendError("INVALID_BOT_TOKEN", undefined, "ko", fallback)` → `ERROR_KO["INVALID_BOT_TOKEN"]` 반환 케이스를 추가. parity guard 와 행동 guard 가 둘 다 존재해야 양방향 보호가 된다.

- **[INFO]** `WORKSPACE_ID_REQUIRED` 및 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` / `EXECUTION_TIME_LIMIT_EXCEEDED` / `MODEL_CONFIG_INVALID` 등 `ERROR_KO`에 이미 등록된 다른 에러 코드들은 P3-C-2 `LOCALIZED_ERROR_CODES` 목록에 포함되어 있지 않다.
  - 위치: `backend-labels.test.ts` line 314
  - 상세: 이번 변경에서 5개 chat-channel 코드를 추가한 것은 적절하나, 선행 PR에서 추가된 `WORKSPACE_ID_REQUIRED`, `CODE_*`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `MODEL_CONFIG_*` 등은 동일 목록에 없어 parity guard 검증 범위가 불균일하다. chat-channel 5종 추가로 더 눈에 띄는 누락.
  - 제안: 향후 `LOCALIZED_ERROR_CODES` 점진 확장 시 위 코드들도 함께 추가하도록 TODO 주석 또는 이슈 트래킹 권장.

### 파일 6: _generator.py (컨테이너 kind 가드 수정)

- **[WARNING]** `resp_param_rows` 내 컨테이너 kind 가드 로직(`if kind not in ('obj', 'arr')`)에 대한 전용 Python 단위 테스트 없음
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` line 2393–2394 (변경 핵심 로직)
  - 상세: 이 변경은 "응답 래퍼 `order` 가 쿼리 파라미터 `order`의 정렬 설명을 오가져오던 버그"를 수정한다. 해당 수정이 올바르게 동작하는지 회귀 방지할 Python 테스트(pytest 등)가 존재하지 않는다. `spec/conventions/cafe24-api-catalog/` 하위에 `_generator.py`에 대한 테스트 파일이 없다. `appstore-orders.md`의 `order` 필드 수정 결과물이 유일한 정황 증거.
  - 제안: `resp_param_rows`에 대해 (1) obj/arr kind 필드는 cross-map fallback 을 적용하지 않고 "(응답 객체)/(목록)" 라벨이 붙는다는 케이스, (2) 스칼라 kind 필드는 req/global/variant 에서 설명을 빌려오는 케이스를 최소 단위 테스트로 커버. 생성기 특성상 CI 자동 실행이 어렵더라도 수동 검증 레시피라도 `_overview.md`에 기술하는 것이 회귀 방지에 도움.

- **[INFO]** `_generator.py` 전체에 걸쳐 `_http_get`, `fetch_entity_json`, `resp_for_op`, `build_tree`, `build_desc_maps` 등 핵심 파싱 함수에 대한 자동화 테스트 없음
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py`
  - 상세: 생성기는 222개 카탈로그 파일의 single source of truth이나 테스트가 전무하다. HTML 구조 가정이 깨지면 대규모 출력 오염이 조용히 발생할 수 있다. 현재 변경은 small focused fix이므로 기존 기술 부채이며 blocking 이슈는 아니다.
  - 제안: `resp_param_rows`, `resp_for_op`, `_json_field_seq` 등 순수 함수 중심의 pytest 픽스처 추가 검토.

### 파일 1: plan/complete/fix-spec-frontmatter-catalog.md

- **[INFO]** 계획 문서이므로 테스트 대상 아님. 체크리스트상 `spec-frontmatter-parse.test.ts` 신규 작성(step 5–7) 및 unit PASS 기록이 명시되어 있어 적절히 이행된 것으로 확인.

### 파일 2: triggers.mdx (문서 텍스트 변경)

- **[INFO]** 사용자 문서 문자열 변경. "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요"로 수정. 이 주장이 실제로 참이려면 5개 chat-channel 에러 코드가 모두 `ERROR_KO`에 등록되어 `translateBackendError`가 ko로 번역해야 한다. 파일 4의 변경이 이를 구현하고 파일 3의 parity guard가 이를 검증하므로 구조적으로 일관성 있음. 테스트 관점에서 별도 조치 불필요.

### 파일 5: spec-sync-chat-channel-gaps.md

- **[INFO]** plan 추적 파일의 `worktree` 필드 변경(`spec-sync-audit` → `(unstarted)`). 테스트 대상 아님.

### 파일 7: appstore-orders.md (카탈로그 생성물 수정)

- **[INFO]** `_generator.py` fix의 출력 산출물로 `order` 컨테이너 필드 설명이 잘못된 쿼리 파라미터 설명에서 `(응답 객체)`로 정정됨. 파일 자체의 테스트는 없으나 이는 생성물의 성격상 예상된 것.

---

## 요약

이번 변경의 테스트 측면에서 핵심 로직인 `backend-labels.test.ts` P3-C-2 parity guard는 신규 5개 chat-channel 에러 코드의 `ERROR_KO` 키 존재 여부를 정확히 검증하며 직접 구동 단위 테스트도 기존 패턴(5)/(6)에 준하여 구성되어 있다. 다만 `translateBackendError` 직접 케이스(describe line 416+)에 chat-channel 코드 5종에 대한 행동 검증 케이스가 추가되지 않은 점은 기존 SSRF 코드 패턴과의 일관성 갭이다. `_generator.py`의 컨테이너 kind 가드 수정은 기능적으로 타당하나 Python 단위 테스트가 전무해 향후 유사 버그 회귀를 탐지할 수단이 없다. 전반적으로 i18n 계층의 parity guard는 잘 설계되어 있고 변경이 이를 충실히 활용하고 있으나, 직접 단위 테스트 보완과 생성기 테스트 부재가 낮은 위험도의 개선 항목으로 남는다.

## 위험도

LOW
