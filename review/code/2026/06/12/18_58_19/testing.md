# 테스트(Testing) Review

## 발견사항

### 파일 3+4: backend-labels.test.ts + backend-labels.ts (i18n 에러 코드 추가)

- **[WARNING]** 이전 리뷰(18_01_52)에서 제기된 `translateBackendError` 직접 단위 테스트 갭이 이번 변경에서 완전히 해소됨
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` `translateBackendError — 직접 단위 테스트` describe 블록 (케이스 (7)(8)(9) 신규 추가)
  - 상세: 이전 WARNING 에서 지적한 "ko → 한국어 반환, en → fallback 반환" 행동 검증 케이스가 chat-channel 7종 일괄 루프(케이스 (7)(8)) + `WORKSPACE_ID_REQUIRED` 단독(케이스 (9)) 형태로 추가되어 기존 (5)/(6) 패턴과 일관성이 맞춰졌다. P3-C-2 parity guard와 직접 행동 guard가 양방향으로 모두 존재하는 이상적인 구조.
  - 제안: 이상 없음. 완전히 해소됨.

- **[INFO]** 케이스 (7)에서 7종 루프로 일괄 테스트하는 방식 — 실패 메시지에 `code` 인자를 명시해 가독성 유지
  - 위치: `backend-labels.test.ts` 케이스 (7)(8), `expect(translated, code).toBe(...)` 패턴
  - 상세: `for...of` 루프로 7개 코드를 순회하면서 실패 시 어느 코드에서 실패했는지 `expect(translated, code)` 의 두 번째 인자로 표시한다. Vitest/Jest 에서 `expect(value, message)` 형식은 실패 메시지로 출력되므로 루프 방식임에도 디버깅 가시성이 충분하다. 양호한 패턴.
  - 제안: 이상 없음.

- **[INFO]** `WORKSPACE_ID_REQUIRED` 가 `LOCALIZED_ERROR_CODES` 배열과 케이스 (9)에 이제 포함됨 — INFO#1 해소
  - 위치: `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열 + 케이스 (9)
  - 상세: 이전 리뷰 INFO#1 에서 지적한 `WORKSPACE_ID_REQUIRED` 누락이 이번 변경에서 해소되었다. `LOCALIZED_ERROR_CODES` 배열에 추가되고 케이스 (9)로 직접 행동 검증도 추가됨. "공용 데코레이터 코드 — chat-channel 전용 아니나 다수 user-facing 엔드포인트에서 노출" 주석도 명시되어 의도가 명확하다.
  - 제안: 이상 없음.

- **[INFO]** `LOCALIZED_ERROR_CODES` 정적 리스트 stale-entry 미탐지 문제는 여전히 잔존 (기존 기술 부채)
  - 위치: `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열 (P3-C-2 describe)
  - 상세: `ERROR_KO` 에서 코드가 삭제될 때 `LOCALIZED_ERROR_CODES` 에서 제거하지 않으면 P3-C-2 가드가 FAIL 하는 방향이지만, 반대로 `LOCALIZED_ERROR_CODES` 에서만 삭제하면 조용히 통과한다. 이번 변경과 무관한 기존 설계 한계이며, 이번 추가(7종 + WORKSPACE_ID_REQUIRED)는 기존 패턴과 일관성을 유지하고 있어 현재 변경 자체의 문제는 아님.
  - 제안: 장기적으로 `Object.keys(ERROR_KO)` 전체를 parity 검증하는 방향으로 전환 시 이 한계가 해소된다. 본 변경 범위 밖의 기술 부채.

### 파일 6: _generator.py (컨테이너 kind 가드 수정)

- **[WARNING]** `resp_param_rows` 컨테이너 kind 가드 로직에 대한 Python 단위 테스트가 여전히 없음
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` `resp_param_rows` 함수 내 `if kind not in ('obj', 'arr')` 조건 (이번 변경 핵심 로직)
  - 상세: 이전 리뷰 WARNING#2에서 지적한 사항이 이번 변경에서도 pytest 추가 없이 `resp_param_rows` docstring 주석 및 `_overview.md §7.3` 수동 회귀 검증 레시피 추가로 대응되었다. 이는 RESOLUTION.md에 "수동 검증 레시피라도 `_overview.md` 에 기술" 이행으로 명시되어 있어 의도적인 trade-off 결정이다. 자동화 테스트 부재는 유지되나 `appstore-orders.md`의 `order` 필드 정정이 구현 증거로 남는다.
  - 제안: 이번 변경 범위 내에서 최선의 대응(docstring + 수동 레시피)이 이루어졌다. 자동화 pytest 추가는 별도 기술 부채 태스크로 추적 권장 (blocking 아님). `spec/conventions/cafe24-api-catalog/_overview.md §7.3` 에 수동 레시피가 기술되어 있는지 검증 권장.

- **[INFO]** `_generator.py` 전반 핵심 파싱 함수 테스트 전무 — 기존 기술 부채
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` 전반
  - 상세: `_http_get`, `fetch_entity_json`, `resp_for_op`, `build_tree`, `build_desc_maps` 등 핵심 함수에 pytest 없음. 이번 변경(단일 조건문 추가)이 신규 도입한 문제가 아닌 pre-existing 기술 부채이며 RESOLUTION.md에도 "비차단 기술 부채"로 분류되어 있음.
  - 제안: 순수 함수 중심 pytest 픽스처 추가 검토 (장기 개선). 이번 변경의 blocking 이슈 아님.

### 파일 1: triggers.mdx / triggers.en.mdx (문서 변경)

- **[INFO]** triggers.en.mdx 의 callout 이 이번 변경에서 동반 갱신됨 — Warning#3 해소
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`
  - 상세: 이전 리뷰 Warning#3에서 지적한 EN callout stale 문제가 이번 변경에서 해소됨. `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 2종도 새로 추가되어 KO/EN 모두 7종 전체가 등재되었으며 "All codes are shown as localized Korean messages when the interface language is set to Korean" 문구로 갱신됨. 테스트 관점에서 문서-구현 정합성이 유지됨.
  - 제안: 이상 없음.

- **[INFO]** `BOT_TOKEN_INVALID` 와 `CHAT_CHANNEL_SETUP_FAILED` 2종이 신규 추가됨 — 테스트 커버리지 확인
  - 위치: `backend-labels.test.ts` `CHAT_CHANNEL_CODES` 배열 + `backend-labels.ts` `ERROR_KO`
  - 상세: 이번 변경에서 이전 리뷰 대비 2종이 추가(`BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)되어 총 7종이 되었다. `CHAT_CHANNEL_CODES` 배열에 포함되어 케이스 (7)(8)의 루프 테스트 범위에 들어간다. `ERROR_KO` 에도 대응 매핑이 추가됨. P3-C-2 `LOCALIZED_ERROR_CODES` 에도 포함되어 3중 검증(parity guard + 행동 guard ko + 행동 guard en)이 완성됨.
  - 제안: 이상 없음.

### 회귀 테스트 (기존 테스트 유효성)

- **[INFO]** 기존 케이스 (1)~(6) 에 영향 없음
  - 상세: 신규 케이스 (7)(8)(9)는 기존 케이스와 독립된 별도 코드 목록(`CHAT_CHANNEL_CODES`)으로 구성되어 있고, 기존 `GRAPH_VALIDATION_FAILED` / `HTTP_BLOCKED` / `DB_HOST_BLOCKED` 테스트에 공유 상태 변경이 없다. `ERROR_KO` 에 키 추가는 기존 매핑을 덮어쓰지 않으므로 기존 테스트가 그대로 유효하다.
  - 제안: 이상 없음.

---

## 요약

이번 변경은 이전 리뷰(18_01_52)에서 지적된 Warning 3건 중 테스트 관련 2건(Warning#1: chat-channel 5종 직접 단위 테스트 부재, Warning#2의 수동 레시피 이행)을 해소하였다. `translateBackendError` 직접 테스트에 chat-channel 7종 일괄 루프(케이스 (7)(8))와 `WORKSPACE_ID_REQUIRED` 단독(케이스 (9))이 추가되어 ko/en 양방향 행동 검증이 완성되었으며, `LOCALIZED_ERROR_CODES` parity guard와의 양방향 보호 구조가 갖춰졌다. `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 2종 신규 추가도 테스트 배열에 빠짐없이 포함되어 있다. `_generator.py` 컨테이너 kind 가드에 대한 자동화 pytest는 여전히 없으나, `_overview.md §7.3` 수동 레시피와 `appstore-orders.md` 결과물이 정황 증거로 제공되어 있고 RESOLUTION.md에 의도적 trade-off로 명시되었다. 전반적으로 TypeScript i18n 계층의 테스트 구조는 이번 변경으로 개선되었으며, `_generator.py` 테스트 전무 문제는 기존 기술 부채로 별도 추적이 필요하나 blocking 사항은 아니다.

## 위험도

LOW

STATUS: SUCCESS
