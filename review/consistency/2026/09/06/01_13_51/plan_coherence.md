# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 개요

- Target: `spec/5-system/` (이 브랜치의 diff 로는 **델타 0** — 이미 `origin/main`(983fd0ade·9a9c024a6)에 반영된 상태를 그대로 유지)
- 실제 diff: `codebase/backend` DTO/컨트롤러/서비스/검증자 32파일 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 193줄 변경
- 대조 대상 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 스윕 추적), `plan/in-progress/spec-sync-auth-gaps.md`(1-auth.md 미구현 항목)

두 plan 문서 모두 이 브랜치가 진행하는 작업(§5.4 응답-계약 스윕, 트리거 시크릿 스트립)을 라운드별로 매우 상세히 추적하고 있고, target(`1-auth.md`, `2-api-convention.md`)이 이미 "완료" 로 기록된 항목(§5.4 "검증 층" 소절 신설, `code:` 등재, 계정 잠금 알림 문구 제거 등)과 실제로 부합함을 확인했다. 아래 한 건을 제외하고는 target-plan 간 구조적 충돌을 찾지 못했다.

---

## 발견사항

- **[WARNING]** `ScheduleDto.trigger` wire 형태에 대한 plan 자체 기록이 두 갈래로 갈리고, 그중 하나가 실제 코드와 반대다 — 이 기록이 target(`spec/2-navigation/3-schedule.md`) 후속 문서화의 유일한 근거다
  - target 위치: `spec/5-system/2-api-convention.md §5.4`("키 생략은 (a)/(b) 중 하나에 해당할 때만 쓰고, 그 필드를 문서화하는 절에 사유를 명시") — 이 규칙이 요구하는 문서화 작업의 1차 출처가 아래 plan 기록이다.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    - L474-477: *"부수: `ScheduleDto.trigger` 의 wire 형태를 **키 생략**으로 확정했다(종전 `null` 을 내보내 §5.4 를 반대 방향으로 어겼다). `POST /api/schedules` 는 `isActive` 값과 무관하게 `trigger` 를 실어 보낸다 — 종전에는 `isActive: false` 면 트리거를 만들어 놓고 응답에서만 빠졌다."*
    - L807-809 (미완료 체크박스, planner 배정): *"`trigger` 는 상시 존재라 **기본형으로 바꿨고**, `workflow` 는 기준 (b)(선택적 부가 컨텍스트)에 해당해 사유를 필드 주석에 적었다."*
  - 상세: 두 서술이 정반대다 — L474 는 "키 생략(present-when-available)으로 확정" 이라 적으면서 바로 다음 문장에서 "`isActive` 와 무관하게 항상 `trigger` 를 싣는다" 고 설명한다(이건 §5.4 정의상 **기본형**이다, 키 생략이 아니다). L807 은 반대로 "기본형으로 바꿨다" 고 정확히 적는다. 실제 코드(`codebase/backend/src/modules/schedules/schedules.controller.ts` 신설 `toResponse()`)를 대조하면 L807 이 맞다 — `trigger` 가 없으면 `InternalServerErrorException` 을 던질 정도로 **상시 존재**를 불변식으로 강제하고, `list`/`get`/`create`/`update` 네 경로 모두 무조건 `trigger` 키를 채운다(중첩 `trigger.workflow` 만 생성 응답에서 키 생략). 즉 L474 의 "키 생략" 라벨은 사실관계가 틀렸다.
  - 이 오류가 문제가 되는 지점: L807-809 항목("`ScheduleDto.trigger`/`workflow` 를 nav-spec 에 문서화", planner 배정, 아직 `[ ]`)이 나중에 `spec/2-navigation/3-schedule.md §4` 또는 `1-data-model.md §2.9.1` 에 이 wire 형태의 근거를 옮겨 적는 실제 target 갱신 작업이다. 같은 문서 안에 상충하는 두 기록이 남아 있으므로, 그 planner 턴이 L474 를 먼저 읽으면 `ScheduleDto.trigger` 를 "키 생략(present-when-available), 기준 (a) 또는 (b)" 로 잘못 문서화할 위험이 있다 — 그러면 nav-spec 이 실제 wire(`trigger` 상시 존재)와 반대인 규약을 기술하게 되어 §5.4 가 스스로 요구하는 "선언과 실제가 같아야 한다" 를 어기는 문서가 새로 생긴다.
  - 제안: plan 갱신. L474-477 블록의 `**키 생략**` 을 `**기본형(null-present)**` 으로 정정하고(취소선 정정 이력 남김), L807-809 를 정본으로 명시하는 한 줄을 추가해 두 기록이 참조하는 사실이 같다는 것을 명확히 한다. target(spec/5-system)은 이 브랜치에서 손대지 않으므로 변경 불필요.

---

## 참고 (충돌 아님 — 정상 추적 확인)

- `spec/5-system/1-auth.md §1.3`(LDAP/SAML 미구현)과 `plan/in-progress/spec-sync-auth-gaps.md` 의 대응 항목이 일치 — target 이 정확히 그 plan 을 포인터로 인용하고, plan 도 동일하게 미구현으로 기록.
- `spec/5-system/1-auth.md §1.1`(계정 잠금, "알림 없음") — `spec-sync-auth-gaps.md` L244-274 의 처분(§1.1 표에서 이메일 알림 문구 제거)과 부합. stale 되지 않음.
- `spec/5-system/2-api-convention.md §5.4` "검증 층" 소절 — `spec-draft-nullable-notation-followups.md` 의 `[x]` 항목("§5.4 검증자 2종의 역할 경계를 spec 본문에 한 문장으로", "`code:` 에 §5.4 검증자 등재")과 실제 target frontmatter `code:`(swagger-dto-contract*.ts·response-contract*.ts·swagger-probe*.ts) 를 대조 확인 — 일치.
- `secret-store.md §1.1`·`§7.1`(이번 브랜치가 닫는 노출 창) 관련 후속 항목들(§`secret-store.md` 갱신, `4-integration.md §9.1` 포인터 추가 등)은 모두 "이 브랜치 머지 후" 로 명시적으로 조건부 등재돼 있어 선행 미해소가 아니라 **정상적인 순서 대기**다. target(`spec/5-system`) 범위 밖(spec/conventions, spec/2-navigation)이라 이번 검토의 CRITICAL/WARNING 대상은 아니다.
- 아직 열려 있는 "결정 필요" 항목(User 엔티티 컬럼 방어, 트리거 비밀 스트립 선언적 SoT 전환, Flyway `mixed=true` 도입 등)에 대해 target 이 이미 결정된 것처럼 선점하는 서술은 없음 — 충돌 없음.

---

## 요약

이 브랜치는 `spec/5-system/` 자체를 변경하지 않고(이미 선행 커밋에서 반영된 §5.4 검증자·계정 잠금 문구 등을 그대로 유지), 그 spec 이 요구하는 규칙(§5.4 응답 계약)을 코드 쪽에서 이행하는 스윕이다. `plan/in-progress/spec-draft-nullable-notation-followups.md`·`spec-sync-auth-gaps.md` 두 트래커 모두 이 브랜치의 진행 상황을 매우 세밀하게(라운드별 실측·처분·잔여 항목) 반영하고 있고, target 이 이미 "완료" 로 기술한 부분은 실제 코드·frontmatter 와 대조해 정합함을 확인했다. 유일하게 발견한 문제는 target 자체의 결함이 아니라, plan 문서 내부에 `ScheduleDto.trigger` 의 wire 형태(키 생략 vs 기본형)를 정반대로 적은 두 기록이 공존한다는 것이다 — 아직 미완료인 후속 planner 항목(nav-spec 문서화)이 이 기록을 그대로 옮기면 target 계열 문서에 실제와 반대되는 서술이 새로 생길 위험이 있어 WARNING 으로 등재한다.

## 위험도

LOW
