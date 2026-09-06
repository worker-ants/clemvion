# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 개요

- Target: `spec/5-system/` — 이 브랜치(`sweep-response-contract-5ba0ad`, 워크트리명과 plan 문서가
  가리키는 브랜치명이 일치)의 `origin/main` 대비 spec 델타는 **0개 파일**. 실제 diff 는
  `codebase/backend`(triggers/schedules 응답 DTO·서비스·컨트롤러, `swagger-dto-contract-guard`,
  `response-contract.ts`, `schedule-trigger-ref.ts`, e2e 34개)와
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(+220줄)로 구성된다.
- 대조한 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 응답-계약 스윕
  + 트리거 시크릿 스트립 추적, 전문 확보) · `plan/in-progress/spec-draft-notification-secret-storage.md`
  · `plan/in-progress/spec-draft-api-convention-verifier-registration.md` (직접 Read 로 확인).
- 코드(diff)와 `spec-draft-nullable-notation-followups.md` 의 라운드별 기록(스윕 1차 18개 DTO,
  `TriggerDto`/`ScheduleDto` secret strip, §5.4 금지 조합 자기반박·정정 등)을 대조한 결과 **매우
  높은 정합성**을 확인했다 — 코드 커밋 해시(`dfb2664af`·`cb17f0870`·`a6f582680`·`e018a176f` 등)가
  plan 체크박스가 인용하는 것과 일치하고, 새로 추가된 `TRIGGER_RESPONSE_STRIP_COLUMNS`/
  `NOTIFICATION_SIGNING_STRIP_KEYS`/`INTERACTION_RESPONSE_STRIP_KEYS` 세 축은 plan 이 "결정
  보류, 당장은 수기 deny-list 유지" 라고 명시한 그대로다 — 미해결 결정(`@Sensitive()` 데코레이터
  전환)을 우회하지 않았다.
- 아래 한 건을 제외하고는 target-plan 간 구조적 충돌·선행 미해소·후속 누락을 찾지 못했다.

---

## 발견사항

- **[WARNING]** target 내 EIA §7.1 의 "미해결 결함" 서술이 이 브랜치 자신의 수정으로 이미
  거짓이 됐는데, 그 갱신을 추적하는 plan 항목이 secret-store.md 만 지목하고 EIA §7.1 은
  빠뜨렸다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 (`## 7.1 Trigger 엔티티
    확장` 블록의 "정정 이력 (2026-09-05)" 하위 blockquote) — *"**현재 이 컬럼은 응답에도
    나간다** — `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`(트리거 조인)가 엔티티를
    그대로 반환하는데 컬럼 스트립이 없다. 이는 **미해결 결함**이며 … `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 가 수정을 추적한다."*
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목
    - `[x]` **완료** 항목 — "트리거 회전 secret 이 응답에 나간다 — 유출 차단 코드"
      (developer). *"완료 — 이 브랜치가 그 수정이다 (`dfb2664af` · `cb17f0870` · `a6f582680`)."*
    - `[ ]` **미완료** 항목 — "`secret-store.md §1` 의 '노출 창이 아직 닫혀 있지 않다' 가
      낡는다" (planner). *"그 브랜치가 머지되는 순간 현재형 서술이 거짓이 된다 → §7.1 이 쓴
      '정정 이력' 패턴을 준용해 '이 창은 #… 로 닫혔다' 와 커밋 참조를 추가한다."*
  - 상세: 실제 코드(`triggers.service.ts` diff)를 확인한 결과 `TRIGGER_RESPONSE_STRIP_COLUMNS
    = ['notificationSecretV2', 'chatChannelTokenV2']` 와 `deleteSecretColumns()` 가 신설돼
    `sanitizeForResponse` 가 두 컬럼을 응답 경계에서 지운다(스케줄 컨트롤러의 트리거 조인도
    참조 필드로 좁혀짐) — 즉 EIA §7.1 이 "미해결" 이라고 못박은 그 결함이 **이 PR 로 해결됐다**.
    그런데 위 두 번째 plan 항목(갱신 담당)은 문구상 **`secret-store.md §1` 만** 지목한다 —
    그 문장을 쓴 planner 턴(`spec-draft-notification-secret-storage.md`)이 `secret-store.md`
    에 blockquote 를 넣을 때 **같은 문구를 EIA §7.1 에도 그대로 복붙**했기 때문에(현재
    저장소에서 두 위치가 문자 그대로 대응), 나중에 이 plan 항목만 보고 `secret-store.md` 만
    고치면 EIA §7.1 의 "미해결 결함" 서술은 **target(spec/5-system) 안에 그대로 남아 거짓
    서술이 된다**. 직전 검토 라운드(`review/consistency/2026/09/06/01_13_51/plan_coherence.md`)
    도 이 지점을 지나쳤다 — "§1.1·§7.1 관련 후속 항목은 target(spec/5-system) 범위 밖" 이라고
    적었는데, §7.1 은 정확히 `spec/5-system/14-external-interaction-api.md` 안에 있어 그
    스코프 판단 자체가 틀렸다.
  - 제안: plan 갱신. `spec-draft-nullable-notation-followups.md` 의 해당 `[ ]` 항목 제목·본문에
    `14-external-interaction-api.md §7.1` 을 **명시적으로 추가**해, 다음 planner 턴이 두 위치를
    한 커밋에서 함께 정정하도록 한다(§7.1 은 두 신설 코드 커밋 해시를, secret-store.md §1 은
    그 자신의 blockquote 를 각각 "이 창은 closed" 로 바꾸는 형태 — §7.1 이 이미 쓴 "정정 이력"
    패턴 그대로). target(spec/5-system) 자체는 이번 PR 범위에서 변경 불필요(developer 는 spec
    쓰기 권한 밖) — 다음 planner 턴의 실행 범위 문제다.

---

## 참고 (충돌 아님 — 정상 추적 확인)

- `secret-store.md §1.1`("비대상 등재는 저장 위치 예외이지 노출 예외가 아니다")·EIA §7.1 의
  "미해결 결함" 지정 자체는 이 PR 이전에 이미 성문화된 규범이고, 이 PR 의 코드가 정확히 그
  규범을 시행한다 — 규범과 코드 사이의 충돌은 없다. 문제는 오직 그 규범 문서 쪽의 "아직
  안 닫혔다" 는 **현재형 서술**이 낡는다는 점뿐이다.
- "User 엔티티 컬럼 수준 방어" · "트리거 비밀 스트립 declarative SoT 전환" · "열린 `config`
  맵 비밀의 e2e 동반을 규약에 명시" 등 plan 에 남은 "결정 필요"/미완료 항목에 대해, 코드가
  그 결정을 선점하거나 우회한 흔적 없음 — 전부 plan 이 명시한 대로 "이번 PR 범위 밖" 으로
  남겨졌다(플랜 스스로 그 유보를 근거와 함께 적어 둠).
- `2-api-convention.md §5.4` "검증 층" 소절·`code:` 등재는 이미 `[x]` 로 완료 기록돼 있고
  target frontmatter 와 대조해 일치함을 확인(전 라운드 확인 사항 재확인, 이번 라운드에서
  달라진 것 없음).
- `plan/in-progress/spec-draft-notification-secret-storage.md` ·
  `plan/in-progress/spec-draft-api-convention-verifier-registration.md` 두 planner-턴 plan 은
  내용상 완결돼 있고(체크박스 없이 Rationale 로 종결) `spec-draft-nullable-notation-followups.md`
  의 `[x]` 항목들이 그 완료를 인용한다 — 다만 두 파일 모두 frontmatter `status: in-progress`
  로 남아 `plan/complete/` 로 옮겨지지 않았다. target 정합성 문제는 아니고 plan lifecycle
  위생(별도 관심사)이라 INFO 로도 올리지 않는다.

---

## 요약

이 브랜치는 `spec/5-system/` 자체를 변경하지 않고, 그 spec(§5.4 응답-계약, EIA §7.1 이 지정한
시크릿 비노출 요구)이 요구하는 것을 코드로 이행하는 스윕이며, 진행 추적 plan
(`spec-draft-nullable-notation-followups.md`)과 코드 diff 사이의 정합성은 라운드·커밋 해시
단위로 매우 촘촘하게 확인된다. 유일하게 발견한 문제는 이 PR 자신이 만든 것이다 — 이 PR 이
EIA §7.1 이 "미해결 결함" 이라 못박은 시크릿 노출을 실제로 닫았는데, 그 사실을 spec 에 반영할
후속 planner 항목이 `secret-store.md §1` 만 지목하고 (문구가 문자 그대로 복제된) EIA §7.1 은
빠뜨려서, 다음 planner 턴이 그 항목만 따라가면 target(spec/5-system) 안에 거짓이 된 "미해결
결함" 서술이 그대로 남을 위험이 있다. 이번 PR 범위에서 조치할 필요는 없고(spec 쓰기는
developer 권한 밖), 후속 plan 항목의 스코프만 넓히면 된다.

## 위험도

LOW
