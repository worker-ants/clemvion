# Cross-Spec 일관성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (impl-done, diff-base=origin/main)
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] EIA spec §4 등록 페이로드에 deprecated `authType` 필드 잔존
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §2 인스턴스 생성 표 "스키마: EIA §4"
- 충돌 대상: `spec/5-system/14-external-interaction-api.md` §4 `POST /api/triggers` 예시 (라인 169 — `"authType": "bearer"` 포함), `spec/5-system/12-webhook.md` "inline auth path 폐지" + `spec/2-navigation/2-trigger-list.md` §162 ("인증 관련 inline 키 (`config.authType` / ...) 는 제거됨")
- 상세: `5-admin-console.md §2` 인스턴스 생성 표가 POST body 스키마 SoT 로 EIA §4 를 참조한다. EIA §4 본문 예시 코드블록에는 `"authType": "bearer"` 가 아직 잔존해 있다(라인 169). 반면 `2-trigger-list.md §3 PATCH 설명`(라인 162)과 `14-external-interaction-api.md` 라인 605-608 주석은 inline auth 필드가 폐지됐음을 명시한다. 예시 코드블록만 갱신이 안 된 상태 — 실제 POST 시 `authType` 을 포함하면 backend 에서 무시되거나 오류 처리될 수 있으므로 혼동 유발.
- 제안: EIA §4 `POST /api/triggers` 코드블록에서 `"authType": "bearer"` 행을 제거하고 `"authConfigId": null` (공개 위젯 = 인증 없음) 예시로 교체. `spec/5-system/14-external-interaction-api.md` 단독 수정으로 해소.

---

### [INFO] `spec/2-navigation/_layout.md` 사이드바 메뉴 순서 — 구현과 일치, 추가 충돌 없음
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §1 ("사이드바 신규 '웹채팅' 메뉴, Schedule 아래")
- 충돌 대상: `spec/2-navigation/_layout.md §2.2` 메뉴 항목 표 (순서 4=Schedule, 5=Web Chat, 6=Integration)
- 상세: 5-admin-console.md 가 요구하는 "Schedule 아래" 위치와 `_layout.md` 표의 순서(5번 Web Chat)가 일치한다. 구현 `sidebar.tsx` diff 도 Calendar 다음에 MessageCircle 삽입으로 정합하다. 충돌 없음 — INFO 로 기록.

---

### [INFO] 요구사항 ID `NAV-WC-01..06` — 구현 범위 vs spec 상태 동기화 권장
- target 위치: `spec/2-navigation/_product-overview.md` 라인 217-222 (NAV-WC-01~06, 모두 `🚧`)
- 충돌 대상: `spec/7-channel-web-chat/5-admin-console.md` (구현 완료된 항목 기술)
- 상세: NAV-WC-01(사이드바 메뉴)·NAV-WC-02(목록)·NAV-WC-03(생성 editor+)·NAV-WC-04(외형 빌더)·NAV-WC-05(설치 스니펫)는 이번 구현 diff 에 구현돼 있으나, `_product-overview.md` 요구사항 표에는 전부 `🚧`(미완료)로 남아 있다. NAV-WC-06(라이브 미리보기)은 위젯 동봉(co-deploy) 선행조건이 아직 미완이므로 `🚧` 유지가 맞다.
- 제안: NAV-WC-01~05 를 `✅` 로 갱신. NAV-WC-06 은 `🚧` 유지. `spec/2-navigation/_product-overview.md` 단독 수정.

---

### [INFO] `spec/0-overview.md §6.2` 웹채팅 항목 — "운영 콘솔" 산출물 누락
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` (운영 콘솔 구현 완료)
- 충돌 대상: `spec/0-overview.md §6.2` ("임베드형 웹채팅 위젯 + SDK" 항목, 🚧) — 현재 기술: "위젯 SPA + SDK + 샘플이 구현됐다. …운영 콘솔(`5-admin-console.md`)은 `status: partial`"
- 상세: `0-overview.md §6.2` 웹채팅 행은 이미 위젯·SDK 가 구현됐음을 기술하고 있으나, 이번 PR 로 추가되는 **운영 콘솔**(구성요소 D)의 구현 완료가 반영돼 있지 않다. 완전한 모순은 아니나, 운영 콘솔 진입점(`/web-chat` 메뉴·목록·생성·스니펫)이 이번 diff 에 포함되므로 overview 행을 갱신하면 시스템 상태 단일 진실 원칙과 정합.
- 제안: `spec/0-overview.md §6.2` 웹채팅 행에 운영 콘솔 1단계(목록·생성·스니펫·외형빌더) 구현 완료 기술 추가. 라이브 미리보기(NAV-WC-06)는 co-deploy 선행조건 미완이므로 🚧 유지 명시.

---

### [INFO] `spec/7-channel-web-chat/` 파일들의 `status: partial` — 이번 구현 완료 항목 미갱신
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter (`status: partial`, `pending_plans: web-chat-console.md`)
- 충돌 대상: N/A (내부 일관성)
- 상세: `5-admin-console.md` 의 `pending_plans` 에 `plan/in-progress/web-chat-console.md` 가 기재돼 있다. 이번 구현이 해당 plan 의 1단계(목록·생성·외형빌더·스니펫)를 완료했다면 plan 이동 및 frontmatter 갱신이 필요하다. `status: partial` 은 라이브 미리보기 미완이므로 유지가 합당하나, `pending_plans` 항목은 완료된 것과 잔여를 구분해야 한다.
- 제안: `web-chat-console.md` plan 이 완료된 phase 에 해당하면 plan/complete 로 이동하고 frontmatter 의 `pending_plans` 에서 제거. 미완(라이브 미리보기) 항목은 별도 followup plan 으로 잔존.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/7-channel-web-chat/` 의 데이터 모델·API 계약·RBAC 정의는 기존 spec 과 직접 모순이 없다. 웹채팅 인스턴스를 신규 엔티티 없이 기존 Trigger 재사용으로 표현하는 방식은 `spec/1-data-model.md §2.8`·`spec/5-system/14-external-interaction-api.md §4`·`spec/2-navigation/2-trigger-list.md §3` 과 구조적으로 일치하고, RBAC(editor+ 생성, viewer+ 조회)도 `2-trigger-list.md §2.5·§4` 규약을 따른다. 사이드바 순서도 `_layout.md §2.2` 와 일치한다. 발견된 항목은 모두 INFO 등급으로, EIA §4 예시 코드에 폐기된 `authType` 이 잔존하는 점, 요구사항 상태 표(`NAV-WC-01~05`)와 `0-overview.md` 운영 콘솔 항목이 구현 완료를 반영하지 않은 점, frontmatter `pending_plans` 정리가 미완인 점 등 문서 동기화 권장 사항이다. CRITICAL/WARNING 수준의 모순은 없다.

## 위험도

LOW

---

STATUS: SUCCESS
