# 테스트(Testing) Review

## 발견사항

### 파일 3+4: backend-labels.test.ts + backend-labels.ts

- **[INFO]** `translateBackendError` 직접 단위 테스트 케이스 (7)(8) 추가 — 이전 Warning 해소
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` lines 111–127 (diff)
  - 상세: 이번 변경 set 에는 chat-channel 에러 코드 5종(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)에 대해 `translateBackendError` 직접 단위 테스트 케이스 (7)(ko → `ERROR_KO` 반환) / (8)(en → fallback 반환)가 추가되어 있다. 이는 이전 review(18_01_52) 에서 Warning#1 로 지적된 갭을 완전히 해소한다.
  - 제안: 이상 없음. 기존 (5)/(6) 패턴을 충실히 따르고 있고, 5종 일괄 루프 방식으로 코드 중복도 피했다.

- **[INFO]** `WORKSPACE_ID_REQUIRED` 가 `LOCALIZED_ERROR_CODES` parity 가드에 추가됨 — 이전 INFO#1 해소
  - 위치: `backend-labels.test.ts` diff lines 83–93 (`LOCALIZED_ERROR_CODES` 배열)
  - 상세: `WORKSPACE_ID_REQUIRED` 와 chat-channel 5종 모두 `LOCALIZED_ERROR_CODES` 에 추가되었고, 공용 데코레이터 코드임을 명시하는 주석도 추가됨. `ERROR_KO` 에 이미 존재하는 키이므로 테스트 통과가 보장된다.
  - 제안: 이상 없음.

- **[WARNING]** `WORKSPACE_ID_REQUIRED` 에 대한 `translateBackendError` 직접 행동 케이스 부재
  - 위치: `backend-labels.test.ts` `translateBackendError — 직접 단위 테스트` describe 블록
  - 상세: `WORKSPACE_ID_REQUIRED` 가 parity 가드(`LOCALIZED_ERROR_CODES`)에는 추가됐으나, `translateBackendError` 직접 단위 테스트 describe 블록(케이스 (7)(8))에는 포함되지 않았다. chat-channel 5종은 일괄 루프(`CHAT_CHANNEL_CODES` 배열)로 테스트되는데, `WORKSPACE_ID_REQUIRED` 는 해당 배열에서 빠져 있다. 이 코드는 공용 데코레이터 코드임이 명시되어 있어 의도적 생략일 수 있으나, `translateBackendError("WORKSPACE_ID_REQUIRED", undefined, "ko", fallback)` → `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 반환 행동이 검증되지 않는다.
  - 제안: `CHAT_CHANNEL_CODES` 배열에 `WORKSPACE_ID_REQUIRED` 를 포함시키거나, 별도 케이스로 추가하거나, 의도적 제외임을 주석으로 명시.

- **[INFO]** 루프 기반 테스트 패턴의 실패 메시지 가독성
  - 위치: `backend-labels.test.ts` lines 111–127 (diff)
  - 상세: `for (const code of CHAT_CHANNEL_CODES)` 루프 내에서 `expect(translated, code).toBe(...)` 형태로 두 번째 인자에 `code` 를 명시해 실패 시 어떤 코드가 문제인지 식별 가능하다. 격리성도 문제 없다 — 루프가 하나의 `it` 블록 내에서 수행되는 구조이므로 첫 번째 실패 시 나머지도 단락되나, 실패 메시지에 코드명이 포함되어 디버깅에 지장 없다.
  - 제안: 이상 없음. 현재 패턴이 기존 테스트 스타일과 일관성 있음.

- **[INFO]** P3-C-2 parity 가드의 단방향 커버리지 갭 — pre-existing
  - 위치: `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열
  - 상세: `LOCALIZED_ERROR_CODES` 정적 목록은 "추가 시 가드 강제" 는 되지만 "삭제 시 stale 탐지" 는 안 된다. `ERROR_KO` 에서 키를 삭제해도 `LOCALIZED_ERROR_CODES` 에서 삭제하지 않으면 가드가 실패하나(`missing` 배열에 포함됨), 반대로 `LOCALIZED_ERROR_CODES` 에서만 삭제하면 탐지 불가. 이는 pre-existing 기술 부채이며 이번 변경으로 신규 도입된 것은 아님.
  - 제안: `Object.keys(ERROR_KO)` 서브셋 도출 또는 전체 키 parity 검사로 장기 개선 검토. 비차단.

---

### 파일 6: _generator.py (컨테이너 kind 가드 수정)

- **[WARNING]** `resp_param_rows` 컨테이너 kind 가드 로직에 대한 자동화 테스트 없음
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` line 2393–2394 (변경 핵심 로직)
  - 상세: `if kind not in ('obj', 'arr')` 조건 추가로 컨테이너 필드의 cross-map fallback 이 제거됐다. 이 로직에 대한 pytest 등 자동화 단위 테스트가 없어, 향후 `resp_param_rows` 함수 리팩터링 시 회귀를 자동으로 탐지할 수단이 없다. `appstore-orders.md` 의 `order` 필드 수정 결과물이 유일한 정황 증거.
  - 제안: `resp_param_rows` 에 대해 (1) obj/arr kind 필드는 cross-map fallback 미적용, (2) 스칼라 kind 필드는 req/global/variant 에서 설명을 빌려오는 두 케이스의 최소 pytest 케이스 추가. 생성기 특성상 CI 자동 실행이 어렵다면, `_overview.md §7.3` 에 수동 검증 레시피를 기술하는 것이 회귀 방지에 도움. (이 항목은 이전 review Warning#2 에서 동일하게 지적되었고, RESOLUTION.md 에서 docstring 명문화와 `_overview.md §7.3` 수동 레시피 추가로 처리했다고 기록됨 — 자동화 테스트 자체는 여전히 부재.)

- **[INFO]** `_generator.py` 전반 테스트 부재 — pre-existing 기술 부채
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` 전체
  - 상세: `_http_get`, `fetch_entity_json`, `resp_for_op`, `build_tree`, `build_desc_maps` 등 핵심 파싱 함수에 대한 자동화 테스트가 없다. 생성기는 222개 카탈로그 파일의 단일 진실 소스이므로, HTML 구조 가정이 깨지면 대규모 출력 오염이 조용히 발생할 수 있다. 이번 변경에서 신규 도입된 문제는 아님.
  - 제안: `resp_param_rows`, `resp_for_op`, `_json_field_seq` 등 순수 함수 중심 pytest 픽스처 추가 검토. 비차단.

---

### 파일 1, 2, 5, 7: 문서/계획 파일

- **[INFO]** 계획 파일·문서 파일은 직접 테스트 대상 아님. `plan/complete/fix-spec-frontmatter-catalog.md` 의 체크리스트에 unit PASS (444 실패 → 0), e2e PASS (144) 결과가 기록되어 테스트 이행 확인됨.

---

## 요약

이번 변경 set 에서 테스트 측면의 핵심 개선은 `translateBackendError` 직접 단위 테스트 케이스 (7)(8) 추가로, 이전 review Warning#1 을 완전히 해소했다. `WORKSPACE_ID_REQUIRED` 도 `LOCALIZED_ERROR_CODES` parity 가드에 포함되어 INFO#1 도 해소됐다. 그러나 `WORKSPACE_ID_REQUIRED` 자체에 대한 `translateBackendError` 직접 행동 테스트가 누락되어 있어 새로운 소규모 갭이 발생했다(WARNING). `_generator.py` 컨테이너 kind 가드에 대한 자동화 테스트는 여전히 부재하며(WARNING), 이는 이전 review Warning#2 에서 docstring 명문화 + 수동 레시피 추가로 부분 처리됐으나 자동화 회귀 탐지는 미해결 상태다. 전반적으로 i18n 계층의 TypeScript 테스트는 잘 설계되어 있고 이번 변경이 이를 충실히 확장하고 있으나, WORKSPACE_ID_REQUIRED 직접 행동 검증 추가와 generator Python 테스트 부재가 낮은 위험도의 개선 항목으로 남는다.

## 위험도

LOW

STATUS: SUCCESS
