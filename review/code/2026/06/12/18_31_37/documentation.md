# 문서화(Documentation) Review

## 발견사항

### 파일 1 & 2: triggers.mdx / triggers.en.mdx — Chat Channel error code callout

- **[INFO]** KO/EN callout 동기 완료 — 사실 정확성 향상
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (KO), `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (EN)
  - 상세: KO callout 이 "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요"로 갱신됐고, EN callout 도 "Some codes may currently appear in English in the UI" → "All codes are shown as localized Korean messages when the interface language is set to Korean"으로 동반 갱신됐다. 이전 review(18_01_52) 에서 WARNING#3으로 지적된 EN 갱신 누락이 이번 변경 세트에서 해소됐다.
  - 제안: 이상 없음. 양 언어 파일이 일관성을 갖추었다.

- **[INFO]** `WORKSPACE_ID_REQUIRED` 코드가 callout 목록에 없음
  - 위치: `triggers.mdx` 및 `triggers.en.mdx` Chat Channel error code callout
  - 상세: 이 코드는 공용 `@WorkspaceId()` 데코레이터에서 발생하며 chat-channel 전용이 아니다. `backend-labels.test.ts`의 `LOCALIZED_ERROR_CODES` 주석에 "공용 @WorkspaceId() 데코레이터 코드 — chat-channel 전용 아니나 다수 user-facing 엔드포인트에서 노출되고 triggers 안내에도 등재 (spec §1.3 canonical)"라고 명시돼 있어 의도적 분리임을 확인할 수 있으나, callout 문서 자체에는 이 맥락 설명이 없다. 문서 독자가 chat-channel 흐름에서 이 코드를 받을 수 있으나 목록에 없어 혼란 가능성이 남는다.
  - 제안: callout 끝에 "공용 인증 오류(`WORKSPACE_ID_REQUIRED` 등)는 별도 공통 에러 코드 문서를 참조하세요" 형태의 한 줄 안내를 추가하거나, 해당 코드를 목록에 포함하는 방향 검토(INFO 수준).

---

### 파일 3: backend-labels.test.ts — i18n parity guard 확장

- **[INFO]** 인라인 주석이 spec SoT 참조를 명확히 제공
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` lines 83–93 (diff hunk)
  - 상세: 추가된 `WORKSPACE_ID_REQUIRED` 항목에 "공용 @WorkspaceId() 데코레이터 코드 — chat-channel 전용 아니나 다수 user-facing 엔드포인트에서 노출되고 triggers 안내에도 등재 (spec §1.3 canonical)" 주석이 달렸다. chat-channel 에러 코드 5종 블록에도 `spec/5-system/15-chat-channel.md §5.4` 참조와 노출 컨텍스트 설명이 포함되어 있다. 기존 SSRF·CODE 블록 주석 스타일과 일관성이 유지됨.
  - 제안: 이상 없음.

- **[INFO]** `translateBackendError` 직접 단위 테스트 케이스 (7)(8) 추가
  - 위치: `backend-labels.test.ts` `describe("translateBackendError — 직접 단위 테스트")` 블록
  - 상세: 이전 review(18_01_52) WARNING#1이었던 chat-channel 5종 동작 검증 부재가 (7)(ko→ERROR_KO) / (8)(en→fallback) 루프 케이스 추가로 해소됐다. 테스트 상단 주석이 검증 의도와 spec 참조를 명확히 서술하고 있어 문서화 관점에서 양호하다.
  - 제안: 이상 없음.

---

### 파일 4: backend-labels.ts — ERROR_KO 신규 항목

- **[INFO]** 인라인 주석이 spec 참조와 노출 컨텍스트를 적절히 제공
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (diff hunk lines 147–159)
  - 상세: `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4 실패 응답).` 와 사용자 노출 시점 설명, 영문 SoT 출처(`// 영문 SoT 는 각 throw-site.`) 까지 명시돼 있어 양방향 추적이 가능하다. 파일 내 기존 그룹 주석 패턴(SSRF 코드 블록, CODE 코드 블록)을 충실히 따른다.
  - 제안: 이상 없음.

- **[INFO]** `TRIGGER_NOT_FOUND` 번역 맥락 명확성
  - 위치: `backend-labels.ts` (diff hunk line 151–152)
  - 상세: `"해당 웹훅 엔드포인트를 찾을 수 없어요."` 는 현재 chat-channel 경로에서만 발생하므로 기능상 문제 없다. 그러나 코드명 `TRIGGER_NOT_FOUND` 자체는 트리거 일반 개념이므로, 번역이 "웹훅 엔드포인트"로 구체화된 이유를 주석으로 명시하면 향후 재사용 시 혼동을 줄일 수 있다. 이전 review(18_01_52) RESOLUTION에서 "영문 SoT 가 'Webhook endpoint not found'"임을 확인하여 유지 결정한 상태이므로 현재 결정은 추적 가능하다.
  - 제안: 코드 주석에 "번역은 영문 SoT(hooks.service.ts: 'Webhook endpoint not found') 기준 — 현재 chat-channel 전용" 을 짧게 추가하면 이유가 코드 내에 남는다(INFO 수준, 선택적).

---

### 파일 5: plan/in-progress/spec-sync-chat-channel-gaps.md

- **[INFO]** frontmatter `worktree` 값 수정 (`spec-sync-audit` → `(unstarted)`)
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter line 2
  - 상세: 잘못된 worktree 이름을 `(unstarted)` 로 정정하여 plan lifecycle 문서 정확성이 향상됐다. `(unstarted)` 값이 plan-lifecycle.md에 공식 미착수 표기법으로 정의되어 있다면 이상 없다.
  - 제안: plan-lifecycle.md에 미착수 상태의 공식 표기(`(unstarted)`)가 명시돼 있는지 확인이 권장된다(INFO). 정의되어 있지 않다면 한 줄 추가로 확정하는 것이 좋다.

---

### 파일 6: plan/complete/fix-spec-frontmatter-catalog.md (신규)

- **[INFO]** `spec_impact` frontmatter 필드 추가로 추적 가능성 향상
  - 위치: `plan/complete/fix-spec-frontmatter-catalog.md` frontmatter
  - 상세: `spec_impact` 필드에 변경된 spec 파일 두 개가 열거되어 어느 spec이 영향받았는지 plan 내에서 추적 가능하다. 다만 이 필드가 plan-lifecycle.md 스키마에 선택 필드로 정의돼 있는지 확인이 필요하다. 기존 plan 파일 대부분이 이 필드를 갖지 않는다면, 선택 필드임을 명시해야 일관성 혼란을 방지할 수 있다.
  - 제안: plan-lifecycle.md에 `spec_impact`가 선택 필드(optional)임을 명시하거나, 이미 명시돼 있다면 이상 없음.

- **[INFO]** `## 후속` 섹션의 `INFO#4` 항목 미처리 흔적
  - 위치: `plan/complete/fix-spec-frontmatter-catalog.md` 후속 섹션 마지막 줄
  - 상세: `INFO#4: background-context-key-followups.md §보류 의 본 항목 → 본 PR 완료 후 [x]/정리` 가 미처리 TODO로 남아 있다. plan이 complete/로 이동했으므로 이 후속 조치도 완료 표시 또는 별 task로 이관했는지 불명확하다.
  - 제안: 해당 `background-context-key-followups.md §보류` 항목이 실제로 `[x]` 처리됐는지 확인하고, 아직 미처리라면 별 task plan으로 분리하거나 현재 파일에 완료 여부를 명시하는 것을 권장(INFO).

---

### 파일 7: plan/in-progress/cafe24-backlog-residual.md

- **[INFO]** G-4 섹션 추가 — generator 재생성 잔여 내역 추적
  - 위치: `plan/in-progress/cafe24-backlog-residual.md` (diff 마지막 11줄)
  - 상세: `_generator.py` 버그 수정 이후 재생성 시 자동 정정될 잔여 카탈로그 파일들을 명시하고, 수동 hand-edit 불가 이유(false-positive 위험)와 재생성 시 확인 레시피(`_overview.md §7.3` 참조)를 제공한다. 이 내역이 RESOLUTION.md에도 기록돼 있어 양방향 추적이 가능하다.
  - 제안: 이상 없음. backlog 문서화 적절.

---

## 요약

이번 변경 세트는 chat-channel 에러 코드 i18n 매핑 추가, KO/EN 문서 동기, parity guard 확장, generator 버그 수정으로 구성된다. 문서화 품질은 전반적으로 양호하다. `backend-labels.ts`와 `backend-labels.test.ts`의 인라인 주석이 spec SoT 참조와 노출 컨텍스트를 명확히 제공하며, `triggers.mdx`/`triggers.en.mdx` callout이 코드 현실과 일치하게 갱신됐다. 이전 review(18_01_52)에서 지적된 Warning#3(EN callout stale)과 Warning#1(직접 단위 테스트 갭)이 모두 해소된 것이 확인된다. 잔여 개선 사항은 모두 INFO 수준으로, `WORKSPACE_ID_REQUIRED`의 callout 미기재 이유 명시, `TRIGGER_NOT_FOUND` 번역 근거 주석, `spec_impact` 필드 스키마 공식화, plan의 INFO#4 후속 처리 여부 확인 등이다. 심각한 문서화 결함은 없다.

## 위험도

LOW

STATUS: SUCCESS
