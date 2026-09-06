# Rationale 연속성 검토

## 검토 범위 메모

`scope(spec/5-system)` 델타는 0개 파일(정상 — 이 브랜치는 spec 을 건드리지 않았다).
프롬프트에 실린 `## 구현 변경 사항` diff 는 예산 초과로 절단되어 있었으므로, 워킹트리를
절대경로로 직접 열어 `git diff origin/main -- codebase/ spec/` (33파일)을 1차 근거로 썼다.
확인 결과 spec 델타 0은 실제와 일치했고, 코드 diff 는 `codebase/backend/src/modules/schedules/*`
· `codebase/backend/src/modules/triggers/*` · `codebase/backend/src/shared/testing/*` ·
`codebase/backend/src/repo-guards/__tests__/*` 에 집중된 §5.4 응답-계약 스윕(트리거/스케줄
secret 스트립 + 계약 대조 확장)이었다.

## 발견사항

- **[INFO]** `secret-store.md §1` 의 "노출 창이 아직 설계대로 닫혀 있지 않다" 서술이 이
  브랜치 머지 후 stale 해진다
  - target 위치: 구현 diff 전체 (`codebase/backend/src/modules/triggers/triggers.service.ts`
    의 `TRIGGER_RESPONSE_STRIP_COLUMNS`/`deleteSecretColumns` +
    `codebase/backend/src/modules/schedules/schedules.controller.ts` 의 `toResponse`)
  - 과거 결정 출처: `spec/conventions/secret-store.md` §1 "비대상 —
    `Trigger.notification_secret_v2`" 블록, 문장: *"노출 창은 아직 설계대로 닫혀 있지
    않다. 정책상 평문이 나가는 자리는 rotate 응답 1회지만, 현행 구현은
    `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`(트리거 조인) 응답에도 이 컬럼을
    그대로 싣는다."*
  - 상세: 이 문장은 "아직 닫히지 않은 상태"를 현재형으로 서술하는데, 본 PR 의
    `sanitizeForResponse`(엔티티 컬럼 스트립) + `SchedulesController.toResponse`(트리거
    참조 4필드 축소)가 정확히 그 노출 경로 두 곳을 닫는다. 코드와 Rationale 문장이
    당장은 어긋나지만, **이것은 이 PR 이 만든 결함이 아니라 이 PR 이 해소하는 대상이다** —
    같은 문장을 planner 가 스스로 썼고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 "`secret-store.md §1` 의 '노출 창이 아직 닫혀 있지 않다' 가 낡는다"
    (`review/consistency/2026/09/05/21_40_38` W2 근거)라는 미해결(`- [ ]`) 항목으로 이미
    등재돼 있다. developer 는 spec 쓰기 권한이 없어(정당한 역할 분리) 이 문장을 직접
    고치지 않았고, 대신 같은 plan 파일의 별도 항목(`19_59_16` Critical 1)을 `[x]` 로
    닫으며 "확인 후 닫는다" 절차를 그대로 따랐다 — 결정 번복이 아니라 결정의 **이행**이다.
  - 제안: 다음 planner 턴에서 (1) 위 plan 항목을 소비해 `secret-store.md §1` 에 "이 창은
    `<본 PR/커밋>` 로 닫혔다" 정정 이력을 §7.1 정정 패턴과 동일하게 추가하고, (2) 문장을
    과거형("~까지는 닫혀 있지 않았다")으로 바꾼다. 규범(§1.1, "저장 위치 예외 ≠ 노출
    예외")은 그대로 유지 — 이번 정정 대상은 상태 서술 한 문장뿐이다.

## 정합성이 확인된 주요 지점 (참고용 — 위반 아님)

아래는 diff 가 기존 Rationale 을 정확히 인용·준수하고 있음을 교차 확인한 항목이다 (발견사항이
아니라 검토 근거로 남긴다):

- **§5.4 "부재 표현" 규칙 준수**: `ScheduleDto.trigger`(상시 존재 → `@ApiProperty`,
  키 생략 아님)와 `trigger.workflow`/`TriggerDto.workflow`(§5.4 기준 (b), 생성 응답에만
  부재 → `@ApiPropertyOptional()` + `field?: T`, `| null` 미사용)의 표현 선택·DTO 선언
  형태가 `2-api-convention.md §5.4` 표와 정확히 일치한다.
- **`secret-store.md §1.1`("비대상 등재는 저장 위치 예외이지 노출 예외가 아니다") 시행**:
  `notificationSecretV2`/`chatChannelTokenV2` 컬럼 스트립, `config.notification.signing`
  (secret/secretRef) 스트립, `config.interaction.triggerToken` 스트립 — §1.1 이 열거한
  응답 비노출 대상과 diff 의 스트립 목록이 일치한다.
- **"컬럼 수준 `select:false` 미채택" 원칙 준수**: `secret-store.md §1.1` 의 "회전 승격/정리
  스윕이 그 컬럼을 읽으므로 `select:false` 는 조용한 오작동을 만든다"는 근거를 diff 의
  `TRIGGER_RESPONSE_STRIP_COLUMNS` 주석이 그대로 재인용하며 응답 경계 스트립(엔티티 자체는
  불변)을 택했다.
- **`3-error-handling.md`/`2-api-convention.md §5.3` CWE-209 원칙 준수**: 신설된
  `SchedulesController.toResponse` 의 500 분기가 원문 에러를 응답 바디에 싣지 않고
  (`this.logger.error` 로만 진단 정보 기록), 클라이언트에는 spec 이 못박은 고정 문구
  ("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")를 정확히 그대로 반환한다.
- **자기 참조적 연속성 관리**: 이 diff 를 만든 9개 커밋 각각이 직전 리뷰 라운드의 W#/Critical#
  을 이름으로 인용하며 정정하고 있고(예: `notification.signing` 누락 → `interaction.triggerToken`
  누락 → CWE-209 재도입 → 수정, 순차 자기 반증·정정), `plan/in-progress/spec-draft-nullable-notation-followups.md`
  가 "같은 병이 세 라운드 연속 났다"를 스스로 기록하고 후속 항목(선언적 SoT 전환,
  열린 map e2e 의무화)으로 남겼다. 이는 "결정 번복 시 새 Rationale 동반" 원칙을 모범적으로
  따르는 패턴이다.
- 위 항목 외에 **기각된 대안의 무단 재도입**, **합의 원칙 위반**, **암묵적 invariant 우회**로
  분류할 사례는 발견되지 않았다.

## 요약

이번 diff(§5.4 응답-계약 스윕 — 트리거/스케줄 secret 스트립 + 계약 대조 확장)는 기존 spec
Rationale 을 위반하기는커녕, `secret-store.md §1.1`·`2-api-convention.md §5.4`·
`3-error-handling.md` CWE-209 원칙이 요구하는 바를 정확히 인용하며 구현한 사례다. 특히 이
PR 은 이전 rationale-continuity 검토(`review/consistency/2026/09/05/19_59_16` Critical 1)가
지적한 "트리거 회전 secret 이 응답에 노출된다"는 문제 자체를 닫는 수정이며, plan 파일에서
해당 Critical 항목을 절차대로 `[x]` 처리했다. 유일하게 남는 것은 `secret-store.md §1`의
"노출 창이 아직 닫히지 않았다"는 현재형 문장이 이 머지로 인해 stale 해진다는 점인데, 이는
이미 plan 에 후속 planner 작업으로 등재돼 있어 새로운 위험이 아니라 알려진 문서 지연이다.

## 위험도
LOW
