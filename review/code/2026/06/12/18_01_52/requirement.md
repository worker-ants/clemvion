# 요구사항(Requirement) Review

## 발견사항

### [INFO] 파일 1 — plan/complete/fix-spec-frontmatter-catalog.md
- 위치: frontmatter `spec_impact` 필드
- 상세: `spec_impact` 에 `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/cafe24-api-catalog/_overview.md` 두 파일이 등재돼 있다. plan-lifecycle §Gate C 규약상 완료 plan 의 `spec_impact` 는 실존 spec 파일이어야 하며, 두 경로 모두 실존하는 파일이다. 체크리스트 항목 전부 체크됐고, 워크플로우 수행 증거(consistency-check, ai-review, test pass 결과)가 모두 기록돼 있다. 규약 준수 완전.
- 제안: 없음.

---

### [INFO] 파일 2 — triggers.mdx (Chat Channel error code callout 문구 변경)
- 위치: line 460 (변경 후 `triggers.mdx:633`)
- 상세: 기존 문구 "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요" 로 변경. 변경의 근거는 파일 3·4에서 해당 error code 5종의 `ERROR_KO` 매핑이 완성됐다는 사실이다. 문서 변경이 구현 상태를 정확히 반영하며 의도와 구현이 일치한다.
- 제안: 없음.

---

### [WARNING] 파일 3·4 — `WORKSPACE_ID_REQUIRED` 가 test `LOCALIZED_ERROR_CODES` 에 없음
- 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열
- 상세: spec/5-system/15-chat-channel.md §5.4 실패 응답 표에는 `WORKSPACE_ID_REQUIRED` 가 chat-channel rotate-bot-token 경로의 user-facing error code 로 명시돼 있다. `backend-labels.ts` 의 `ERROR_KO` 에는 이미 `WORKSPACE_ID_REQUIRED` 매핑이 존재하지만 (`codebase/frontend/src/lib/i18n/backend-labels.ts:573`), 이번 변경에서 추가된 `backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 배열에는 `WORKSPACE_ID_REQUIRED` 가 포함되지 않았다. spec §5.4 는 `WORKSPACE_ID_REQUIRED` 를 `INVALID_BOT_TOKEN` / `CHAT_CHANNEL_NOT_CONFIGURED` / `CHAT_CHANNEL_PROVIDER_UNKNOWN` / `CHAT_CHANNEL_ENDPOINT_REQUIRED` 와 동열의 chat-channel 실패 코드로 기술하고, triggers.mdx 의 error code 목록에도 `WORKSPACE_ID_REQUIRED` 가 포함돼 있다. P3-C-2 가드의 목적은 user-facing 등록 코드가 `ERROR_KO` 에 매핑됐음을 보장하는 것인데, `WORKSPACE_ID_REQUIRED` 가 `LOCALIZED_ERROR_CODES` 에 없으면 미래에 `ERROR_KO` 에서 해당 항목이 삭제되더라도 가드가 감지하지 못한다. 다만 `WORKSPACE_ID_REQUIRED` 는 chat-channel 한정 코드가 아니라 범용 공유 코드(canonical, `3-error-handling.md §1.3`)라는 점에서 이 누락이 의도적일 수 있다.
- 제안: chat-channel 신규 5종과 일관되게 `WORKSPACE_ID_REQUIRED` 도 `LOCALIZED_ERROR_CODES` 에 추가하는 것을 검토한다. 이미 `ERROR_KO` 에 존재하므로 테스트 실패는 없겠지만, 범위 명시성이 향상된다.

---

### [INFO] 파일 3 — `backend-labels.test.ts` 신규 error code 5종 spec 참조 정확성
- 위치: `backend-labels.test.ts` line 666 주석 `spec/5-system/15-chat-channel.md §5.4`
- 상세: spec §5.4 실패 응답 표의 코드 집합(`INVALID_BOT_TOKEN`, `WORKSPACE_ID_REQUIRED`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)과 test에 추가된 5종이 정확히 대응한다. `WORKSPACE_ID_REQUIRED` 1종 미포함은 위 WARNING 에서 다뤘다.

---

### [INFO] 파일 4 — `backend-labels.ts` 신규 5종 Korean 메시지 품질
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` lines 1779-1788
- 상세: 추가된 5종 Korean 메시지 각각이 spec §5.4 에 기술된 오류 사유와 의미 일치한다. `TRIGGER_NOT_FOUND` 의 한국어 메시지("해당 웹훅 엔드포인트를 찾을 수 없어요")는 spec §5.4 에서 해당 코드가 `rotate-bot-token` 경로에 없고 hooks 경로 (`TRIGGER_NOT_FOUND`, hooks.service.ts:86) 에서 사용됨을 고려할 때 의미상 맞다. triggers.mdx의 error code 목록에도 `TRIGGER_NOT_FOUND`가 포함돼 있으므로 user-facing 등록이 타당하다.

---

### [INFO] 파일 5 — plan/in-progress/spec-sync-chat-channel-gaps.md `worktree` sentinel 변경
- 위치: frontmatter `worktree` 필드
- 상세: `worktree: spec-sync-audit` → `worktree: (unstarted)` 로 변경. `.claude/docs/plan-lifecycle.md §39` 에 따르면 미착수 plan 은 sentinel `(unstarted)` 를 사용해야 하며, 잘못된 worktree 이름이 있으면 `plan_coherence` 충돌 검출을 오염시킨다. 변경이 규약에 완전히 부합한다.

---

### [INFO] 파일 6 — `_generator.py` container field cross-map fallback 제한
- 위치: `spec/conventions/cafe24-api-catalog/_generator.py` line 2006-2007 (패치 기준)
- 상세: `obj`/`arr` 타입 컨테이너 필드가 scalar parameter 설명을 잘못 빌려오는 버그 수정 (예: 응답 래퍼 `order` 가 정렬 쿼리 파라미터 `order`의 "정렬 순서 asc…" 설명을 가져오던 현상). 로직이 주석과 일치하고, 엣지 케이스(`kind not in ('obj', 'arr')` 조건)가 정확히 의도를 구현한다.

---

### [INFO] 파일 7 — `appstore-orders.md` 생성물 변경
- 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` lines 2527/2535
- 상세: `_generator.py` 수정의 직접 결과로 응답 파라미터 `order` 필드의 설명이 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" (쿼리 파라미터에서 잘못 빌려온 값) → "(응답 객체)" 로 정정됐다. 파일 6의 수정 의도와 완전히 일치한다.

---

## 요약

7개 파일 변경 전체에 걸쳐 의도한 기능이 충실히 구현돼 있다. chat-channel error code 5종(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)의 `ERROR_KO` 매핑과 P3-C-2 parity 가드 등록이 spec/5-system/15-chat-channel.md §5.4 와 line-level 로 일치한다. triggers.mdx 의 사용자 안내 문구 변경은 실제 구현 완료를 정확히 반영한다. `_generator.py`의 container fallback 버그 수정과 생성물 정정도 의도와 구현이 일치한다. 주목할 소규모 미비는 `WORKSPACE_ID_REQUIRED` 가 triggers.mdx 의 error code 목록에 포함돼 있고 spec §5.4 에도 chat-channel 실패 코드로 등재돼 있음에도 test `LOCALIZED_ERROR_CODES` 에 누락된 점이며, 이는 이미 `ERROR_KO` 매핑이 존재해 기능 결함은 아니지만 향후 가드 커버리지의 완전성을 위해 추가를 권장한다.

## 위험도

LOW
