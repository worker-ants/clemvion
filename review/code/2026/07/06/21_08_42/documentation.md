# 문서화(Documentation) Review — team_invite channel in_app 하향

대상 커밋: `56c72ba9f` feat(notifications): team_invite channel in_app 하향 — 초대 이메일 중복 회피

## 발견사항

- **[WARNING]** CHANGELOG.md 미갱신 — 직전 관련 항목("알림 파이프라인 PR3")이 이제 부정확한 서술을 담고 있음
  - 위치: `CHANGELOG.md` 상단 `## Unreleased — 알림 신규 발사 소스 execution_failed·schedule_failed·team_invite (알림 파이프라인 PR3)` 항목, 1번 bullet 끝부분
  - 상세: 저장소 CHANGELOG.md 는 기능 변경마다 `## Unreleased — <제목>` 항목을 추가하는 컨벤션을 일관되게 따른다 (직전 PR1/PR2/PR3 모두 자체 항목 보유). 그런데 본 커밋(PR3 의 team_invite 채널을 `both`→`in_app` 로 정정하는 후속 변경)은 CHANGELOG 를 전혀 건드리지 않았다. 그 결과 기존 PR3 항목의 문장 "세 알림 모두 **인앱 + 이메일**(`channel: 'both'`)" 이 team_invite 에 대해서는 더 이상 사실과 다르다 — 실제로는 `execution_failed`/`schedule_failed` 만 `both` 이고 `team_invite` 는 `in_app` 이다. CHANGELOG 를 읽는 사람(운영자·타 개발자)은 이 서술만 보고 team_invite 도 이메일이 간다고 오인할 수 있다.
  - 제안: 새 `## Unreleased` 항목을 추가하거나 (본 컨벤션 상 일반적인 경로), 최소한 기존 PR3 항목의 team_invite 관련 문구를 "team_invite 는 이후 커밋에서 channel=`in_app` 로 정정됨(초대 링크 이메일과의 중복 회피, 상세는 spec Rationale 참고)" 식으로 각주 처리해 갱신한다.

- **[INFO]** 새 Rationale 섹션 품질 우수 — 특기할 결함 없음
  - 위치: `spec/data-flow/8-notifications.md` 신설 섹션 "team_invite 채널 — 이메일 중복 회피 (channel=`in_app`)"
  - 상세: (a)/(b)/(c) 세 대안을 각각 근거와 함께 기각/채택 서술하고, §5.1 표의 "인앱+이메일" 문구가 여전히 제품 레벨에서 유효한 이유(이메일 발송 주체가 알림 파이프라인이 아니라 초대 흐름으로 이동)까지 명확히 설명한다. 향후 채널 토글(Planned) 구현 시 재검토가 필요하다는 점도 남겨 뒀다. 모범적인 Rationale 작성 사례로 별도 조치 불요.

- **[INFO]** docstring/인라인 주석이 코드와 완전히 일치
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` L163(초대 흐름 코멘트), L182-190(`dispatchTeamInviteNotification` JSDoc)
  - 상세: 코멘트가 `channel='in_app'` 결정의 배경(`dispatchEmail` 이 토큰 담당, 알림 이메일은 토큰 없는 범용 템플릿이라 중복 유발)을 정확히 설명하고, `spec/data-flow/8-notifications.md` Rationale 절 제목까지 인용해 spec 과 코드 간 추적성을 확보했다. 오래된 주석 없음.

- **[INFO]** 테스트 명(`it(...)`) 과 단언이 채널 변경과 함께 정확히 갱신됨
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts` L277, L301
  - 상세: 테스트 제목 문자열 "channel=both" → "channel=in_app" 로 갱신되고 실제 `expect(...).toHaveBeenCalledWith(...)` 의 `channel: 'in_app'` 단언도 함께 바뀌어 테스트 이름과 실제 검증 내용이 어긋나는 흔한 실수가 없다.

- **[INFO]** plan 파일의 완료 이력 서술에 남은 사소한 표현 잔재 — 실질적 영향 없음
  - 위치: `plan/complete/spec-update-notifications-firing.md` "flip 대상" 섹션의 `team_invite` 행: "조건 '기존 가입자(비멤버) 초대 시', channel=both."
  - 상세: 이 문장은 원래 flip 체크리스트 항목이며, 바로 아래 "반영할 결정/주의" 섹션에서 (c) 채택 결정이 상세히 설명되고 마지막 요약 문단도 "완료 조건" 에서 처리 완료를 명시하므로 문서 전체를 읽으면 오독 소지가 낮다. 다만 이 파일은 이미 `plan/complete/` 로 이동된 완료 문서이자 향후 참조되는 히스토리성 기록이므로, 위 flip 대상 행의 "channel=both" 를 "channel=in_app (최종, 아래 결정 (c) 참고)" 로 살짝 정정해두면 이 섹션만 발췌 인용될 때의 혼동을 방지할 수 있다. 우선순위는 낮음(CRITICAL/WARNING 아님) — plan/complete 문서는 히스토리 스냅샷 성격이 강해 필수 수정 대상은 아니다.

- **[INFO]** README 업데이트 불요 확인
  - 상세: 이번 변경은 기존 알림 파이프라인 내부의 채널 값 하나(`'both'`→`'in_app'`)를 정정하는 것으로, 신규 설정·환경변수·공개 API 계약 변경이 없다. `spec/2-navigation/9-user-profile.md` §5.1 각주로 사용자 관점 설명이 이미 반영되었으므로 README(제품 최상위 문서)에 별도 반영할 내용은 없다.

## 요약

이번 변경은 문서화 관점에서 전반적으로 모범적이다 — spec 본문(§1.1 표), 신설 Rationale, 인접 spec 각주(§5.1), 코드 docstring/인라인 주석, plan 완료 문서까지 일관되게 `channel='both'→'in_app'` 변경의 배경과 결정 근거를 촘촘히 남겼고 `/consistency-check --spec` 도 BLOCK:NO 로 통과했다. 유일한 실질적 공백은 CHANGELOG.md 다 — 이 저장소는 기능 변경마다 `## Unreleased` 항목을 남기는 컨벤션을 갖고 있고 바로 직전 PR1/PR2/PR3 항목이 이를 증명하는데, 본 커밋은 그 컨벤션을 따르지 않아 기존 PR3 CHANGELOG 항목의 "team_invite 도 channel=both(인앱+이메일)" 서술이 정정되지 않은 채 남아 사실과 어긋나게 됐다. 이는 차단 사유는 아니나 후속 커밋에서 가볍게 보완하는 것을 권장한다.

## 위험도

LOW
