# 요구사항(Requirement) Review — team_invite channel `both`→`in_app` 하향

리뷰 대상 커밋: `56c72ba9f7834782184da3fbd1d8ad9011adc719`
(feat(notifications): team_invite channel in_app 하향 — 초대 이메일 중복 회피)

파일:
1. `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts`
2. `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`
3. `plan/complete/spec-update-notifications-firing.md` (신규, 이동)
4-11. `review/consistency/2026/07/06/20_57_56/*` (증빙 산출물)
12. `spec/2-navigation/9-user-profile.md`
13. `spec/data-flow/8-notifications.md`

## 발견사항

- **[INFO]** 회귀 테스트 커버리지가 견고함
  - 위치: `workspace-invitations.service.spec.ts:278-343`
  - 상세: `channel=in_app` 단언(라인 302), notify 미발사(신규 미가입 이메일, 라인 307-322), notify 실패해도 invite 는 best-effort 로 성공(라인 324-343)까지 세 가지 핵심 분기가 모두 테스트됨. 로컬 재실행 결과 `30/30 passed` — 커밋 메시지의 주장과 일치 확인(직접 `npx jest workspace-invitations.service.spec.ts` 실행, 통과).
  - 제안: 없음(추가 조치 불요).

- **[INFO]** `notify()` 표면과의 계약 정합
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:275,283,348`
  - 상세: `dispatchTeamInviteNotification` 이 명시적으로 `channel: 'in_app'` 을 전달하며, `notify()` 내부 `dispatchEmails` 는 `channel === 'email' || channel === 'both'` 인 경우만 이메일을 추가 발송(라인 348)한다. `in_app` 은 이 조건에 해당하지 않으므로 알림 파이프라인을 통한 이메일은 발송되지 않는다 — 커밋의 의도("이메일은 초대 링크 이메일 1통으로 일원화")와 실제 동작이 정확히 일치.
  - 제안: 없음.

- **[INFO]** spec fidelity — line-level 일치 확인 (CRITICAL 아님)
  - 위치: `spec/data-flow/8-notifications.md:74` (§1.1 `team_invite` 행), `spec/data-flow/8-notifications.md:329-363` (Rationale "team_invite 채널 — 이메일 중복 회피"), `spec/2-navigation/9-user-profile.md:263-270` (§5.1 팀 초대 행 + 각주)
  - 상세: 코드의 `channel: 'in_app'`(`workspace-invitations.service.ts:1024`), docstring(`:999-1007`), 인라인 주석(`:983-985`)이 §1.1 표의 서술("in-app 벨 알림(channel=`in_app`)")·Rationale의 결정 (c) 서술과 함수명(`dispatchTeamInviteNotification`)·필드명(`resourceType: 'workspace_invitation'`, `resourceId: invitationId`) 모두 line-level 로 일치한다. §5.1 각주도 "이메일 발송 주체는 초대 링크 이메일" 이라는 동일한 결정을 재서술하며 모순 없음. Rationale 은 기각된 대안 (a)/(b) 근거까지 구체적으로 남겨 결정의 배경을 추적 가능하게 함.
  - 제안: 없음 — 코드·spec 이 동일 커밋에서 함께 갱신되어 drift 가 발생하지 않음. (SPEC-DRIFT 아님: 코드와 spec 모두 같은 커밋에서 의도적으로 함께 바뀜.)

- **[INFO]** 인접 spec 표류(§11.2, §2.19)는 본 변경과 무관
  - 위치: `review/consistency/2026/07/06/20_57_56/SUMMARY.md` Cross-Spec WARNING #1·#2
  - 상세: consistency-check 산출물이 `spec/2-navigation/4-integration.md §11.2`(dedup 메커니즘 구 서술)·`spec/1-data-model.md §2.19`(Notification.type Enum 3종 누락)의 기존 drift 를 WARNING 으로 이미 식별했고, "본 변경(team_invite channel 하향)과 무관한 기존 drift" 로 명시적으로 처분·이월됨(`spec-drift-gate-backlog` 계열). 본 requirement 리뷰 범위에서 재차 지적할 필요 없음.
  - 제안: 없음(이미 별도 backlog 로 추적 중).

- **[INFO]** best-effort 에러 처리 및 트랜잭션 격리 확인
  - 위치: `workspace-invitations.service.ts:1014-1032`(`dispatchTeamInviteNotification` try/catch), `:976-994`(`invite()` 호출부)
  - 상세: `dispatchTeamInviteNotification` 은 알림 저장 트랜잭션(`saved`)이 커밋된 *이후*, 별도 catch 로 실패를 삼키고 logger.error 만 남긴다. 초대 row 생성이 알림 발사 실패로 롤백되지 않는다는 docstring 의 주장과 실제 코드 흐름이 일치. 신규(미가입) 이메일 초대 시 `existingUser` 가 없어 `if (existingUser)` 분기를 타지 않아 notify 자체가 호출되지 않는 것도 테스트(`:307-322`)로 확인됨.
  - 제안: 없음.

## 요약

이번 변경은 기존 가입자(비멤버) 초대 시 이메일 2통(초대 링크 이메일 + team_invite 알림 이메일)이 중복 발송되던 UX 결함을, `team_invite` 알림 record 의 channel 을 `both` 에서 `in_app` 으로 하향하여 해소한 것으로, 구현(서비스 코드 + 테스트)과 관련 spec 문서(`spec/data-flow/8-notifications.md` §1.1 행 및 신설 Rationale, `spec/2-navigation/9-user-profile.md` §5.1 각주) 가 line-level 로 완전히 일치한다. 검토한 대안 (a)/(b)/(c) 의 기각·채택 근거가 Rationale 에 상세히 남아 향후 재검토 시 맥락을 보존하며, 회귀 테스트가 채널 값·미발사 조건·best-effort 실패 격리까지 모두 커버하고 30/30 로컬 재현 통과했다. plan 문서(`plan/complete/spec-update-notifications-firing.md`)도 결정 반영 후 완료 이동되어 라이프사이클 규약을 준수한다. TODO/FIXME/HACK 성 미완성 표식은 발견되지 않았고, 에러 시나리오(멤버 아닌 초대 대상, notify 실패, 신규 미가입자)는 모두 정의된 대로 동작한다. Critical 또는 Warning 급 결함은 발견되지 않았다.

## 위험도

NONE
