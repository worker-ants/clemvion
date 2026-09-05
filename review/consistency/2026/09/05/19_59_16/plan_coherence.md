# Plan 정합성 검토 — `spec-draft-notification-secret-storage.md`

## 발견사항

- **[CRITICAL]** `notification_secret_v2` 신규 예외의 근거 (3) "1회 노출" 이 현재 브랜치 코드에서 성립하지 않는다 — 실제로는 목록/단건 응답에서 상시 노출된다
  - target 위치: `spec/conventions/secret-store.md §1` "비대상 — `Trigger.notification_secret_v2`" 등재문 근거 (3) ("서버 발급·1회 노출·영향 범위가 트리거 하나 — `wsk_` + `randomBytes(32)` 이고 rotate 응답에만 실린다"). 이 문구는 `plan/in-progress/spec-draft-notification-secret-storage.md` §②·§③ 그대로에서 도출됐고 이미 `790487f34` 로 커밋돼 spec 본문에 들어가 있다.
  - 관련 plan: (a) 같은 브랜치의 `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 — 2단계: 검증자가 없는 응답 DTO 78곳" (미체크 `[ ]`, `TriggerDto`/`ScheduleDto` 는 아직 이 branch 에서 배선되지 않음). (b) 미머지 `claude/sweep-response-contract-5ba0ad` 브랜치의 커밋 `dfb2664af` ("트리거 회전 secret 이 두 경로로 나가고 있었다 — §5.4 스윕 1차") — 바로 이 필드의 wire 유출을 실측·수정한 기록. 이 브랜치는 target draft 가 §③ 에서 이미 인용하고 있는 바로 그 브랜치다(다른 항목 사유로).
  - 상세: 현재 워크트리 코드를 직접 확인했다(브랜치 비교 없이 이 브랜치 단독으로도 성립).
    - `triggers.service.ts` 의 `sanitizeChatChannelForResponse()` 는 `cfg.chatChannel` **JSONB 내부 키만** 스트립하고, `chatChannel` 이 없으면 **조기 return**한다. 엔티티 최상위 컬럼 `notificationSecretV2` 는 어떤 경로로도 스트립되지 않는다.
    - `findAll`/`findOneDetail` 은 raw `Trigger` 엔티티를 `Object.assign` 으로 합쳐 그대로 반환하고, 컨트롤러는 그 값을 그대로 응답한다(`triggers.controller.ts` `findAll`/`findOne` → service 반환값 직행). 전역 `ClassSerializerInterceptor` 없음(grep 0건), 엔티티에도 `select:false`/`@Exclude()` 없음.
    - 즉 rotation grace 기간(24h) 동안 `GET /api/triggers`·`GET /api/triggers/:id` 응답에 평문 `notificationSecretV2` 가 **매 요청마다** 실린다 — "rotate 응답에만 실린다" 는 근거 (3) 과 정면으로 어긋난다. 이 필드를 검증하는 e2e 도 이 branch 에는 없다(`grep notificationSecretV2 test/*.e2e-spec.ts` 0건).
    - 미머지 `claude/sweep-response-contract-5ba0ad` 의 `dfb2664af` 가 **같은 필드**를 두고 정확히 이 유출(+ `ScheduleDto` 조인 유출)을 실측·수정했다는 기록을 남겼다 — 이 CRITICAL 이 가설이 아니라 이미 한 번 진단·수정된 결함의 재확인임을 뒷받침한다.
  - 제안: `secret-store.md §1` 의 근거 (3)을 "정책상 노출 창은 rotate 응답 1회로 설계됐으나, 현재 구현은 `GET/POST/PATCH /api/triggers`·`GET /api/schedules` 에서도 평문을 노출한다(미해결 결함)"로 정정하거나, 이 유출을 닫는 developer 항목을 `plan/in-progress/`(예: `spec-draft-nullable-notation-followups.md` 의 §5.4 drift 2단계 아래, 또는 신규 항목)에 명시적으로 등재해 이 spec 등재와 짝지어야 한다. 지금은 어느 쪽도 없어 "이미 안전하다고 결정된 필드"로 읽힐 위험이 있다.

- **[WARNING]** `4-integration.md §9.1` 반영 결정이 draft 의 "후속 (이 PR 밖)" 추적 목록에서 빠졌다
  - target 위치: `plan/in-progress/spec-draft-notification-secret-storage.md` §③ `spec/2-navigation/4-integration.md §9.1 (W3)` 블록의 "선행 의존" 캐비엇 (line ~161-164)
  - 관련 plan: 같은 문서 `### 후속 (이 PR 밖)` 절 (line 197-203) — 두 항목만 있고 이 항목은 없음. `plan/in-progress/` 전체를 grep 해도 `claude/sweep-response-contract-5ba0ad` 브랜치 머지를 추적하는 다른 plan 항목이 없음(0건).
  - 상세: target 은 §③ 에서 "그 브랜치가 머지된 뒤에 반영한다"고 명시적으로 결정했지만, 이 실행을 트리거할 체크박스/추적 항목이 문서 어디에도 없다. `spec_impact` frontmatter 에 `4-integration.md` 가 남아 있어 "아직 할 일"임은 알 수 있으나, 이 draft 가 (다른 두 후속 항목만 닫힌 채) `complete/` 로 이동되면 이 포인터 추가가 조용히 소실될 수 있다.
  - 제안: "후속 (이 PR 밖)" 목록에 `4-integration.md §9.1` 에 `1-data-model.md §2.10` 포인터 추가 — `claude/sweep-response-contract-5ba0ad` 머지 후" 항목을 명시적으로 추가한다.

- **[INFO]** "미머지 브랜치라 못 고친다"는 사유가 부정확 — 대상 문장은 이미 이 브랜치에도 있다
  - target 위치: `plan/in-progress/spec-draft-notification-secret-storage.md` §"후속 (이 PR 밖)" 첫 항목 ("`claude/sweep-response-contract-5ba0ad` 에 있는 문장이라 그 브랜치에서 고친다")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:314` — "§5.4 를 시행하는 유일한 코드" 문구가 이미 이 브랜치(커밋 `983fd0ade`)에 존재한다.
  - 상세: 실측(`git log --oneline -1 -- plan/in-progress/spec-draft-nullable-notation-followups.md` → `983fd0ade`, 현재 HEAD 의 조상)으로 확인. 대상 문장은 `claude/sweep-response-contract-5ba0ad` 전용이 아니라 현재 워크트리에서 바로 편집 가능하다.
  - 제안: 이번 PR 범위를 좁게 유지하려는 판단 자체는 타당할 수 있으나, 사유는 "미머지 브랜치라 접근 불가"가 아니라 "스코프 밖이라 미룸"으로 정정하는 것이 정확하다. 원한다면 한 줄 수정이라 이번 턴에 바로 반영해도 무방하다.

## 요약

target draft (`spec-draft-notification-secret-storage.md`, 이미 `790487f34` 로 커밋됨)의 핵심 결정 — `notification_secret_v2` 평문 저장을 `secret-store.md §1` 세 번째 예외로 등재 — 은 두 개의 반증된 Rationale(R-K, §1.5 승격 경로)을 다시 읽고 첫 진단을 스스로 뒤집은 신중한 정정이지만, 그 등재문이 내세운 안전 근거 중 하나("1회 노출")가 이 브랜치의 실제 코드로는 성립하지 않는다 — 같은 필드가 `GET/POST/PATCH /api/triggers`·`GET /api/schedules` 로 상시 유출되며, 이 정확한 결함이 미머지 자매 브랜치(`claude/sweep-response-contract-5ba0ad`)에서 이미 발견·수정된 바 있다. 이 사실이 spec 등재와 짝지어 트래킹되지 않으면, "이미 안전하다고 결정된 필드"라는 잘못된 인상을 남길 위험이 있다. 그 밖에 `4-integration.md` 후속 반영이 추적 목록에서 누락된 점(WARNING), 미머지 브랜치 사유 서술의 사소한 부정확(INFO)이 있다.

## 위험도

CRITICAL
