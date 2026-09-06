# Rationale 연속성 검토

## 검토 방식 메모

`_prompts/rationale_continuity.md` 는 diff 본문(75,759자)과 `spec/5-system/` 의 상당수 파일이
"컨텍스트 예산 초과" 로 절단되어 있었다. 그 경우 프롬프트 지시대로 프롬프트 내용을
근거로 판정하지 않고, 대상 worktree(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`,
현재 세션의 CWD 와 동일)에서 `git diff origin/main...HEAD` 를 직접 절대경로로 재실행해
실제 구현 diff(30파일/1857줄, code 부분)를 확인했다. spec 쪽은 프롬프트에 완전히 실린
`spec/5-system/1-auth.md`(§5.4 인접 없음) 와 `spec/5-system/2-api-convention.md`(§5.4 —
이 diff 의 직접 대상 절)의 `## Rationale` 을 정독했고, 코드가 인용하는
`spec/conventions/secret-store.md §1/§1.1`, `spec/1-data-model.md §2.9.1` 을 worktree
원본에서 추가로 열었다.

## 발견사항

- **[INFO]** `secret-store.md` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치 머지로 낡는다 — 단, 이미 추적 중
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`TRIGGER_RESPONSE_STRIP_COLUMNS`, `sanitizeForResponse`) · `codebase/backend/src/modules/schedules/schedules.controller.ts` (`toResponse`)
  - 과거 결정 출처: `spec/conventions/secret-store.md` §1 "비대상 — `Trigger.notification_secret_v2`" 하위의 `> **노출 창은 아직 설계대로 닫혀 있지 않다.** … 현행 구현은 `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`(트리거 조인) 응답에도 이 컬럼을 그대로 싣는다 … 유출을 닫는 코드 수정은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 추적한다."
  - 상세: 본 diff 는 정확히 그 두 엔드포인트 경로에서 `notificationSecretV2`/`chatChannelTokenV2` 를 응답 경계에서 제거해 그 문장이 지목한 노출 창을 닫는다(구현은 `secret-store.md §1.1` 이 세운 "저장 예외 ≠ 노출 예외" 규범을 그대로 시행 — `select:false` 를 쓰지 않는 이유까지 동일한 근거로 재진술). 코드 자체는 Rationale 을 위반하지 않고 오히려 그 요구를 이행한다. 다만 spec 문서의 현재형 서술("아직 닫혀 있지 않다")은 이 브랜치가 머지되는 순간 사실과 어긋나게 된다. `developer` 는 그 문장을 쓴 당사자가 아니므로(§자기-반증형 소정정 조건1 미충족, 그리고 이는 예고/트리거 문장이 아니라 보안 invariant 서술) 직접 고칠 권한이 없다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 몫 항목("`secret-store.md §1` 의 "노출 창이 아직 닫혀 있지 않다" 가 낡는다", 2026-09-05 등재, `21_40_38` W2)이 등재돼 있고 §7.1 의 "정정 이력" 패턴을 준용하도록 처방까지 적혀 있다. 별도 조치 불요 — 이 브랜치 머지 직후 planner 턴에서 그 항목을 소비해 `secret-store.md §1` 에 "이 창은 `#<PR번호>` 로 닫혔다" 를 추가하면 된다. 이 리뷰는 그 처방이 실제로 필요해졌음을 재확인하는 것으로 충분.

- **[INFO]** `ScheduleDto.trigger`/`workflow` 의 §5.4 키-생략 사유가 코드 주석에만 있고 nav-spec 에는 아직 없음 — 이미 추적 중
  - target 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (`ScheduleTriggerRefDto.workflow` JSDoc)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 "**기본은 `null`** 이다. 키 생략은 (a)/(b) 중 하나에 해당할 때만 쓰고, **그 필드를 문서화하는 절에 사유를 명시**한다."
  - 상세: `workflow` 필드는 기준 (b)(선택적 부가 컨텍스트)에 해당하는 사유가 DTO JSDoc 에는 정확히 적혀 있으나, §5.4 가 요구하는 "그 필드를 문서화하는 절"은 API 규약 문서가 아니라 그 리소스의 nav-spec(`spec/2-navigation/3-schedule.md` 등)을 가리킨다. 그 문서는 아직 갱신되지 않았다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 몫 항목("`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화", `21_40_38` W1)으로 정확히 이 갭이 등재돼 있다. 별도 조치 불요.

## 요약

이 PR 은 `spec/5-system/` 자체를 변경하지 않는 코드 전용 diff이며, 내용은 §1288/§1289/§1290
로 이어져 온 "§5.4 응답-계약" 스윕의 연속이다. 검토 결과 과거 Rationale 을 위반하거나
기각된 대안을 재도입한 지점은 발견되지 않았다 — 오히려 반대로, `secret-store.md §1.1`
이 명시적으로 "아직 닫혀 있지 않다" 고 지목한 두 노출 경로(`GET/POST/PATCH /api/triggers`,
`GET /api/schedules`)를 정확히 그 문서가 요구한 방식(응답 경계에서 스트립, `select:false`
회피)으로 닫는다. `Schedule.trigger_id NOT NULL 1:1` 같은 데이터 모델 invariant, §5.4 의
`null` vs 키 생략 기본형·소급 미적용 규칙, "판정 상세는 코드 JSDoc 이 SoT" 원칙을 모두
정확히 인용하며 따른다. PR 자신의 1차 판이 §5.4 금지 조합(`ApiPropertyOptional` +
`nullable:true`)을 스스로 위반했으나 같은 브랜치 내에서 checker 에 의해 검출·정정되고
양방향 래칫까지 신설했다 — "결정의 무근거 번복" 이 아니라 자기 검증 루프가 정상 작동한
사례다. 유일한 잔여 이슈는 spec 문서(`secret-store.md`)의 서술이 이 코드 변경으로 인해
곧 stale 해진다는 것인데, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 planner 몫 후속 작업으로 정확히 등재돼 있어 새로운 위험이 아니다.

## 위험도

LOW
