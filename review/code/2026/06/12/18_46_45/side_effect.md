# 부작용(Side Effect) Review

## 발견사항

### 파일 1: triggers.en.mdx — Chat Channel 에러 코드 Callout 갱신

- **[INFO]** 문서 텍스트 전용 변경 — 런타임 부작용 없음
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` Chat Channel Callout 섹션
  - 상세: "Some codes may currently appear in English in the UI." → "All codes are shown as localized Korean messages when the interface language is set to Korean." 으로 갱신. 정적 MDX 문서 텍스트 변경이며 런타임 상태·API·이벤트에 영향 없음. 이전 리뷰 라운드에서 WARNING 으로 지적된 EN callout stale 상태가 이번 변경으로 해소됨.
  - 제안: 부작용 없음.

---

### 파일 2: triggers.mdx — 동일 패턴 KO 파일 (이전 라운드 변경, 참조)

- **[INFO]** BOT_TOKEN_INVALID, CHAT_CHANNEL_SETUP_FAILED 두 코드가 신규 추가됨
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` Chat Channel 에러 코드 목록
  - 상세: 이전 라운드에서 추가된 5종에 더해 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 두 코드가 callout 목록에 추가됨. 문서 변경만이므로 런타임 부작용 없음. `backend-labels.ts ERROR_KO` 에 이 두 코드의 한국어 매핑이 동반 추가되어 있으므로 실제 누락 없음.
  - 제안: 부작용 없음.

---

### 파일 3: backend-labels.test.ts — translateBackendError 직접 단위 테스트 추가

- **[INFO]** CHAT_CHANNEL_CODES 배열 및 테스트 케이스 (7)(8)(9) 신규 추가
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` describe "translateBackendError — 직접 단위 테스트" 블록 끝
  - 상세: 테스트 파일에 모듈 레벨 상수 `CHAT_CHANNEL_CODES`(배열)가 `describe` 블록 외부에 선언됨. describe 내부 `it()` 에서만 참조되므로 다른 테스트 블록에 노출되지 않으나, 모듈 레벨 선언이라는 점에서 파일 내 전역 스코프에 존재한다. 테스트 환경에서 이는 일반적인 패턴이며 런타임 전역 상태 오염이 아님.
  - 추가 검증: `LOCALIZED_ERROR_CODES` 배열에 `WORKSPACE_ID_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 가 추가됨. 이 배열은 P3-C-2 parity guard 테스트에서만 사용되며 `ERROR_KO` 에 해당 키가 존재하는지 검증한다. 추가된 코드 모두 `ERROR_KO` 에 매핑이 존재하므로 기존에 통과하던 테스트가 새로 실패하는 경우 없음.
  - 제안: 부작용 없음.

---

### 파일 4: backend-labels.ts — ERROR_KO 신규 항목 추가

- **[INFO]** ERROR_KO export const 객체에 7개 키-값 쌍 추가
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 객체 말미
  - 상세: `INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 7개 항목 추가. 기존 키를 덮어쓰지 않으므로 기존 매핑에 부작용 없음.
  - 상태 변경 검토: `translateBackendError` 함수 시그니처 및 구현은 변경되지 않음. 이 함수가 이전에 `fallback` 을 반환하던 위 7개 에러 코드에 대해 이제 한국어 메시지를 반환하게 되는 동작 변경이 발생함. 이는 의도된 부작용이며 명시된 요구사항이다.

- **[WARNING]** TRIGGER_NOT_FOUND 한국어 번역의 맥락 범용성 — 재사용 시 의미 오해 가능성
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` `TRIGGER_NOT_FOUND` 항목
  - 상세: 번역값 "해당 웹훅 엔드포인트를 찾을 수 없어요." 는 chat-channel 맥락에서는 정확하나, `TRIGGER_NOT_FOUND` 코드가 chat-channel 외 다른 webhook 트리거 경로(`hooks.service.ts`)에서도 공통으로 사용되는 경우 "웹훅 엔드포인트" 표현이 실제 오류 원인("트리거를 찾을 수 없음")보다 구체적이어서 맥락 이탈 시 부정확한 안내를 제공할 수 있다. 현재 이 코드가 `ERROR_KO` 에 등재된 이상 chat-channel 외 경로에서도 동일 한국어 메시지가 사용됨.
  - 제안: `TRIGGER_NOT_FOUND` 코드의 사용 범위를 확인하여, chat-channel 전용이 아닌 경우 "해당 트리거를 찾을 수 없어요." 와 같이 더 중립적인 표현으로 교체하거나 사용 범위를 주석으로 명시할 것을 권장.

---

### 파일 5: plan/complete/fix-spec-frontmatter-catalog.md — 신규 plan 파일

- **[INFO]** plan frontmatter에 spec_impact 신규 필드 추가
  - 위치: `plan/complete/fix-spec-frontmatter-catalog.md` frontmatter
  - 상세: `spec_impact` 필드는 이 plan 파일 외에 신규 도입. plan lifecycle 파서 또는 자동화 스크립트가 이 필드를 처리하는 경우, 기존 plan 파일(해당 필드 없음)과의 불일치가 발생할 수 있다. 단, 파서가 미지 필드에 관대한 경우(일반적) 부작용 없음.
  - 제안: 부작용 위험은 낮으나, `spec_impact` 가 선택(optional) 필드임을 `plan-lifecycle.md` 에 명시하면 자동화 도구 작성 시 혼란을 방지할 수 있다.

---

### 파일 6: plan/in-progress/spec-sync-chat-channel-gaps.md — worktree 필드 수정

- **[INFO]** worktree: spec-sync-audit → (unstarted) 변경
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter
  - 상세: plan lifecycle 처리 스크립트나 훅이 `worktree` 값으로 실제 git worktree 존재를 검증하는 경우, `spec-sync-audit` worktree 가 이미 삭제된 이후 이 수정은 자동화 스크립트의 오류를 방지하는 올바른 정리다. 변경 전 상태(`spec-sync-audit`)가 오히려 잘못된 참조를 유발할 수 있었으므로 이 수정은 의도치 않은 부작용을 제거하는 긍정적 변경이다.
  - 제안: 부작용 없음.

---

### 파일 7: review/ 하위 산출물 파일 (RESOLUTION.md, SUMMARY.md, _retry_state.json, 각 reviewer .md, meta.json 등)

- **[INFO]** 리뷰 산출물 파일 일괄 추가 — 파일시스템 부작용 의도된 범위
  - 위치: `review/code/2026/06/12/18_01_52/` 및 `review/consistency/2026/06/12/18_18_36/` 하위
  - 상세: 이 파일들은 AI 리뷰 워크플로의 산출물로, `review/` 디렉토리에 타임스탬프 경로로 생성되는 것이 규약상 의도된 동작이다. 런타임 상태나 애플리케이션 로직에 영향 없음.
  - 제안: 부작용 없음.

---

### 파일 8: plan/in-progress/cafe24-backlog-residual.md — G-4 항목 추가

- **[INFO]** backlog 추적 항목 추가 — 문서 변경만
  - 위치: `plan/in-progress/cafe24-backlog-residual.md` 말미
  - 상세: generator 재생성 대상 잔여 파일에 대한 backlog 노트 추가. 런타임 부작용 없음. 잔여 카탈로그 파일(`links` 등 다른 충돌명 보유 파일)이 현재 커밋에 포함되지 않고 재생성 시 자동 정정 대상으로 남겨진 점이 명시됨.
  - 제안: 부작용 없음.

---

## 요약

이번 변경 set 은 chat-channel 에러 코드 i18n 매핑 확장(backend-labels.ts/test.ts), 문서 현행화(triggers.mdx/en.mdx), cafe24 카탈로그 generator 버그 수정, plan 문서 메타데이터 정리로 구성된다. 의도치 않은 부작용 관점에서 가장 주목할 항목은 `TRIGGER_NOT_FOUND` 한국어 번역이 chat-channel 전용이 아닌 경로에서 재사용될 때 "웹훅 엔드포인트" 표현이 맥락 이탈을 유발할 수 있다는 점이다(WARNING). ERROR_KO 에 등재된 이상 해당 코드를 반환하는 모든 경로에 동일 번역이 적용되므로 범위 검증이 필요하다. 나머지 변경은 기존 상태를 덮어쓰거나 잘못된 참조를 제거하는 방향이며 의도하지 않은 상태 변경·전역 변수·파일시스템·시그니처·API·환경 변수·네트워크·이벤트 부작용은 발견되지 않는다.

## 위험도

LOW

STATUS: SUCCESS
