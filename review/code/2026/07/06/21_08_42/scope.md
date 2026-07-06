# 변경 범위(Scope) 리뷰 — team_invite channel in_app 하향

## 대상 커밋
`56c72ba9f` feat(notifications): team_invite channel in_app 하향 — 초대 이메일 중복 회피 (13 파일)

## 발견사항

- **[INFO]** 코드 2줄 diff 대비 부속 산출물 11개가 동반되어 커밋 규모가 커 보이나, 모두 프로젝트 규약이 명시적으로 요구하는 필수 부산물
  - 위치: `plan/complete/spec-update-notifications-firing.md`(신규), `review/consistency/2026/07/06/20_57_56/*`(6개 신규 파일: SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md), `spec/2-navigation/9-user-profile.md`, `spec/data-flow/8-notifications.md`
  - 상세: 실질 코드 변경은 `workspace-invitations.service.ts` 의 `channel: 'both'` → `'in_app'` 1곳 + 동반 docstring/인라인 주석 갱신, `.spec.ts` 의 단언 문자열 2곳(`both`→`in_app`, describe 제목의 `channel=` 표기)뿐이다. 나머지는 CLAUDE.md 규약상 (1) `developer` 는 spec read-only 라 spec 갱신을 `project-planner` 가 별도 plan 으로 수행(`plan/complete/spec-update-notifications-firing.md`), (2) `project-planner` 는 spec 쓰기 전 `/consistency-check --spec` 의무 → 그 산출물(`review/consistency/...` 디렉터리 전체)이 커밋에 포함된 것이다. 이는 "의도 이상의 변경"이 아니라 SoT 갱신 + 검증 게이트를 같은 PR 에 담으라는 규약(`spec-update-notifications-firing.md` 자체 완료조건에도 "spec §1.1/§5.1/Rationale + 코드/테스트 반영, consistency BLOCK:NO" 로 명시)의 정상 산출이다.
  - 제안: 조치 불요. 다만 `review/consistency/**` 산출물이 매 spec 변경마다 커밋에 영구 누적되는 것은 저장소 위생 관점에서 별개 논의거리일 수 있으나(scope 밖), 이번 커밋 자체의 문제는 아니다.

- **[INFO]** `spec/data-flow/8-notifications.md`, `spec/2-navigation/9-user-profile.md` 의 spec 산문 변경이 커밋 메시지가 표방하는 "channel in_app 하향"의 직접 반영 범위를 벗어나지 않음
  - 위치: `spec/data-flow/8-notifications.md` §1.1 team_invite 행 + 신설 Rationale "team_invite 채널 — 이메일 중복 회피", `spec/2-navigation/9-user-profile.md` §5.1 각주
  - 상세: 두 diff 모두 이번 결정(channel both→in_app)의 근거·대안 (a)/(b)/(c) 기각 사유만 서술하며, 결정과 무관한 다른 섹션·다른 알림 타입(`execution_failed`, `schedule_failed` 등)에는 손대지 않았다. `8-notifications.md` §1.1 표의 `execution_failed`/`schedule_failed` 행은 diff 에 나타나지 않아 그대로다.
  - 제안: 조치 불요.

- **[INFO]** consistency-check SUMMARY 가 언급한 인접 spec drift(§11.2 dedup 서술, data-model §2.19 Enum, §12.1 dismiss endpoint)는 이번 커밋에서 건드리지 않음 — scope 준수 확인
  - 위치: `review/consistency/2026/07/06/20_57_56/SUMMARY.md` "후속" 절
  - 상세: cross_spec/convention_compliance checker 가 발견한 WARNING 들(4-integration.md §11.2, 1-data-model.md §2.19, 2-api-convention.md §12.1)은 SUMMARY 자체가 "본 변경과 무관한 기존 drift, 본 plan 범위 밖, 별도 grooming 대상으로 이월" 이라고 명시적으로 처분했고, 실제로 diff 목록(13개 파일)에 해당 spec 파일들은 포함되지 않았다. 스코프 크립 없이 정확히 경계를 지켰다.
  - 제안: 조치 불요 (참고: 이월된 항목들은 `spec-drift-gate-backlog` 계열로 추적 중이라는 사용자 메모리와도 일치).

- **[INFO]** 테스트 파일 변경이 정확히 실질 변경에 대응하는 최소 diff
  - 위치: `workspace-invitations.service.spec.ts` (2줄 diff: describe 제목 텍스트, `channel` 단언 값)
  - 상세: 새 테스트 케이스 추가나 무관한 테스트 리팩토링 없이, 기존 단언값을 코드 변경에 맞춰 갱신만 했다.
  - 제안: 조치 불요.

## 요약
이번 커밋은 `team_invite` 알림의 `channel` 을 `both`→`in_app` 으로 하향하는 단일 의도에 정확히 스코프가 고정되어 있다. 실질 코드 변경은 서비스 파일 1곳(값 변경 + 관련 docstring/주석 갱신)과 대응 테스트 단언 2곳뿐이며, 함께 포함된 11개 부속 파일(plan 완료 이동, consistency-check 5개 checker 산출물 + SUMMARY/meta/retry-state, spec 문서 2곳의 대상 섹션 각주/Rationale)은 모두 CLAUDE.md 가 명시한 SDD 라이프사이클(spec read-only developer → planner 위임 → consistency-check 의무 → plan 완료 이동)이 요구하는 필수 동반 산출물이지 임의로 추가된 범위 확장이 아니다. consistency-check 가 발견한 인접 spec drift 도 이번 변경과 무관하다고 명시적으로 판별해 손대지 않고 이월 처리했다. 포맷팅/불필요 리팩토링/무관 임포트/설정 변경/기능 확장 등 스코프 이탈 징후는 발견되지 않았다.

## 위험도
NONE
