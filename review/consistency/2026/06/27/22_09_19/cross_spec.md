# Cross-Spec 일관성 검토 결과

대상: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 범위: `spec/7-channel-web-chat/` 전 6문서 + 구현 diff(`codebase/channel-web-chat/`, `codebase/packages/web-chat-sdk/`)
대조 spec: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`, `spec/2-navigation/_product-overview.md`

---

## 발견사항

### [INFO] `ended` 상태에서 OPEN 액션의 동작이 spec 상태기계 다이어그램에 명시되지 않음
- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md §3` 상태기계 다이어그램
- **충돌 대상**: 구현 diff `codebase/channel-web-chat/src/lib/widget-state.test.ts` (새 테스트 "ended 재open: OPEN(ended 상태) → open=true, phase=ended 유지")
- **상세**: spec 다이어그램은 `[collapsed] ──open──▶ [panel]` 만 기술하고 `[ended]` 상태에서 OPEN 액션을 받을 때 `phase=ended` 유지·`open=true`·`unread=0` 이 되는 동작을 명시하지 않는다. 구현은 이 동작을 신규 테스트로 확증했으나 spec 본문에는 해당 전이가 문서화돼 있지 않다. `§3.1 닫기(collapse)` 행의 "재open 시 그대로" 설명이 대화 진행 중(non-ended) 케이스만 다루고 있어 ended 상태의 재open 시맨틱이 spec-impl 간 암묵적 갭으로 남는다.
- **제안**: `spec/7-channel-web-chat/1-widget-app.md §3.1`의 상태 전이 표에 "ended 상태에서 close/open → open=true·phase=ended 유지(종료 화면 재노출, 새 대화 시작 CTA)" 행을 추가해 명문화. 다이어그램에도 `[ended]` 에서의 패널 전개(`open` 토글)를 점선으로 표시할 것을 권장.

---

### [INFO] `isTextInputSurface()` 공개 함수의 spec 언급 부재
- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행 + `§R6` 큐 폐기 규칙
- **충돌 대상**: 구현 diff `codebase/channel-web-chat/src/lib/widget-state.ts` (신규 `isTextInputSurface` 함수)
- **상세**: spec §2 입력창 행은 "`buttons`/`form` 이면 비활성", §R6 는 "`buttons`/`form` 이면 큐 폐기"로 동일 판정 로직을 두 곳에 산문으로 기술한다. 구현은 이를 `isTextInputSurface(pending)` 으로 단일화해 panel.tsx 와 use-widget(큐 flush 게이팅) 이 공유하도록 리팩터했다. spec 본문에는 이 단일화 결정이 반영돼 있지 않다. spec-impl 모순은 아니나(규칙 자체는 일치), 향후 spec 편집 시 두 위치 중 하나만 수정해 규칙이 drift 할 위험이 있다.
- **제안**: `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행 주석에 "텍스트 표면 판정(`buttons`/`form` 이 아님) SoT = `widget-state.isTextInputSurface`" 를 한 문장 추가해 구현 단일 진실을 cross-reference 로 고정.

---

### [INFO] `ERROR` 액션 시 `pending` 해제 동작이 spec 상태기계에 명시되지 않음
- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md §3` 상태기계
- **충돌 대상**: 구현 diff `codebase/channel-web-chat/src/lib/widget-state.test.ts` (새 테스트 "ERROR(대기 중 pending 상태) → ended + pending 해제 + error")
- **상세**: spec 상태기계는 에러 발생 시 `[ended]` 전이를 암시하나(`§3.1` 토큰 만료/서버 타임아웃 행), `pending` 이 채워진 상태(`buttons` 표면 등)에서 ERROR 가 발생할 때 `pending` 이 null 로 해제된다는 세부 동작은 기술하지 않는다. 구현 테스트가 이 불변식을 명문화했지만 spec 본문에는 누락돼 있다.
- **제안**: `spec/7-channel-web-chat/1-widget-app.md §3.1` 에러/타임아웃 행에 "에러 전이 시 `pending` 표면 초기화" 조건을 추가.

---

### [INFO] `spec/0-overview.md §6.2` 웹채팅 항목의 구현 상태가 실제와 미세하게 불일치
- **target 위치**: `spec/0-overview.md §6.2` "임베드형 웹채팅 위젯 + SDK" 행
- **충돌 대상**: `spec/7-channel-web-chat/` 전 6문서 (`status: implemented`)
- **상세**: `spec/0-overview.md §6.2`(백엔드만/부분 구현 🚧) 항목에 "라이브 미리보기는 위젯 co-deploy 후 증분 2"로 기술되어 있다. 반면 `spec/7-channel-web-chat/5-admin-console.md` 전체가 `status: implemented` 이고, `spec/2-navigation/_product-overview.md` NAV-WC-06 은 여전히 `🚧 (증분 2 — 위젯 co-deploy 후)` 상태다. spec/7 영역 6문서가 모두 `implemented` 로 선언된 상태에서 overview 의 🚧 분류와 NAV-WC-06 의 🚧 가 실질 구현 완료 이후 갱신되지 않은 것으로 보인다. 단, 실제 co-deploy 파이프라인(Phase 1) 의 구현 완료 여부에 따라 이 🚧 가 의도적 상태일 수도 있다.
- **제안**: `spec/7-channel-web-chat/5-admin-console.md §6` 라이브 미리보기 구현 실제 상태를 확인하고, co-deploy(Phase 1)가 완료됐으면 `spec/0-overview.md §6.2`·`spec/2-navigation/_product-overview.md NAV-WC-06` 을 `✅` 로 동기화. 미완이면 현 spec/7의 `status: implemented` 를 `partial` 로 조정.

---

## 요약

`spec/7-channel-web-chat/` 전 6문서와 구현 diff(`isTextInputSurface` 추출, `ERROR/OPEN-on-ended` 신규 테스트, `panel.tsx` ended 상태 Composer 비렌더)는 기존 cross-spec 규약(`spec/5-system/14-external-interaction-api.md` EIA 표면·`spec/1-data-model.md` `interactionAllowedOrigins`·`spec/2-navigation/_product-overview.md` NAV-WC 요구사항·`spec/0-overview.md` 아키텍처)과 **직접 모순되는 항목이 없다**. 발견된 4건은 모두 INFO 수준으로, 구현이 spec 규칙을 올바르게 따르면서 spec 본문에 아직 반영되지 않은 암묵적 동작(ended 재open 전이, 에러 시 pending 해제)과 spec/overview 동기화 지연(🚧 갱신)이다. `isTextInputSurface` 추출은 spec의 `buttons/form 비활성` 규칙을 구현 측에서 단일화한 리팩터로 spec 규칙과 완전히 정합한다.

## 위험도

LOW
