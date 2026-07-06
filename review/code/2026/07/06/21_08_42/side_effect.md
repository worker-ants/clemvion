# 부작용(Side Effect) 코드 리뷰

- 커밋: `56c72ba9f7834782184da3fbd1d8ad9011adc719`
- 제목: `feat(notifications): team_invite channel in_app 하향 — 초대 이메일 중복 회피`

## 리뷰 대상 파일

1. `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts` (테스트, 단언값 갱신)
2. `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` (코드, `channel: 'both'` → `'in_app'` + docstring/주석)
3. `plan/complete/spec-update-notifications-firing.md` (신규 plan 완료 문서)
4. `review/consistency/2026/07/06/20_57_56/*` (신규 consistency-check 산출물 8개 파일)
5. `spec/2-navigation/9-user-profile.md` (§5.1 각주 추가)
6. `spec/data-flow/8-notifications.md` (§1.1 team_invite 행 + Rationale)

## 발견사항

- **[INFO]** 알림 이메일 발송 경로에서 `team_invite` 가 제외됨 (의도된 동작 변경)
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:1023` (`channel: 'in_app'`)
  - 상세: `NotificationsService.notify()` 가 적재하는 record 의 `channel` 값은 이후 별도 배치/트리거(`r.channel === 'email' || r.channel === 'both'`, `notifications.service.ts:348` 부근)가 읽어 알림 이메일 발송 여부를 결정한다. `'both'` → `'in_app'` 로 하향하면 이 record 는 이메일 발송 대상에서 제외된다. 이는 커밋 메시지·docstring·spec Rationale 에 명시된 의도된 동작 변경이며, 초대 링크 이메일(`dispatchEmail`/`MailService.sendWorkspaceInvitationEmail`)이 이메일 채널을 단독 담당하도록 재배치한 것이다. 사이드이펙트 관점에서는 "숨겨진" 변경이 아니라 문서화된 정책 변경이므로 문제는 아니지만, 이 record 를 소비하는 다른 표면(알림 센터 리스트/필터, 향후 사용자별 채널 on/off 설정 UI 등)이 `channel` 값에 의존해 다른 동작을 분기한다면 함께 점검이 필요.
  - 제안: 없음 (정보성). `NotificationsService.notify()` 를 소비하는 다른 트리거 소스(`execution_failed`, `schedule_failed` 등)는 여전히 `channel: 'both'` 를 유지하는지 재확인 권장 — 본 diff 범위 밖이라 직접 확인은 생략했으나, grep 결과 `notifications.service.ts` 자체는 미변경이므로 다른 발사원의 동작에는 영향 없음.

- **[INFO]** 리터럴 값 변경만 있고 함수 시그니처/인터페이스는 불변
  - 위치: `workspace-invitations.service.ts` `dispatchTeamInviteNotification` (라인 1007-1032)
  - 상세: 메서드 시그니처(`private async dispatchTeamInviteNotification(userId, workspaceId, workspaceName, inviterName, invitationId): Promise<void>`), 호출부(`invite()` 내 호출 방식), try/catch best-effort 삼킴 구조 모두 이전과 동일. `notificationsService.notify(...)` 에 전달하는 객체 리터럴의 `channel` 필드 값만 `'both'`→`'in_app'` 로 바뀜. 외부 호출자(다른 서비스/컨트롤러)에 영향을 주는 public API, 전역 상태, 파일시스템, 환경변수, 이벤트 발생 방식의 변경은 없음.
  - 제안: 없음.

- **[INFO]** 테스트 변경은 프로덕션 코드 변경과 1:1 대응
  - 위치: `workspace-invitations.service.spec.ts:277, 301`
  - 상세: 테스트명과 단언(`channel: 'in_app'`)이 프로덕션 코드의 리터럴 변경과 정확히 동기화됨. mock 구조(`repo()`, `buildDataSource`, `notifications.notify` mock)는 변경되지 않아 다른 테스트 케이스(`best-effort` 실패 허용, `신규 미가입 이메일 미발사` 등)의 동작에 영향 없음.
  - 제안: 없음.

- **[INFO]** 신규 파일 다수는 문서/plan/review 산출물이며 실행 코드 부작용 없음
  - 위치: `plan/complete/spec-update-notifications-firing.md` (신규), `review/consistency/2026/07/06/20_57_56/*` (신규 8개), `spec/2-navigation/9-user-profile.md`, `spec/data-flow/8-notifications.md`
  - 상세: 모두 마크다운/JSON 산출물 추가 또는 각주 삽입으로, 런타임 상태·전역 변수·파일시스템 부작용(코드 실행 관점)·네트워크 호출·이벤트/콜백과 무관. `plan/complete/*.md` 신설 및 `review/consistency/**` 산출물은 프로젝트 컨벤션(CLAUDE.md 의 저장 위치 규칙)에 부합하는 정상적인 워크플로 산출물.
  - 제안: 없음.

- **[INFO]** 환경변수/네트워크 호출/전역 상태 변경 없음
  - 상세: 본 diff 전체에서 `process.env` 읽기/쓰기, 신규 외부 서비스 호출, 전역 변수 도입/수정, 콜백 등록 방식 변경은 관찰되지 않음. `notify()` 호출은 기존과 동일하게 workspace-invitations 흐름 내부에서 best-effort(예외 삼킴)로 유지됨.

## 요약

이번 변경은 `WorkspaceInvitationsService.dispatchTeamInviteNotification` 이 생성하는 알림 record 의 `channel` 리터럴 값을 `'both'` 에서 `'in_app'` 으로 낮춘 것이 전부다. 함수 시그니처, 호출 관계, 트랜잭션/best-effort 예외 처리 구조는 모두 그대로이며, 파일시스템·환경변수·전역 상태·네트워크 호출·이벤트/콜백 발생 방식에도 변경이 없다. 유일한 실질적 부작용은 `NotificationsService` 의 이메일 발송 배치가 이 record 를 더 이상 이메일 발송 대상으로 처리하지 않는다는 점인데, 이는 커밋 메시지·spec Rationale·docstring 에 명시적으로 문서화된 의도된 정책 변경(초대 링크 이메일과의 중복 회피)이며 테스트도 이에 맞춰 정확히 동기화되었다. 그 외 plan/consistency-review 산출물 및 spec 문서 추가는 문서성 변경으로 실행 코드에 부작용을 일으키지 않는다.

## 위험도

NONE
