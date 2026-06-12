# 요구사항(Requirement) Review

## 발견사항

### [INFO] 파일 1 — plan/complete/fix-spec-frontmatter-catalog.md

- **[INFO]** 완료 plan 문서 메타데이터 정합성
  - 위치: frontmatter `spec_impact` 필드, 전체 체크리스트
  - 상세: `spec_impact` 에 열거된 두 파일(`spec/conventions/spec-impl-evidence.md`, `spec/conventions/cafe24-api-catalog/_overview.md`)이 실존하며 실제 변경 대상과 일치. 체크리스트 항목 전부 체크됐고, consistency-check / ai-review / test PASS 증거가 기록됨. plan-lifecycle 규약 준수 완전.
  - 제안: 없음.

---

### [INFO] 파일 2 — triggers.mdx (KO) Chat Channel error code callout 문구

- **[INFO]** 문구 변경이 구현 현실을 정확히 반영
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` line 460 (diff 기준)
  - 상세: "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요". 파일 4에서 해당 5종의 `ERROR_KO` 매핑이 완성됐으므로 문서가 구현 상태를 정확히 반영한다. 의도와 구현 일치.
  - 제안: 없음.

---

### [INFO] 파일 1 — triggers.en.mdx (EN) Chat Channel error code callout 문구

- **[INFO]** EN callout 도 정합하게 갱신됨
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` line 447 (diff 기준)
  - 상세: KO 문서 갱신에 동반하여 EN 문서의 "Some codes may currently appear in English in the UI." → "All codes are shown as localized Korean messages when the interface language is set to Korean." 으로 갱신. KO/EN 쌍이 동기화됨.
  - 제안: 없음.

---

### [WARNING] 파일 3/4 — `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 가 ERROR_KO 에 누락

- **[WARNING]** spec §5.4 실패 응답 표에 등재된 `BOT_TOKEN_INVALID`(400) 와 `CHAT_CHANNEL_SETUP_FAILED`(502) 가 `ERROR_KO` 에 없음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` ERROR_KO 객체; `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표
  - 상세: spec §5.4 에는 rotate-bot-token 엔드포인트의 실패 응답으로 총 7개 에러 코드가 명시되어 있다. 이번 변경은 그 중 5종(`INVALID_BOT_TOKEN`, `WORKSPACE_ID_REQUIRED`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)을 ERROR_KO 에 추가했으나 `BOT_TOKEN_INVALID`(setupChannel 401/403 시 반환)와 `CHAT_CHANNEL_SETUP_FAILED`(setupChannel API 호출 실패 502)는 포함하지 않았다. 이 두 코드는 사용자가 실제로 만나는 에러(봇 토큰 회전 실패, 외부 API 장애)이며 `telegram.mdx` / `telegram.en.mdx` 문서에도 사용자 노출 에러로 명시되어 있다(`codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:130`). triggers.mdx 의 callout("한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요")은 이제 명시된 6종에 대해 참이지만, 동일 문서 기준 rotate 흐름에서 실제로 발생하는 `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 는 한국어 안내가 없어 영문 fallback 으로 표시된다. 이는 의도적인 생략일 수 있으나(코드명이 직관적이며 빈도가 낮은 setupChannel 실패) 주석이나 근거가 없어 판단이 불명확하다.
  - 제안: `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 에 대한 ERROR_KO 항목 추가 또는, 의도적 생략이라면 `backend-labels.ts` 주석 또는 `LOCALIZED_ERROR_CODES` 주석에 "setupChannel 실패 코드 — 빈도 낮음, 영문 fallback 수용" 등의 설명 추가.

---

### [INFO] 파일 3 — backend-labels.test.ts `LOCALIZED_ERROR_CODES` `WORKSPACE_ID_REQUIRED` 관련

- **[INFO]** `WORKSPACE_ID_REQUIRED` 가 LOCALIZED_ERROR_CODES 에 추가됐으며 spec §5.4 와 일치
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` LOCALIZED_ERROR_CODES 배열 (diff line ~86)
  - 상세: 이전 리뷰 주기에서 WARNING 으로 지적된 `WORKSPACE_ID_REQUIRED` parity 가드 미포함 이 이번 변경에서 해소됐다. `WORKSPACE_ID_REQUIRED` 는 spec `3-error-handling.md §1.3` canonical 코드이자 spec §5.4 chat-channel 실패 코드 표에 명시된 항목이며, ERROR_KO 에도 이미 존재(`backend-labels.ts:573`)한다. 공용 데코레이터 코드임을 주석으로 명시해 향후 리뷰어 혼동을 방지한 것도 적절하다.
  - 제안: 없음.

---

### [INFO] 파일 3/4 — translateBackendError 직접 단위 테스트 신규 케이스 (7)(8)

- **[INFO]** ko/en 동작 검증 케이스가 정상 추가됨
  - 위치: `backend-labels.test.ts` line 462-487 (diff)
  - 상세: `CHAT_CHANNEL_CODES` 5종 루프로 (7) ko → ERROR_KO 한국어 반환 / (8) en → 영문 fallback 반환 두 케이스 검증. 기존 패턴 (5)(6)과 일관성 유지. `translateBackendError` 의 locale 분기 및 테이블 lookup 동작을 직접 검증하여 기존 parity guard(키 존재만 검증)의 커버리지 갭 해소.
  - 제안: 없음.

---

### [INFO] 파일 4 — backend-labels.ts ERROR_KO 신규 5종 한국어 메시지 spec fidelity

- **[INFO]** 메시지 내용이 spec §5.4 오류 사유와 의미 일치
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 라인 603-612 (commit d8460bda 기준)
  - 상세: spec §5.4 실패 응답 표의 사유 설명과 추가된 한국어 메시지를 대조했을 때 의미가 정확히 대응한다.
    - `INVALID_BOT_TOKEN` (신규 토큰 누락/비-string) → "봇 토큰이 올바르지 않아요. 새 봇 토큰을 입력해 주세요." — 적절.
    - `TRIGGER_NOT_FOUND` (hooks.service.ts:86 — 웹훅 엔드포인트 미존재) → "해당 웹훅 엔드포인트를 찾을 수 없어요." — 영문 SoT "Webhook endpoint not found" 의 충실한 번역, 맥락 일치.
    - `CHAT_CHANNEL_NOT_CONFIGURED` (config.chatChannel 미설정) → "이 트리거에는 채팅 채널이 설정되어 있지 않아요." — 적절.
    - `CHAT_CHANNEL_PROVIDER_UNKNOWN` (registry 미등록 provider) → "알 수 없는 채팅 채널 제공자예요. 지원되는 제공자를 선택해 주세요." — 적절.
    - `CHAT_CHANNEL_ENDPOINT_REQUIRED` (trigger endpointPath 부재) → "채팅 채널 트리거에는 콜백 URL(엔드포인트 경로)이 필요해요." — 적절.
  - 제안: 없음.

---

### [INFO] 파일 5 — spec-sync-chat-channel-gaps.md worktree sentinel 수정

- **[INFO]** `worktree: (unstarted)` 로 정정 — plan-lifecycle 규약 준수
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter line 2
  - 상세: 잘못된 `spec-sync-audit` sentinel 이 `(unstarted)` 로 수정됐다. 실존하지 않는 worktree 를 참조하면 plan_coherence 검출 오염 가능성이 있어 이 수정은 정확하다.
  - 제안: 없음.

---

### [INFO] 파일 6 — _generator.py container cross-map fallback 제한

- **[INFO]** 버그 수정 로직이 의도와 일치
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` (diff 기준 `resp_param_rows` 함수 내 `kind not in ('obj', 'arr')` 조건)
  - 상세: 응답 래퍼 컨테이너(`obj`/`arr`) 가 동일명 스칼라 요청 파라미터의 설명을 잘못 빌려오던 버그를 `kind` 조건 가드로 제한. 수정 로직이 단일 조건으로 명확하며 인라인 주석이 버그 원인을 정확히 설명. 엣지 케이스(컨테이너/스칼라 구분)를 의도대로 처리.
  - 제안: 없음.

---

### [INFO] 파일 7 — appstore-orders.md 생성물 정정

- **[INFO]** generator 수정의 결과가 정확히 반영됨
  - 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`
  - 상세: 응답 래퍼 `order` 필드의 설명이 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬"(잘못 빌려온 쿼리 파라미터 설명) → "(응답 객체)" 로 정정. 파일 6의 수정 의도와 완전 일치.
  - 제안: 없음.

---

## 요약

변경 셋 전체가 의도한 기능을 충실히 구현했다. chat-channel 에러 코드 5종(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)의 `ERROR_KO` 매핑과 P3-C-2 parity 가드 등록이 spec §5.4 와 line-level 로 일치하며, `WORKSPACE_ID_REQUIRED` 도 parity 가드에 추가됐다. triggers.mdx/triggers.en.mdx 의 callout 문구 갱신은 구현 완료를 정확히 반영한다. `_generator.py` 의 컨테이너 fallback 버그 수정과 생성물 정정도 의도-구현 일치. 주목할 미비 1건: spec §5.4 실패 응답 표에 등재된 `BOT_TOKEN_INVALID`(setupChannel 인증 실패 400)와 `CHAT_CHANNEL_SETUP_FAILED`(setupChannel API 호출 실패 502)가 `ERROR_KO` 에 없어 한국어 로케일에서 영문 fallback 으로 표시된다. 이 두 코드는 `telegram.mdx` 에 사용자 노출 에러로 명시된 항목이지만 이번 변경 범위에서 누락됐다. 기능 결함(잘못된 동작)이 아니라 미완성 i18n 범위(graceful fallback 동작)이므로 MEDIUM 이 아닌 WARNING 으로 분류한다.

## 위험도

LOW

STATUS: SUCCESS
