# Rationale 연속성 Check — `spec/data-flow/8-notifications.md`

검토 모드: spec draft 검토 (--spec)
target: `spec/data-flow/8-notifications.md` (알림 파이프라인 PR3, 발사 소스 3종 추가 후 상태)

## 조사 방법

1. target 문서 전문(Overview·본문·`## Rationale`)을 완독.
2. payload 에 동봉된 타 spec (`0-overview.md`, `1-data-model.md`, 다수 `2-navigation/*.md`) 의
   `## Rationale` 발췌를 훑어 target 과 교차하는 결정이 있는지 확인 — 직접 교차하는 항목 없음
   (대부분 무관 영역: S3 키 설계, Flyway, 실행 엔진 큐, 대시보드 카드, 트리거 화면 등).
3. `git log --oneline -- spec/data-flow/8-notifications.md` 로 실제 결정 이력 추적, 특히
   최근 3개 커밋(PR1/PR2/PR3, #836·#837·#838)의 diff 를 확인해 target 이 과거 자기 자신의
   Rationale 을 뒤집는지 검사.
4. `team_invite` channel 값(`both`→`in_app`)의 변경 이력을 diff 로 직접 확인하고, 대응하는
   `spec/2-navigation/9-user-profile.md §5.1` 의 상호 참조 주석이 갱신되어 있는지 cross-check.
5. 코드베이스·spec 전체에서 `team_invite` + `both` 잔존 참조를 grep 하여 stale 참조 여부 확인.

## 발견사항

이번 target 에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다. 아래는 검토
과정에서 확인한, 오히려 **모범적으로 처리된 결정 번복** 사례이며 참고용으로 기록한다.

- **[INFO]** `team_invite` channel 하향(`both`→`in_app`) — 정석적인 결정 번복 + 신규 Rationale 사례
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 `team_invite` 행, `## Rationale`
    "team_invite 채널 — 이메일 중복 회피" 항 (라인 74, 329-362 부근)
  - 과거 결정 출처: 같은 문서의 커밋 이력(#838, PR3) — 최초 구현은 `channel='both'` 로 발사해
    `spec/2-navigation/9-user-profile.md §5.1` "팀 초대 = 인앱 + 이메일" 문구를 문자 그대로
    반영했었다. 이 상태에서 기존 가입자가 이메일 2통(초대 링크 이메일 + 토큰 없는 범용 알림
    이메일)을 받는 부작용이 있었고 PR3 커밋 메시지에 "planner 재검토(spec-update)" 로
    명시적으로 이월되어 있었다.
  - 상세: 본 target 은 그 이월된 이슈를 `channel=in_app` 으로 하향 조정하며 대안 (a)/(b)/(c)
    검토와 채택 근거를 `## Rationale` 에 상세히 기술했고, 상위 문서인
    `9-user-profile.md §5.1` 에도 "팀 초대의 '이메일'은 초대 링크 이메일이 담당" 이라는
    상호 참조 주석을 함께 갱신해 두었다 (양방향 정합 확인됨, grep 으로 stale `both` 참조
    없음을 확인).
  - 제안: 조치 불필요. 결정 번복 시 새 Rationale 을 동반하고 참조 문서까지 동기화한 모범
    사례로, 오히려 다른 spec 번복 작업의 참고 템플릿으로 삼을 만하다.

## 교차 검토한 항목 (문제 없음)

- `execution_failed`/`schedule_failed` 의 `channel=both` — PR3 커밋 초안 코드 주석에는
  `channel=in_app` 언급이 있었으나 최종 커밋에서 "channel=both 로 정정(이메일 인프라 PR2
  존재)" 로 스스로 교정되었고, target 최종 상태는 `both` 로 일관되며 §5.1 표와도 부합.
  잔여 drift 없음.
- `dismissed_at` soft-delete, `hasRecentByResource` 의 dismissed row 포함 정책, `visible`/
  `dismissed` 어휘 선택, dismiss endpoint 의 `POST` 채택(`DELETE`/`PATCH` 기각) — 모두 target
  자체의 `## Rationale` 에 대안 비교와 채택 근거가 명시되어 있고, 본문(§3~§4)의 실제 흐름
  기술과 모순되는 곳이 없다.
- WebSocket emit 표기(`notification.new` 점 표기, `notifications:<userId>` 채널) — 상위
  권위 문서인 `spec/5-system/6-websocket-protocol.md §4.4` 및 게이트웨이 코드
  (`VALID_CHANNEL_PREFIXES`)와 일치, §4.6 follow-up 표기와도 일관.
- payload 에 동봉된 타 spec (`0-overview.md`, `1-data-model.md`, 트리거/스케줄/통합 등
  `2-navigation/*.md`) 의 Rationale 은 notifications 도메인과 직접 교차하는 결정이 없어
  기각된 대안의 재도입·원칙 위반 소지가 없다.

## 요약

target `spec/data-flow/8-notifications.md` 는 자기 자신의 `## Rationale` 에 기록된 결정
(soft-delete, dismissed 포함 중복방지, `visible` 어휘, POST dismiss, WS 이벤트 표기,
`team_invite` channel 하향)을 본문 전반에서 일관되게 따르고 있으며, 유일하게 발견된
"결정 번복" 사례(`team_invite` channel `both`→`in_app`)는 새 Rationale 작성 + 상위 문서
(`9-user-profile.md §5.1`) 동기화까지 마친 완결된 처리로, 기각된 대안의 무단 재도입이나
합의 원칙 위반, 무근거 번복에 해당하는 사례는 없었다. Rationale 연속성 관점에서 이 target
은 건전하다.

## 위험도

NONE
