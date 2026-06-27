# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 이전 WARNING 전원 해소 확인

이전 리뷰(14_43_25)에서 제기된 3건의 WARNING 이 모두 이번 변경에서 해소됐다.

**W-3 해소**: `submit` 핸들러 가드에 `loading` 추가 완료.
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.tsx` L225
- `if (!trimmed || disabled || loading) return;` — `loading=true`, `disabled=false` 조합에서도 단독 재사용 시 onSend 호출 차단 계약 보장.
- 버튼: `disabled={disabled || loading || !text.trim()}` — UI 상태와 핸들러 가드 일치.

**W-2 해소**: `composer.test.tsx` 신설로 Composer 단독 단위 검증 5케이스 추가.
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.test.tsx`
- `loading=true` → 라벨/aria-busy/스피너/비활성, 텍스트 있어도 전송 차단, `loading=false` → 전송 라벨/onSend 호출, `loading=undefined` 하위호환, `disabled=true` 독립 동작 — 5케이스 전부 행위 명세와 일치.

**W-1(SPEC-DRIFT) 해소**: spec §2 "입력창" 행에 비활성 외형 규약 명문화 완료.
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/spec/7-channel-web-chat/1-widget-app.md` L46
- spec 본문: "idle(빈 입력·buttons/form) 전송 버튼은 중립 회색; booting/streaming(AI 처리 중)에는 스피너 + `aria-busy=true` + `aria-label="AI 응답 중"` 로 '응답 중' 표시" — 구현과 line-level 일치.

---

### [INFO] Spec fidelity 재점검 — 완전 일치

spec §2 "입력창" 행 요구사항 대비 구현 매핑:

| spec 요구 | 구현 | 일치 |
|---|---|---|
| `awaiting_user_message` + `ai_conversation` 표면 시 활성 | `disabled={phase !== "awaiting_user_message" \|\| pending?.type === "buttons" \|\| pending?.type === "form"}` | 일치 |
| booting/streaming 중 비활성 | `disabled` 조건 상기 (phase가 awaiting_user_message 아님) | 일치 |
| idle 비활성: 중립 회색 | `.wc-composer-send:disabled { background: #c7cad1; }` | 일치 |
| booting/streaming: `aria-busy=true` | `aria-busy={loading \|\| undefined}` → `"true"` | 일치 |
| booting/streaming: `aria-label="AI 응답 중"` | `aria-label={loading ? "AI 응답 중" : "전송"}` | 일치 |
| booting/streaming: 스피너 | `{loading ? <span className="wc-composer-spinner" aria-hidden="true" /> : "↑"}` + CSS keyframes | 일치 |
| loading 중 브랜드 컬러 유지 | `.wc-composer-send[aria-busy="true"]:disabled { background: #5B4FE9; }` (higher specificity) | 일치 |

---

### [INFO] Panel 통합 테스트 보강 확인

`panel.test.tsx` 신규 describe `"Panel — AI 처리 중 전송 버튼 로딩 표시 (§R6)"` 3케이스:
- `phase=streaming` → aria-busy/스피너/btn.disabled/입력 비활성 4항목 검증
- `phase=booting` → 동등 4항목 검증 (이전 INFO #4: booting이 1항목만 검증하던 문제 해소)
- `phase=awaiting_user_message` → 로딩 없음 확인

`beforeEach(vi.clearAllMocks())` 추가로 vi.fn() 누적 호출 격리 달성.

---

### [INFO] 엣지 케이스 검증

- `aria-busy={loading || undefined}`: `loading=false` → `false || undefined = undefined` → 속성 미렌더(aria-busy 없음). `loading=true` → `true`. 동작 정확.
- CSS 특이도: `.wc-composer-send[aria-busy="true"]:disabled`(속성+의사클래스)가 `.wc-composer-send:disabled`(의사클래스만) 보다 높아 브랜드 컬러 override 정상.
- `loading=true`, `disabled=false` (Composer 단독 재사용): 입력은 활성(타이핑 가능), 버튼만 스피너+비활성, 전송 차단 — 설계 의도와 일치, 테스트로 보장.

---

### [INFO] 잔여 미조치 항목 (본 PR 범위 외, 이전 INFO 그대로)

- CSS 스타일 회귀 검증(jsdom 환경 computed style 미지원) — 장기 시각 회귀 테스트 과제.
- `panel.tsx` `{error}` 렌더링 내부 정보 노출 가능성 — 이번 PR 신규 도입 아님, 별도 태스크.

---

## 요약

이번 변경 세트(두 번째 리뷰 대상)는 첫 번째 리뷰(14_43_25)에서 제기된 WARNING 3건을 모두 해소한다: `submit` 핸들러 + 버튼 `disabled` 에 `loading` 가드 추가, `composer.test.tsx` 신설(5케이스), spec `§2` 입력창 행 비활성 외형 규약 명문화. spec `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/spec/7-channel-web-chat/1-widget-app.md` §2 와 구현이 aria-busy·aria-label·스피너·중립 회색·브랜드 컬러 유지 전 항목에서 line-level 일치한다. 기능 완전성·엣지 케이스·비즈니스 로직·반환값 모두 §R6 요구사항을 완전히 충족하며, 신규 Critical 또는 WARNING 발견 없음.

## 위험도

NONE
