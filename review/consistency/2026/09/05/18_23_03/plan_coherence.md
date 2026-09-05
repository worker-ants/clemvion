# Plan 정합성 검토 — §5.4 스윕 1차 (트리거/스케줄 secret 유출 수정 + 응답-계약 검증자 확대)

검토 대상 diff: `dfb2664af` (fix(backend): 트리거 회전 secret 이 두 경로로 나가고 있었다 —
§5.4 스윕 1차). target 문서 `spec/5-system/` 자체의 델타는 0(정상 — 코드 전용 PR)이므로,
이 diff 가 `plan/in-progress/**` 의 진행 중 결정·후속 항목과 정합한지를 중심으로 검토했다.
diff 는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 직접 수정하므로 그
문서를 1차 대상으로, 인접 문서(`spec-draft-api-convention-verifier-registration.md`)를
교차 확인했다.

## 발견사항

- **[WARNING]** `종결 조건` 요약 표가 같은 커밋에서 갱신된 본문과 어긋난다 — 자신이 예고한 "세 번째 낡음"
  - target 위치: (해당 없음 — spec/5-system 델타 0. plan 문서 내부 정합성 이슈)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 본문
    "§5.4 drift 배치 — 2단계"(라인 ~331~421, 이번 커밋이 "스윕 1차 4→18개 DTO" 문단을
    새로 추가) vs 하단 `## 종결 조건` 표 행(라인 ~728, 이번 커밋이 건드리지 않음)
  - 상세: 이번 커밋이 본문에 추가한 내용은 "4개 → **18개 DTO** 배선, 26건 drift 발견(그중
    2건 보안), 잔여는 '41개'가 아니라 세 갈래(중첩 전용 DTO/e2e 미도달/매퍼 누락)"라고
    최신 상태를 정확히 반영한다. 그런데 같은 파일 하단 `## 종결 조건` 표의 동일 항목 행은
    커밋 이전 문구 그대로 "**4개** DTO 가 배선됐다... §5.4 관련 필드를 가진 응답 DTO **60개
    중 56개**"로 남아 있다 — 18개 배선·26건 drift 사실과 정면으로 다른 숫자다. 더 나쁜 것은,
    바로 위에 문서 자신이 **이 정확한 실수를 이미 두 번 지적받았다고 적어 두었다는 점**이다:
    "아래 표에 개수를 적지 않는다. 이 자리에 '열려 있는 것은 N개'라고 쓴 문장이 **두 번
    연속 낡았다**... 개수는 `## 후속`의 미체크 체크박스가 단일 진실이고, 이 표는 그중 열린
    것의 성격만 적는다." 이번 커밋은 본문(단일 진실이어야 할 체크박스 영역)은 갱신했지만
    그 옆 요약 표는 다시 방치해, 문서가 스스로 경고한 패턴이 세 번째로 재현될 조건을
    만들었다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 하단 표 행에서
    "4개 DTO"·"60개 중 56개" 같은 구체 수치를 빼고 "본문 §스윕 1차 참조"로 포인터만
    남기거나(문서 자신의 가이드라인과 일치), 정확히 갱신한다면 본문의 단서("41개가 아니라
    상한치")까지 함께 옮겨 두 자리가 다시 어긋나지 않게 한다.

- **[INFO]** 새 secret-strip 결정이 같은 문서의 미해결 `User` select:false 결정과 같은 축인데 상호 참조가 없다
  - target 위치: (해당 없음 — 코드 diff, `codebase/backend/src/modules/triggers/triggers.service.ts` / `schedules.controller.ts`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 ~276-296
    (`User` 엔티티에 컬럼 수준 방어를 둘지 결정 — 아직 미착수, "전수 열거가 선행돼야 한다"고
    명시)
  - 상세: 미해결 항목은 `select: false` 를 걸면 로그인·2FA·비밀번호 재설정 등 여러 쿼리가
    `addSelect` 를 빠짐없이 넣어야 하고, 하나라도 놓치면 "fail-silent"(값이 `undefined`가
    되지만 예외는 없음)로 인증이 조용히 깨질 위험이 있어 착수하지 않았다고 적혀 있다. 이번
    커밋은 `TriggerDto`/`ScheduleDto` 의 `notificationSecretV2`/`chatChannelTokenV2` 유출을
    고치면서 **같은 이유로 `select: false` 를 명시적으로 기각**했다("로테이션 스윕이 이
    컬럼들을 읽어 승격·정리하므로 컬럼 수준에서 끄면 그 경로가 undefined 를 받고 예외 없이
    조용히 오작동한다") — 다른 엔티티(Trigger/Schedule)에 대한 결정이라 `User` 항목과
    직접 충돌하지는 않지만, 정확히 같은 근거 구조를 사용한 실측 선례가 하나 더 쌓인
    것인데 두 자리가 서로를 가리키지 않는다.
  - 제안: `User` 미해결 항목에 이번 트리거/스케줄 사례를 선례로 한 줄 링크해 두면, 다음에
    그 결정을 내릴 때 "같은 클래스의 위험이 이미 한 번 실증됐다"는 근거를 재도출하지 않아도
    된다. 충돌은 아니므로 CRITICAL 은 아니고, 갱신 누락 정도의 INFO.

## 요약

target(`spec/5-system/`) 자체는 이 PR 에서 변경되지 않았고(정상), §5.4 검증자를 spec 의
`code:` 로 등재하는 선행 plan(`spec-draft-api-convention-verifier-registration.md`,
PR #1289)은 이미 `origin/main` 에 반영되어 이번 스윕의 전제 조건을 충족한 상태다. 이번
커밋이 직접 수정한 `spec-draft-nullable-notation-followups.md` 는 새로 발견한 잔여 항목
(CanvasSaveResultDto·IntegrationDto.consecutiveNetworkFailures·§5.4 스윕 2차)을 체크박스로
빠짐없이 등재해 "후속 항목 누락" 관점에서는 양호하다. 다만 같은 파일 하단의 `## 종결 조건`
요약 표가 본문 갱신을 따라가지 못해, 문서 자신이 이미 두 차례 경고한 stale-count 패턴이
세 번째로 재현되는 상태로 남았다 — 결정 자체를 뒤집는 문제는 아니지만 plan 추적 신뢰성을
갉아먹는 구조적 반복이라 WARNING 으로 기록한다. 그 외 미해결 결정과의 직접 충돌이나 선행
plan 미해소는 발견되지 않았다.

## 위험도

LOW
