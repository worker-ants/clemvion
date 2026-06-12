# 문서화(Documentation) Review

## 발견사항

### 파일 1·2: triggers.mdx(KO) / triggers.en.mdx(EN) — Chat Channel error code callout

- **[INFO]** KO·EN callout 내용 일치 확인 완료
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (line 458) / `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (line 436)
  - 상세: KO callout 에 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 2코드가 추가되었고, EN callout 도 동반 갱신되어 동일 코드 목록을 포함. 기존 SUMMARY Warning#3(EN 동반 갱신 누락)이 이미 해소됨. "All codes are shown as localized Korean messages when the interface language is set to Korean." 문구는 `backend-labels.ts` `ERROR_KO` 실제 등록 현황과 일치.
  - 제안: 이상 없음.

- **[INFO]** `WORKSPACE_ID_REQUIRED` callout 목록 미포함
  - 위치: `triggers.mdx` callout (line 458) / `triggers.en.mdx` callout (line 436)
  - 상세: `WORKSPACE_ID_REQUIRED` 는 `ERROR_KO` 에 이미 등록되어 있고(한국어 번역 존재) chat-channel API 가 반환할 수 있으나 callout 목록에 없다. `backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 에는 이번 변경에서 추가됐으나(test 파일 diff line 85–86) 사용자 문서(mdx)에는 반영이 없다. 공용 데코레이터 코드이므로 의도적 생략일 수 있지만 문서에 근거가 없다.
  - 제안: chat-channel 흐름에서 실제 반환 가능한지 확인 후, 포함하거나 "공용 에러 코드(`WORKSPACE_ID_REQUIRED` 등)는 별도 참조" 안내를 추가하는 것을 권장(INFO).

---

### 파일 3: backend-labels.test.ts — i18n parity guard + translateBackendError 테스트 확장

- **[INFO]** 인라인 주석이 spec SoT 를 명확히 연결
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` lines 83–96 (diff 기준)
  - 상세: 추가된 chat-channel 에러 코드 블록에 `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4).` 와 노출 컨텍스트 설명, 코드별 근거가 달려 있어 유지보수자가 spec 근거를 즉시 추적할 수 있다. `WORKSPACE_ID_REQUIRED` 에는 "공용 @WorkspaceId() 데코레이터 코드 — chat-channel 전용 아니나 다수 user-facing 엔드포인트에서 노출되고 triggers 안내에도 등재" 설명 포함. 기존 SSRF 코드 블록 주석 패턴과 일관됨.
  - 제안: 이상 없음.

- **[INFO]** 신규 테스트 케이스 (7)(8)(9) 설명 블록의 위치 관계 주석 가독성
  - 위치: `backend-labels.test.ts` lines 104–106 (diff 기준) — `CHAT_CHANNEL_CODES` 배열 선언 앞 블록 주석
  - 상세: 주석이 `CHAT_CHANNEL_CODES` 배열과 세 개 `it()` 블록을 일괄 설명하는 형태로, spec 참조·출처·검증 의도가 모두 포함되어 있다. 다만 주석이 배열 선언 바로 앞에 있어 첫 번째 `it()` 와의 시각적 연결이 끊긴다. 기능상 문제 없음.
  - 제안: 필요 시 `describe` 블록으로 묶어 주석을 `describe` 헤딩으로 옮기는 것을 장기 개선으로 고려(INFO).

---

### 파일 4: backend-labels.ts — ERROR_KO 신규 항목

- **[INFO]** 인라인 주석이 spec 참조·사용 컨텍스트·영문 SoT 출처를 모두 포함
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` lines 160–161, 172–173, 175–176 (diff 기준)
  - 상세: `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4 실패 응답).` + 노출 시점 + `// 영문 SoT 는 각 throw-site.` 가 포함되어 추적 가능성이 높다. `BOT_TOKEN_INVALID` 에는 provider 인증 HTTP status(401/403) 까지 명시. 기존 CODE/SSRF 블록 주석 패턴과 일치.
  - 제안: 이상 없음.

- **[INFO]** `TRIGGER_NOT_FOUND` 한국어 설명이 chat-channel 맥락 편향
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` line 165 (diff 기준)
  - 상세: `"해당 웹훅 엔드포인트를 찾을 수 없어요."` — 코드명은 트리거 레벨이나 번역은 "웹훅 엔드포인트" 로 구체화. 현재 사용 범위(chat-channel inbound) 에서는 정확하나, 코드가 다른 경로에서도 반환된다면 번역이 오해를 줄 가능성. 기능 결함 없음.
  - 제안: 주석으로 "chat-channel 및 hooks webhook inbound 경로 전용" 사용 범위 명시하거나, 차후 "해당 트리거를 찾을 수 없어요." 처럼 더 중립적 표현 교체 검토(INFO).

---

### 파일 5: plan/complete/fix-spec-frontmatter-catalog.md

- **[INFO]** `spec_impact` frontmatter 필드 — plan-lifecycle.md 에 필드 정의 부재
  - 위치: `/Volumes/project/private/clemvion/plan/complete/fix-spec-frontmatter-catalog.md` frontmatter lines 4–6
  - 상세: `spec_impact` 는 이 파일에서 처음 등장하는 선택 필드로 보이나, CLAUDE.md 또는 `.claude/docs/plan-lifecycle.md` 의 plan frontmatter 스키마 정의에 해당 필드 설명이 없다. 자동화 스크립트가 해당 필드를 파싱한다면 예기치 않은 동작이 발생할 수 있다.
  - 제안: `.claude/docs/plan-lifecycle.md` 의 frontmatter 스키마 절에 `spec_impact` (optional, list of spec file paths) 설명 한 줄 추가 권장(INFO).

- **[INFO]** `## 후속` 절의 비차단 항목들이 별도 plan 링크 없이 기술됨
  - 위치: `/Volumes/project/private/clemvion/plan/complete/fix-spec-frontmatter-catalog.md` lines 239–244
  - 상세: WARNING#1·#2, INFO#2·#4 네 항목이 비차단으로 기록됐으나 어느 plan 파일에서 추적되는지 링크가 없다. plan 을 complete/ 로 이동 후 후속 항목이 in-progress/ 어느 파일에 녹아들었는지 추적이 어렵다.
  - 제안: 각 비차단 항목에 `(→ plan/in-progress/xxx.md)` 형태의 단순 링크 추가 권장(INFO).

---

### 파일 6: plan/in-progress/cafe24-backlog-residual.md

- **[INFO]** G-4 항목 추가 — 문서화 품질 양호
  - 위치: `/Volumes/project/private/clemvion/plan/in-progress/cafe24-backlog-residual.md` lines 317–323 (diff 기준)
  - 상세: 새 G-4 섹션에 출처(날짜·파일·절), 버그 요약, 완료 체크박스, 잔여 작업 scope 및 재생성 조건이 명확히 기술됨. `_overview.md §7.3` cross-link 포함. 리더가 맥락을 재구성하기 충분하다.
  - 제안: 이상 없음.

---

### 파일 7: plan/in-progress/spec-sync-chat-channel-gaps.md

- **[INFO]** `worktree: (unstarted)` 비표준 값 — plan-lifecycle 스키마에 정의 필요
  - 위치: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter line 2
  - 상세: `worktree: spec-sync-audit` 에서 `worktree: (unstarted)` 로 정정. 의미상 명확하나 `(unstarted)` 는 비표준 문자열로 기계 파싱 시 실제 worktree 디렉토리명으로 오인될 가능성이 있다. `.claude/docs/plan-lifecycle.md` 또는 `plan-lifecycle.md` frontmatter 스키마에 미착수 표기 방식이 정의되어 있지 않으면 일관성이 없다.
  - 제안: plan-lifecycle 스키마에 미착수 상태 표기 규약(`worktree: null` 또는 필드 생략, 또는 현재 `(unstarted)` 를 공식 표준으로 명문화)을 추가 권장(INFO).

---

### 파일 8·9: RESOLUTION.md / SUMMARY.md

- **[INFO]** RESOLUTION.md 가 Warning 전부 해소 + INFO dispositions 를 명시적으로 기록
  - 위치: `/Volumes/project/private/clemvion/review/code/2026/06/12/18_01_52/RESOLUTION.md`
  - 상세: Warning 3건 → fix 여부·위치·방법이 표 형식으로 명시됨. INFO 각 항목의 처리 결정(fix/유지/비차단/기록)과 근거가 서술됨. scope 리뷰 누락 사유와 비차단 판단 근거도 포함. 리뷰 산출물로서 완결성이 높다.
  - 제안: 이상 없음.

- **[INFO]** SUMMARY.md 의 `documentation` 에이전트 핵심 발견이 `resp_param_rows` docstring 미반영·WORKSPACE_ID_REQUIRED 주석 부재로 정리됨 — 이번 리뷰에서 두 항목 모두 WARNING 수준에서 INFO 로 재확인(이전 사이클 기준 문서화 영역 위험도 LOW).

---

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. chat-channel 에러 코드 i18n 추가(`backend-labels.ts`)는 spec 참조·노출 컨텍스트·영문 SoT 출처를 인라인 주석으로 충실히 기술하고 있으며, KO/EN `triggers.mdx` callout 이 동기화되어 사용자 문서와 구현 간 일관성이 확보됐다. `backend-labels.test.ts` 의 테스트 케이스 주석도 spec 절 참조를 포함해 추적 가능성이 높다. 개선이 필요한 부분은 두 가지다: (1) `resp_param_rows` 함수 docstring 에 컨테이너 제외 규칙이 반영되지 않았으며(기존 SUMMARY INFO#6, Warning#2 처리에서 일부 해소 언급됐으나 실제 diff 에서 docstring 변경이 확인되지 않음), (2) `spec_impact` frontmatter 필드 및 `worktree: (unstarted)` 표기가 plan-lifecycle.md 스키마에 정의되지 않아 표준화가 필요하다. `WORKSPACE_ID_REQUIRED` 의 triggers.mdx callout 미기재는 공용 코드라는 의도적 생략으로 보이나 근거 주석이 없어 차후 혼동 가능성이 남는다. 심각한 문서화 결함은 없으며 전체 발견사항은 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
