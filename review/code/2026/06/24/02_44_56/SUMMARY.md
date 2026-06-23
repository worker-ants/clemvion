# Code Review 통합 보고서

리뷰 대상: web-chat console follow-up 13건 (증분 3)
리뷰 일시: 2026-06-24
리뷰 세션: review/code/2026/06/24/02_44_56

> 통합 summary 의 terminal write 가 차단되어 main 이 멱등 persist. 각 reviewer 상세는 동일 디렉터리의 `<reviewer>.md` 참조.

---

## 전체 위험도

**MEDIUM** — 테스트 커버리지 갭(DTO 검증·mutation 단위 테스트) 및 사용자 가이드 "서버 미저장" 오기가 실제 구현과 직접 모순됨. 보안·API 계약·부작용 위험은 내부 방어 로직으로 완화되어 있으나 외부 API 호출자 대상 silent mutation 위험이 존재.

---

## Critical 발견사항

Critical 발견사항 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | USER_GUIDE_SYNC | 웹채팅 외형 설정 사용자 가이드(web-chat.mdx / web-chat.en.mdx) §3 의 "서버에 별도로 저장되지는 않아요" 문장이 이번 서버 영속화 구현과 직접 모순됨. 저장 버튼·isDirty 흐름도 미서술. | `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` line 78, `web-chat.en.mdx` line 65 | "서버 미저장" 문장을 서버 영속화 설명으로 교체. "저장하지 않은 변경" 안내(`webChat.appearance.unsaved`) 표시 조건 한 줄 추가. |
| 2 | SIDE_EFFECT | `useUpdateWebChatAppearance` mutationFn 에서 `interaction.enabled: true` 하드코딩. 현재 내부 경로에서는 `interactionEnabled=true` 필터로 방어되나, 훅 재사용 시 비활성 인스턴스의 enabled 가 silent mutation 될 위험. | `use-web-chat.ts` — `useUpdateWebChatAppearance` mutationFn | `enabled: true` 대신 인자/현재 인스턴스 상태를 사용하거나, JSDoc 에 "enabled=true 인스턴스에만 사용" 제약 명기. |
| 3 | SIDE_EFFECT | `PATCH /api/triggers/:id` 에서 interaction 객체 전체 교체 시, 클라이언트가 `appearance` 없이 PATCH 하면 기존 저장된 appearance 가 조용히 소실(silent deletion). 외부 3rd-party API 호출자에게 노출. | `interaction-config.dto.ts`, `use-web-chat.ts` | `spec/5-system/14-external-interaction-api.md` 에 "PATCH 시 interaction 객체를 통째로 교체하므로 기존 appearance 보존하려면 함께 전송해야 한다" 주의사항 추가. |
| 4 | TESTING | `WebChatAppearanceDto` 필드 유효성 검증 단위 테스트 부재 (primaryColor 패턴, headerTitle MaxLength, locale/position IsIn 경계값). 공개 스니펫에 흘러가는 필드라 서버 validation 이 다층 방어. | `web-chat-appearance.dto.ts` | DTO validation spec 에 유효값·패턴 위반·MaxLength 초과·IsIn 실패 케이스 추가. |
| 5 | TESTING | `QueryTriggerDto.interactionEnabled` Transform 경계값 테스트 부재 (`'false'`→false, undefined→undefined, `'1'`→false). | `query-trigger.dto.ts` | DTO validation spec 에 `QueryTriggerDto` 섹션 추가 (plainToInstance + validate). |
| 6 | TESTING | `useUpdateWebChatAppearance` 뮤테이션 단위 테스트 부재 (PATCH body 구성·query invalidation). | `use-web-chat.ts` | use-web-chat 단위 테스트 추가 (apiClient mock 으로 PATCH body·invalidation 검증). |
| 7 | TESTING | `WebChatDetail` 저장 버튼 흐름 단위 테스트 부재 (성공/실패 toast, isDirty=false → disabled). | `web-chat/page.tsx` | web-chat 페이지 테스트에 3 케이스 추가. |
| 8 | SPEC-DRIFT | `widget-app.tsx` 의 `visible=false` 시 `{ width:0, height:0, state:"collapsed" }` 송신이 `2-sdk §3` wc:resize 스키마에 미정의. | `widget-app.tsx` | 코드 유지 + `2-sdk §3` wc:resize 표에 hidden/blocked 시 0×0 emit 항목 추가. |
| 9 | SPEC-DRIFT | 콘솔 라이브 미리보기 iframe 높이 clamp 범위(`[320,640]`px)가 `5-admin-console §6` 에 미기재. | `live-preview.tsx` | 코드 유지 + `5-admin-console §6` 에 clamp 범위 한 줄 추가. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1 | SECURITY | `WebChatAppearanceDto` 자유 텍스트 필드 서버단 HTML 새니타이징 없음. React escape·sanitizeDraft·JSON.stringify 다층 완화로 실 XSS 경로 제한적. | 현행 수용. 심도 강화 시 sanitize 검토. |
| 2 | SECURITY | live-preview wc:resize origin/source 이중 검증 유지, height clamp 적용. width 미반영. | 현행 수용. |
| 3 | SECURITY | iframe sandbox `allow-same-origin`+`allow-scripts` — same-origin 1st-party 의도된 설계. | `4-security §1` 에 트레이드오프 명시 권장. |
| 4 | SIDE_EFFECT | `mockConsole` 클로저 `triggers` 배열 변이 — Playwright retry 시 누적 위험. | JSDoc 명기, beforeAll 금지. |
| 5 | SIDE_EFFECT | `sendResize` 빈 deps — bridge 재생성 시 이전 bridge 전송 가능성. | bridge 초기화 경로 재전송 고려. |
| 6 | SIDE_EFFECT | 외형 저장 시 `TRIGGERS_KEY` 전체 무효화 — 불필요 요청 가능. | `WEB_CHAT_INSTANCES_KEY` 만으로 충분한지 검토. |
| 7 | MAINTAINABILITY | `seedDraft` useState 초기화에서 2회 호출(localStorage 중복 읽기). | lazy 헬퍼/useReducer 통합. |
| 8 | MAINTAINABILITY | `PANEL_BOX`/`LAUNCHER_BOX` 가 `styles.ts` 치수와 별도 관리. | styles.ts export 후 import (백로그). |
| 9 | MAINTAINABILITY | `clamp` 유틸 live-preview 내부 정의. | `lib/utils` 공용 이동 검토 (백로그). |
| 10 | MAINTAINABILITY | `WebChatDraft`(필수) vs `WebChatAppearanceConfig`(optional) 분리 의도 불분명. | JSDoc 에 의도 명시. |
| 11 | TESTING | widget-app blocked/hidden `wc:resize(0,0)` 케이스 미검증. | 테스트 추가. |
| 12 | TESTING | live-preview height 최솟값 clamp·height 없는 payload 케이스 미검증. | 테스트 추가. |
| 13 | TESTING | `sendResize` actions 포함 스모크 테스트 없음. | 스모크 추가. |
| 14 | API_CONTRACT | `tokenStrategy ?? "per_execution"` 폴백이 `per_trigger` 인스턴스 값을 silent override 가능. | 주석 명기, 장기 전용 PATCH 서브경로 고려. |
| 15 | DOCUMENTATION | `useUpdateWebChatAppearance` tokenStrategy 폴백 동작 JSDoc 미기재. | `@default "per_execution"` 추가. |
| 16 | SCOPE | `schedules-page.test.tsx` afterEach(cleanup) 가 웹채팅 무관하나 plan 항목 12 선재 안정화로 명시 분류됨. | 분류 명확, 조치 불요. |

---

## 처리 방침

- Critical 0 → 차단 없음.
- WARNING 9 → resolution-applier 가 분류·fix·검증: 문서/spec drift(W1·W3·W8·W9)는 fix, 테스트 갭(W4~W7)은 추가, side-effect(W2)는 JSDoc 제약 명기.
- INFO 는 비차단 — 다수는 백로그/현행 수용, 저비용 항목(JSDoc·spec 한 줄)은 fix 와 함께 흡수.
