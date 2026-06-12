# 문서화(Documentation) Review

## 발견사항

### 파일 1 & 2: triggers.mdx / triggers.en.mdx — Chat Channel 에러 코드 Callout

- **[WARNING]** EN callout 이 이전 review(18_01_52) 당시 stale 상태였으나 RESOLUTION 에서 수정 완료됨
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (파일 1)
  - 상세: 이전 review cycle(18_01_52/user_guide_sync.md Warning#3) 에서 `triggers.en.mdx` 동반 갱신 누락이 지적되었고, 현재 diff(파일 1)에서 EN callout 이 "All codes are shown as localized Korean messages when the interface language is set to Korean." 으로 갱신되었다. KO(파일 2)와 EN(파일 1) 이 이제 정합하므로 해소 완료.
  - 추가 확인: EN callout 에 `BOT_TOKEN_INVALID` 와 `CHAT_CHANNEL_SETUP_FAILED` 가 새로 추가됐으나, KO callout 목록과 코드 수가 동일하게 맞춰졌다. 두 파일 모두 8개 코드 (`INVALID_BOT_TOKEN`, `WORKSPACE_ID_REQUIRED`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`) 로 정합.
  - 제안: 이상 없음. 이번 diff 에서 정합 완료.

- **[INFO]** `WORKSPACE_ID_REQUIRED` 가 triggers.mdx callout 에는 없고 triggers.en.mdx 에도 없음
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`, `triggers.en.mdx`
  - 상세: `WORKSPACE_ID_REQUIRED` 는 공용 `@WorkspaceId()` 데코레이터 코드로, chat-channel 경로에서 발생 가능하다. `backend-labels.ts` `ERROR_KO` 에는 매핑이 존재하고 `backend-labels.test.ts` 의 신규 테스트(케이스 9)에서 검증도 추가됐다. 그러나 두 callout 파일(KO/EN) 모두 이 코드를 목록에서 생략하고 있다. 의도적 생략이라면 문서 독자가 이 코드를 chat-channel 흐름에서 만날 수 있음에도 안내가 없다.
  - 제안: chat-channel rotate-bot-token 경로에서 `WORKSPACE_ID_REQUIRED` 가 실제 반환될 수 있는지 확인 후, 반환된다면 두 callout 파일 모두에 추가하거나 "공통 에러 코드는 별도 문서 참조" 안내를 추가. 의도적 생략이라면 주석으로 이유 명시 권장 (INFO).

---

### 파일 3: backend-labels.test.ts — i18n parity guard 확장

- **[INFO]** 인라인 주석이 spec SoT 참조와 노출 컨텍스트를 명확히 제공
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (신규 주석 블록)
  - 상세: 추가된 `WORKSPACE_ID_REQUIRED`, `INVALID_BOT_TOKEN` 등 각 코드 블록에 `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4).`, `// setupChannel(봇 토큰 회전) 실패 코드 (spec §5.4).` 형태의 spec 참조 주석이 달려 있다. 기존 스타일과 일관성 있음.
  - 제안: 이상 없음.

- **[INFO]** 신규 테스트 케이스 설명 문자열이 코드 수를 과거 표현으로 고정
  - 위치: `backend-labels.test.ts` line 116 — `it("(7) ko + chat-channel 에러 코드 5종 → ...")`
  - 상세: 테스트 이름이 "5종" 이라고 명시하나 실제 `CHAT_CHANNEL_CODES` 배열은 7개 코드(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)를 포함하고 있다. 설명 문자열("5종")이 실제 코드 수(7종)와 불일치.
  - 제안: `it("(7) ko + chat-channel 에러 코드 7종 → ...")` 으로 수정 권장 (WARNING 수준).

---

### 파일 4: backend-labels.ts — ERROR_KO 신규 항목

- **[INFO]** 인라인 주석이 spec 참조·영문 SoT 출처를 적절히 제공
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (신규 블록)
  - 상세: `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4 실패 응답).` 와 `// 영문 SoT 는 각 throw-site.` 주석이 함께 있어 양방향 추적 가능. `BOT_TOKEN_INVALID` 에는 `// setupChannel(봇 토큰 회전 등) 실패 — provider 인증 401/403 (spec §5.4).`, `CHAT_CHANNEL_SETUP_FAILED` 에는 `// setupChannel 의 기타 실패(5xx·네트워크 등) → 502 (spec §5.4).` 로 코드별 발생 조건까지 명시됨. 기존 주석 패턴과 일관성 높음.
  - 제안: 이상 없음.

- **[INFO]** `TRIGGER_NOT_FOUND` 한국어 설명의 맥락 범용성
  - 위치: `backend-labels.ts` (TRIGGER_NOT_FOUND 행)
  - 상세: "해당 웹훅 엔드포인트를 찾을 수 없어요." — chat-channel 이외 webhook 공통 경로에서도 이 코드가 재사용될 경우 "웹훅 엔드포인트"라는 구체적 표현이 오해를 줄 수 있음. RESOLUTION 에서 "영문 SoT 가 'Webhook endpoint not found' 이므로 충실한 번역"으로 유지 결정이 이미 내려졌으나, 사용 범위를 주석으로 명시하면 더 명확해진다.
  - 제안: `// chat-channel 및 일반 webhook 경로 공통 — 영문 SoT: hooks.service.ts "Webhook endpoint not found"` 형태의 짧은 주석 추가 고려 (INFO).

---

### 파일 5: plan/in-progress/spec-sync-chat-channel-gaps.md — worktree sentinel 수정

- **[INFO]** frontmatter `worktree` 값 정정
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter
  - 상세: `worktree: spec-sync-audit` → `worktree: (unstarted)` 로 수정. plan-lifecycle 규약(`.claude/docs/plan-lifecycle.md §39`)의 미착수 sentinel 에 부합하는 올바른 정정. 잘못된 worktree 이름이 plan_coherence 자동 검사에서 오탐을 일으킬 수 있었으므로 수정이 타당.
  - 제안: 이상 없음.

---

### 파일 6: plan/in-progress/cafe24-backlog-residual.md — G-4 항목 추가

- **[INFO]** 신규 backlog 항목 G-4 문서화 수준 양호
  - 위치: `plan/in-progress/cafe24-backlog-residual.md` (G-4 섹션)
  - 상세: generator `resp_param_rows` 버그 수정 출처(`_overview.md §7.3`), 완료/잔여 항목 체크리스트, 재생성 방법(HTML+네트워크 필요) 이 모두 기술되어 있다. 잔여 항목(`links` 등 다른 충돌명)에 대해 false-positive 위험과 재생성 후 전체 커밋 포함 확인 의무도 명시됨.
  - 제안: 이상 없음.

---

### 파일 7: plan/complete/fix-spec-frontmatter-catalog.md — spec_impact 필드

- **[INFO]** `spec_impact` frontmatter 필드가 plan-lifecycle 스키마에 미정의
  - 위치: `plan/complete/fix-spec-frontmatter-catalog.md` frontmatter
  - 상세: `spec_impact` 키가 이 파일에 처음 등장하나, `/Volumes/project/private/clemvion/.claude/docs/plan-lifecycle.md` 에 해당 필드의 필수/선택 여부가 정의되어 있지 않다. 선택적 필드라면 무방하나 미정의 상태이면 다른 plan 파일 작성자가 이 필드를 추가할 기준을 알 수 없다.
  - 제안: `plan-lifecycle.md` 에 `spec_impact` 가 선택 필드임과 사용 가이드(spec 파일 경로 목록)를 한 줄 추가 권장 (INFO).

---

### 파일 8 & 9: review/code/2026/06/12/18_01_52/RESOLUTION.md & SUMMARY.md — 리뷰 산출물

- **[INFO]** RESOLUTION.md 가 WARNING 전부 해소 및 INFO disposition 근거를 명확히 기록
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-followups-residual-1be5d3/review/code/2026/06/12/18_01_52/RESOLUTION.md`
  - 상세: Warning 3건 해소 내역, INFO 각각의 유지/fix/비차단 결정과 이유가 테이블 형태로 명시됨. consistency-check 후속 결과와 TEST 결과도 포함되어 리뷰 산출물로서 완결성이 높음.
  - 제안: 이상 없음.

---

## 요약

이번 변경 set 은 chat-channel 에러 코드 i18n 매핑 추가, KO/EN 유저 가이드 callout 동기화, generator 버그 수정, plan 메타데이터 정정으로 구성된다. 문서화 관점의 전체 품질은 양호하다. `backend-labels.ts` 의 인라인 주석이 spec 참조·영문 SoT 출처까지 명시하고 있고, `backend-labels.test.ts` 의 신규 테스트 케이스에도 spec §5.4 참조 주석이 달려 있어 유지보수자가 근거를 추적하기 쉽다. EN/KO triggers 문서의 callout 동기화도 이번 diff 에서 완료됐다. 주목할 미비는 하나로, `backend-labels.test.ts` 테스트 이름(케이스 (7))이 "5종"이라고 명시하지만 실제 배열은 7개 코드를 포함하고 있어 설명 문자열이 코드 현실과 불일치한다는 점이다. 이는 빠른 수정이 가능한 WARNING 수준 항목이다. `WORKSPACE_ID_REQUIRED` 의 callout 미포함, `TRIGGER_NOT_FOUND` 번역 사용 범위 주석 부재, `spec_impact` 필드 스키마 미정의는 모두 INFO 수준으로 기능적 결함은 없다.

## 위험도

LOW

STATUS: SUCCESS
