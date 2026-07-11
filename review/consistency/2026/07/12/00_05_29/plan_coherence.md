# Plan 정합성 검토 — spec-draft-webchat-i18n-scope.md

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** i18n-userguide 적용범위 신설이 향후 가드 확장 계획과 무충돌임을 확인
  - target 위치: Edit A (`spec/conventions/i18n-userguide.md` `## 적용 범위 (Scope)` 신설), "가드가 이미 위젯을 스캔 밖에 둔다" 근거 서술
  - 관련 plan: 없음 (교차 확인용 부재 사실 기록)
  - 상세: `plan/in-progress/**` 전체를 `hardcoded-korean-ratchet`·`doc-sync-matrix` 키워드로 스캔한 결과, `channel-web-chat` 스캔 범위를 확장하거나 위젯에 EN 다국어화를 계획하는 진행 중 plan 이 없다. target 의 "제외 대상" 결정과 "EN 위젯 지원 착수 시 재검토" 유보 조건에 반하는 선행 계획이 없어 결정 우회·후속 무효화 리스크가 없다. `eia-context-schema-followups.md` 는 `spec-link-integrity` 가드를 `channel-web-chat` 소스까지 확장한 이력(PR #913)을 담고 있으나 이는 spec-link 앵커/DEAD 검증이며 i18n 문자열 스캔과는 별개 가드라 target 의 "hardcoded-korean-ratchet·doc-sync-matrix 는 위젯 밖" 주장과 충돌하지 않는다.
  - 제안: 조치 불요. 향후 위젯 EN 지원 plan 이 생성되면 그 plan 이 본 스코프 절의 "재검토" 트리거를 명시적으로 인용하도록 착수 시 확인.

- **[INFO]** `spec-draft-pr874-deferred-docs.md` 와의 편집 표면 인접성 — 실질 충돌 없음
  - target 위치: 전체 (spec/7-channel-web-chat/* 대상 Edit B~D)
  - 관련 plan: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (owner: project-planner, worktree `spec-deferred-docs-42d3b6`, 체크리스트 대부분 완료·`commit + PR` 만 미완)
  - 상세: 두 plan 모두 `spec/7-channel-web-chat/1-widget-app.md`/인접 문서를 건드리지만, pr874 plan 은 `1-widget-app.md` Rationale R7 신설 + `conversation-thread.md` §9 뿐이고 본 target 은 `_product-overview.md §2`·`2-sdk.md §4`·`5-admin-console.md §4` 로 섹션이 겹치지 않는다. 병합 충돌(git conflict) 가능성은 낮으나 두 plan 이 동일 세션/워크트리가 아니면 별도 커밋으로 처리될 것이므로 정합성 문제는 아니다.
  - 제안: 조치 불요 (참고용 기록).

## 요약

`plan/in-progress/**` 전수 검색(worktree 경합 제외) 결과, 이 spec draft 가 우회하는 "결정 필요" 미해결 항목이나 무효화하는 후속 plan 항목을 찾지 못했다. draft 가 인용하는 사용자 결정(2026-07-12, locale reserved/inert + Korean-only v1 스코프 경계)은 다른 in-progress plan 이 전제로 삼거나 뒤집으려는 대상이 아니며, 위젯 EN 다국어화·hardcoded-korean-ratchet/doc-sync-matrix 스캔 확장을 계획 중인 plan 도 없어 "EN 착수 시 재검토" 유보 조건과 충돌할 선행 계획도 없다. `spec-draft-pr874-deferred-docs.md`(동일 spec 영역 인접 편집)와도 섹션이 분리돼 있어 후속 항목 무효화 리스크가 없다.

## 위험도
NONE
