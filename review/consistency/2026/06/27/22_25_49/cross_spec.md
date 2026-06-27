# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
검토 범위: `spec/7-channel-web-chat/` (6개 문서 전체)
기준 diff: `origin/main...HEAD`
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `5-admin-console.md` status=`implemented` vs NAV-WC-06 미완 상태 불일치

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `status: implemented`
- 충돌 대상: `spec/2-navigation/_product-overview.md` NAV-WC-06 행 (`🚧 증분 2 — 위젯 co-deploy 후`); `spec/0-overview.md` §6.2 (`라이브 미리보기는 위젯 co-deploy 후 증분 2`)
- 상세: `5-admin-console.md` 는 status를 `implemented`로 선언하지만, `_product-overview.md`(NAV-WC-06)와 `0-overview.md`(§6.2) 는 라이브 미리보기를 `🚧 (증분 2)` 로 표기하고 있다. `5-admin-console.md §5` 에도 "라이브 미리보기는 placeholder 로 노출" 증분 단계 주의가 남아 있다. spec `status` 필드가 "설치·스니펫 ✅ / 미리보기 미완" 의 부분 상태를 반영하지 못한 채 `implemented`로 단일 표기되어 있다.
- 제안: 본 검토 대상인 위젯 상태 리팩터링 diff가 미리보기 기능 자체를 변경하지 않으므로 이 불일치는 기존 drift이며 현 PR 범위 밖이다. 별도 spec 동기화(NAV-WC-06 상태 갱신 or `5-admin-console` frontmatter에 하위 feature status 주석 추가)로 해소 권장. 비차단.

---

### [INFO] `1-widget-app.md` 상태기계 다이어그램: `ended` 재open 동작 미명시 — 코드와 묵시적 정합

- target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계 다이어그램 및 §3.1 표
- 충돌 대상: `codebase/channel-web-chat/src/lib/widget-state.ts` OPEN 리듀서 + 신규 테스트 (`widget-state.test.ts` "ended 재open: OPEN(ended 상태) → open=true, phase=ended 유지" 케이스)
- 상세: `widget-state.ts` OPEN 리듀서는 `state.phase === "collapsed"` 일 때만 `panel`로 전이하고, `ended` 상태에서 OPEN 시 `open=true` + `phase=ended` 유지로 동작한다. 신규 테스트가 이 동작을 명시적으로 검증한다. 그러나 `1-widget-app.md` §3 다이어그램과 §3.1 표 어디에도 "ended 상태에서 `open` 명령 → 패널 오픈되나 phase=ended 유지(종료 화면 재노출)" 동작이 명시되어 있지 않다. 다이어그램은 `[collapsed] ──open──▶ [panel]` 경로만 보여주며, ended에서 open을 받는 경우는 기술이 없다. 코드 동작과 spec 기술 사이의 암묵적 정합 상태다.
- 제안: `1-widget-app.md` §3.1 표에 "ended 상태에서 OPEN → open=true, phase=ended 유지, 종료 화면 재표시" 행 추가 권장. spec 변경이므로 project-planner 위임 필요. 비차단(기능적 모순 아님 — 코드가 합리적 동작을 구현하고 있으며 spec이 이를 커버하지 않은 gap).

---

### [INFO] `isTextInputSurface(null) → true` 명세 gap: `null`을 텍스트 표면으로 보는 정책이 spec에 미기술

- target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 입력창 활성 조건
- 충돌 대상: `codebase/channel-web-chat/src/lib/widget-state.ts` `isTextInputSurface` 함수 JSDoc; `widget-state.test.ts` "null(ai_conversation 도달 전 과도 상태) → 텍스트 표면(true)" 케이스
- 상세: `1-widget-app.md` §2 입력창 행은 "활성 조건: `awaiting_user_message` + `ai_conversation` 표면일 때만 자유 텍스트 입력 활성"이라고 기술하나, 코드의 `isTextInputSurface`는 `null` (pending이 아직 없는 과도 상태)도 텍스트 표면으로 분류한다. spec 문구만 보면 `null` 케이스가 텍스트 비활성이어야 할 것처럼 읽힐 수 있다. 코드 JSDoc에는 "ai_conversation 진입 전 등도 텍스트 표면으로 본다(현행 동작 보존)"로 명시되어 있으나 spec 본문에는 없다.
- 제안: `1-widget-app.md` §2 입력창 행에 `null`(과도 상태) 포함 정책("pending 미설정 시에도 텍스트 표면으로 취급") 주석 추가 권장. 비차단(코드 동작이 합리적이며 spec gap일 뿐).

---

### [INFO] `execution.message` SSE 이벤트 — `1-widget-app.md` §2 메시지 리스트에서 미참조

- target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 메시지 리스트 행
- 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.2, §R18 (`execution.message` — 표시-전용 presentation 노드 자동 진행 메시지); `spec/7-channel-web-chat/5-admin-console.md` §6 "표시-전용 presentation 노드 렌더: 위젯이 `execution.message` SSE 이벤트로 받아 말풍선으로 렌더"
- 상세: `5-admin-console.md` §6은 `execution.message` SSE 이벤트를 통한 표시-전용 presentation 노드 렌더를 명시하나, `1-widget-app.md` §2의 메시지 리스트 데이터 출처 표에는 `execution.message` 이벤트 경로가 언급되지 않는다. 두 문서가 동일 위젯의 메시지 렌더 경로를 다르게 기술하는 gap이다. EIA §5.2·§R18이 `execution.message`를 공식 SSE 이벤트로 정의하므로 `1-widget-app.md`가 이를 누락한 상태다.
- 제안: `1-widget-app.md` §2 메시지 리스트 표에 "`execution.message`(비차단 presentation 노드)" 경로 추가 권장. 비차단.

---

### [INFO] 요구사항 ID 네임스페이스 — `spec/7-channel-web-chat/` 내 요구사항 ID 미부여 (기존 패턴과 일관)

- target 위치: `spec/7-channel-web-chat/_product-overview.md` §2 목표/비목표
- 충돌 대상: `spec/2-navigation/_product-overview.md` NAV-WC-01~06 (외부에서 부여한 ID)
- 상세: `7-channel-web-chat/_product-overview.md` 자체는 요구사항 ID를 부여하지 않는다. NAV-WC-01~06은 `2-navigation/_product-overview.md`가 web-chat 기능에 부여한 것으로 다른 영역 ID(`NAV-*`)와 충돌하지 않는다. 요구사항 ID 부재 자체는 본 영역의 의도된 패턴으로 보이며(영역 내 sub-doc 간 직접 참조 방식), 다른 영역의 기존 ID와 충돌하는 신규 ID 부여는 없다.
- 제안: 현재 상태 유지. NONE.

---

### [INFO] RBAC 권한 모델 — `5-admin-console.md` §7 vs `2-trigger-list.md` editor+ 일치 확인

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §7 권한 표
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` Trigger 생성/삭제 권한 규약
- 상세: `5-admin-console.md` §7은 생성·삭제·편집을 `editor+`로, 조회·복사·미리보기·호출이력을 `viewer+`로 정의하며 "Trigger 생성/삭제 규약과 동일(`RoleGate`)"로 명시한다. 이는 `2-navigation/2-trigger-list.md`의 trigger editor+ 규약 및 `spec/0-overview.md`의 RBAC 정의와 일치한다.
- 제안: 충돌 없음. NONE.

---

### [INFO] `Workspace.settings.interactionAllowedOrigins` 단일 키 — 임베드·CORS 겸용 정합

- target 위치: `spec/7-channel-web-chat/4-security.md` §2, §3 "동일 `interactionAllowedOrigins` 단일 키로 통합"
- 충돌 대상: `spec/1-data-model.md` §2.2 Workspace.settings; `spec/5-system/14-external-interaction-api.md` §8.5
- 상세: `4-security.md`는 임베드 allowlist와 `/api/external/*` CORS를 동일 `interactionAllowedOrigins` 키로 통합 관리함을 명시한다. `1-data-model.md` §2.2도 같은 키를 "EIA `/api/external/*` CORS allowlist 및 임베드 origin allowlist"로 정의하며 일치한다. `9-user-profile.md`의 PATCH `/api/workspaces/:id/settings` API도 이 키를 처리하도록 정의되어 있다. 세 영역이 일치한다.
- 제안: 충돌 없음. NONE.

---

## 요약

`spec/7-channel-web-chat/` 의 6개 문서와 다른 영역 간에 구조적 모순(데이터 모델 충돌·API 계약 충돌·상태 전이 모순·RBAC 충돌·계층 책임 역전)은 발견되지 않았다. 발견된 사항은 전부 INFO 등급 — (1) `5-admin-console.md`의 `status: implemented` 선언이 NAV-WC-06 미완 상태와 맞지 않는 기존 drift, (2) `ended` 상태에서 OPEN 동작·`isTextInputSurface(null)=true` 정책이 구현/테스트에는 명시됐으나 `1-widget-app.md` 본문에 누락된 spec gap, (3) `execution.message` SSE 이벤트 경로가 `1-widget-app.md` 메시지 리스트에서 미참조인 gap이다. 이 모두 현 PR의 위젯 상태기계 리팩터링(isTextInputSurface 단일화, ended/ERROR 테스트 보강) 코드 변경이 유발한 새 충돌이 아니라 기존 spec에서 사전 존재하던 gap이며, 비차단이다.

## 위험도

LOW
