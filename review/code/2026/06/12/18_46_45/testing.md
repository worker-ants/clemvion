# 테스트(Testing) Review

## 발견사항

### 파일 3+4: backend-labels.test.ts + backend-labels.ts (i18n 에러 코드 추가)

- **[INFO]** `translateBackendError` 직접 단위 테스트 케이스 (7)(8)(9) 추가 — RESOLUTION Warning#1 해소 확인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` 라인 464–498
  - 상세: 이전 리뷰(18_01_52)에서 Warning으로 지적된 "chat-channel 에러 코드 직접 단위 테스트 부재"가 RESOLUTION 처리로 케이스 (7)(ko→ERROR_KO 반환) / (8)(en→fallback) / (9)(WORKSPACE_ID_REQUIRED ko 반환) 3건으로 완전히 해소되었다. `CHAT_CHANNEL_CODES` 상수에 7종(5종 + BOT_TOKEN_INVALID + CHAT_CHANNEL_SETUP_FAILED)이 일괄 루프로 커버되어 코드 5종 대표 검증 이상의 커버리지를 제공한다.
  - 제안: 이상 없음.

- **[INFO]** `LOCALIZED_ERROR_CODES` parity guard 에 `WORKSPACE_ID_REQUIRED` 포함 — RESOLUTION INFO#1 해소 확인
  - 위치: 라인 320–322 (`LOCALIZED_ERROR_CODES` 배열)
  - 상세: 이전 리뷰에서 INFO로 지적된 `WORKSPACE_ID_REQUIRED` 누락이 해소되었다. 공용 데코레이터 코드임을 명시하는 주석이 함께 추가되어 의도 명확화도 완료되었다.
  - 제안: 이상 없음.

- **[INFO]** parity guard 와 행동 guard 가 양방향 보호 구조를 갖추었다
  - 위치: 라인 311–342 (P3-C-2 parity guard), 라인 449–498 (translateBackendError 직접 테스트)
  - 상세: P3-C-2 가드는 `ERROR_KO` 키 존재 여부를, 케이스 (7)/(8)/(9)는 실제 함수 반환값을 검증한다. 두 레이어가 함께 동작하여 "코드가 등록되어 있고 올바르게 번역된다"는 양방향 보증이 달성되었다. 기존 SSRF 패턴 (5)/(6)과 동일한 구조로 일관성이 유지된다.
  - 제안: 이상 없음.

- **[INFO]** `LOCALIZED_ERROR_CODES` stale-entry 미탐지 한계는 잔존 — 기존 기술 부채
  - 위치: 라인 311–342
  - 상세: P3-C-2 가드는 "목록 → ERROR_KO 단방향"만 검증하므로, `ERROR_KO`에서 코드를 삭제해도 `LOCALIZED_ERROR_CODES`에 남아 있으면 가드가 실패(인지 가능)하지만, `LOCALIZED_ERROR_CODES`에서만 삭제하면 조용히 통과한다. 이 한계는 이번 변경 이전부터 존재하는 기존 설계이며 본 변경에서 신규 도입된 것은 아니다.
  - 제안: 장기적으로 `Object.keys(ERROR_KO)` 서브셋 도출 또는 전체 키 parity 검사로 개선 검토. 본 변경의 차단 사유 아님.

- **[INFO]** `CHAT_CHANNEL_CODES` 상수가 describe 블록 외부(`it` 사이)에 선언됨
  - 위치: 라인 466–474 (`describe("translateBackendError — 직접 단위 테스트")` 내 `it` 블록 사이)
  - 상세: 상수가 `describe` 블록 내 `it` 호출 사이에 위치해 있어 의미상 `describe` 스코프에 속하나 블록 최상단이 아니다. 실행상 문제는 없다(JavaScript hoisting 아님, `const`이므로 TDZ는 적용되나 it 내부에서는 문제없음). 기존 파일의 상수 선언 위치와 비교 시 약간 비표준적이나 독립 실행에 영향 없다.
  - 제안: 가독성 향상을 위해 `describe` 블록 최상단 또는 기존 `KNOWN_CODE`/`FALLBACK` 상수 근처로 이동하는 것을 권장(LOW). 기능상 차단 사유 아님.

---

### 파일 6: _generator.py (컨테이너 kind 가드 수정)

- **[WARNING]** `resp_param_rows` 컨테이너 kind 가드 로직에 대한 Python 단위 테스트 없음 — RESOLUTION Warning#2에서 docstring+레시피로 처리, 자동화 테스트 미작성
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` 컨테이너 kind 가드 조건 (`if kind not in ('obj', 'arr')`)
  - 상세: RESOLUTION Warning#2 처리 결과가 `resp_param_rows` docstring 명문화 + `_overview.md §7.3` 수동 회귀 검증 레시피 추가로 기록되어 있다. 이는 "테스트 대신 문서화"로 처리한 것으로, 최소 pytest 케이스 작성은 이루어지지 않았다. 수동 레시피가 존재하므로 회귀 발견 경로는 있으나, 자동화 부재로 CI에서 무음 회귀가 발생할 수 있다. 현재 변경이 small focused fix 이고 generator가 CLI 전용이라는 점에서 non-blocking이나 경고 수준으로 기록한다.
  - 제안: `resp_param_rows` 함수에 대해 (1) obj/arr kind 필드는 cross-map fallback 미적용, (2) 스칼라 kind는 fallback 적용하는 최소 pytest 케이스 2건 작성. 또는 현재 선택한 수동 레시피 접근을 유지할 경우 `_overview.md §7.3` 검증 레시피에 구체적인 실행 커맨드와 예상 출력을 추가하여 회귀 발견 가능성을 높인다.

- **[INFO]** `_generator.py` 전체 자동화 테스트 부재 — 기존 기술 부채
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py`
  - 상세: 이전 리뷰에서도 지적된 기존 기술 부채이며 이번 변경에서 신규 도입된 것 아님. `_http_get`, `fetch_entity_json`, `resp_for_op`, `build_tree` 등 핵심 파싱 함수에 자동화 테스트가 없다. 222개 카탈로그 파일의 SoT이므로 테스트 부재 시 HTML 구조 변경이 조용한 대규모 오염을 유발할 수 있다.
  - 제안: 장기 기술 부채로 추적. 순수 함수 중심 pytest 픽스처 추가 검토.

---

### 파일 1: triggers.en.mdx (EN 문서 동반 갱신)

- **[INFO]** EN callout 갱신 — RESOLUTION Warning#3 해소 확인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`
  - 상세: 이전 리뷰에서 Warning으로 지적된 "triggers.en.mdx stale callout" 이 RESOLUTION 처리로 "All codes are shown as localized Korean messages when the interface language is set to Korean." 으로 갱신되었다. KO/EN 문서 일관성이 회복되었다.
  - 제안: 이상 없음. 단, 새로 추가된 `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 두 코드가 EN callout 에도 반영되었는지 확인 필요 — 현재 diff 기준으로 EN callout 에 두 코드가 포함된 것이 확인된다.

---

### 파일 5: plan/complete/fix-spec-frontmatter-catalog.md (plan 문서)

- **[INFO]** 계획 문서이므로 테스트 대상 아님. 체크리스트상 `spec-frontmatter-parse.test.ts` 신규 작성(step 5–7) 및 unit PASS (444 실패 → 0) 기록이 명시되어 있어 적절히 이행됨.

---

## 요약

이번 변경 set 의 테스트 측면에서 핵심 개선사항은 완전하다. 이전 리뷰(18_01_52) Warning 2건 중 Warning#1(`translateBackendError` 직접 단위 테스트 부재)은 케이스 (7)/(8)/(9) 추가로 완전 해소되었고, Warning#3(EN 문서 stale)도 triggers.en.mdx 갱신으로 해소되었다. WORKSPACE_ID_REQUIRED parity guard 포함(INFO#1)도 처리 완료다. Warning#2(_generator.py 테스트 부재)는 docstring+수동 레시피로 처리되어 자동화 테스트 작성은 이루어지지 않았으나, 이는 RESOLUTION에서 명시적으로 선택한 접근이며 non-blocking이다. `backend-labels.test.ts`의 parity guard와 직접 행동 테스트가 양방향 보호 구조를 갖추고 있어 i18n 계층의 테스트 품질은 기존 패턴과 일관되게 유지된다. `CHAT_CHANNEL_CODES` 상수의 선언 위치가 describe 블록 중간부에 있는 것은 가독성 관점의 사소한 개선 항목이나 기능적 문제는 없다.

## 위험도

LOW

STATUS: SUCCESS
