# Plan 정합성 검토 — `plan/in-progress/spec-draft-trigger-lock-gaps.md`

## 방법

번들이 `spec_impact` 4개 문서 본문을 대부분 떨궜다는 지시에 따라, 대상 spec 4개
(`spec/2-navigation/2-trigger-list.md`, `spec/conventions/redis-keys.md`,
`spec/5-system/15-chat-channel.md §5.4.1.1`, `spec/data-flow/11-workflow.md §3.1`)를 절대경로로
직접 Read 했고, draft 가 인용하는 코드·마이그레이션 사실(FK `ON DELETE`, `exec-cap` 키 조립,
`pg_advisory_xact_lock` 호출부 전수, `TriggersService.remove()` 호출 순서)을 draft 문면을
믿지 않고 저장소에서 재확인했다. 근거 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`
의 "planner 범위 5건"·"developer 범위 후속" 두 표 원문을 직접 대조했다.

## 발견사항

### INFO — 항목 1 은 트래커가 지목한 파일이 아니라 다른 문서를 고친다 (자체 고지됨)

- target 위치: `## 변경안 A1` (frontmatter `code:` 추가) + `## Rationale` "1 을 «glob 한 줄»
  이 아니라 «계약 서술 + `code:`» 로 처리한 이유"
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4462` (트래커 항목 1 —
  *"`spec/5-system/15-chat-channel.md` frontmatter `code:` glob 이 신규
  `trigger-config-lock.ts` 를 안 문다 → glob 확장 또는 명시 경로 추가"*)
- 상세: 트래커는 이 항목을 `15-chat-channel.md` 의 `code:` glob 문제로 등재했는데, target 은
  그 파일을 전혀 건드리지 않고 대신 `2-trigger-list.md` frontmatter 에 명시 경로를 추가한다.
  실측(`grep -rl trigger-config-lock`)으로 소비자가 `triggers.service.ts` ·
  `chat-channel-binder.service.ts` · `schedules.service.ts` 셋이라 chat-channel 전용이 아님을
  확인했고, target 의 Rationale 이 이 재배정을 명시적으로 정당화한다 — 은폐된 이탈이 아니다.
  트래커 자신도 "항목이 «한 칸 좁게» 적혀 있었다"(5b 관련 자기 지적, target 41~56행)를 인지하고
  있어, 이 재배정은 미해결 결정 우회가 아니라 좁은 처방의 정정으로 읽힌다.
- 제안: 조치 불필요 — target 이 반영 완료 시 트래커 항목 1 을 체크할 때 "chat-channel.md 가
  아니라 trigger-list.md 로 재배정" 한 줄을 완료 표시 옆에 남기면, 다음 사람이 트래커 원문과
  실제 반영처가 다른 이유를 다시 추적하지 않아도 된다.

### INFO — 트래커 developer 항목 7(미해소)이 target 에 잔여로 정확히 승계됨

- target 위치: `## 변경안 A2` 말미 "⚠️ 실측되지 않은 잔여" 블록
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4490` (developer 항목 7
  — "창 1(`TriggersService.update()` 의 인라인 `save()`)이 FK CASCADE 창에 대해 미검증", 미체크)
- 상세: target 은 이 미해결 항목을 결정으로 봉합하지 않고 spec 본문에 `⚠️` 관례로 명시적
  미확인 상태를 남기며 트래커로 역참조한다. 코드 실측(`triggers.service.ts` 의 `update()` 가
  `rewriteTriggerConfigLocked` 를 거치지 않고 인라인으로 락을 잡는 구조)과도 일치한다 — 이
  draft 가 developer 범위 항목 7을 대신 해결한 것처럼 과장하지 않는다.
- 제안: 없음 — 트래커·target 양쪽의 표현이 일치하므로 갱신 불필요.

## 검증한 것 (충돌 없음 확인)

- `redis-keys.md §4` 는 "Redis 를 경유하지 않는 인접 네임스페이스" 절이고 이미 3행(Socket.IO
  채널·in-memory map·BullMQ 내부키)을 담고 있어, target B1 의 advisory lock 키 행 추가는 그
  절의 기존 스코프·컬럼 형식(`이름|실체|SoT`)과 정확히 맞는다. §5("새 키는 §3 인벤토리에")는
  실 Redis 키 전용 규칙이라 advisory lock(비-Redis)에는 적용되지 않는다 — 저촉 없음.
- `spec-sync-external-interaction-api-gaps.md` 가 과거(2026-08-24) `redis-keys.md:84` 를
  인용하지만 해당 항목은 `[x]` 완료 상태이고, target 의 B1 삽입 지점(§4 표 마지막 행 다음,
  88행 이전)은 84행보다 뒤라 그 인용을 stale 하게 만들지 않는다.
- `2-trigger-list.md §4.3` 기존 cascade 표(하류: trigger→schedule/execution/auth_config/…)와
  target A3 신설 행(상류: workflow/workspace→trigger)은 서로 반대 방향이라 표 구조·기존 행과
  충돌하지 않는다.
- `15-chat-channel.md` 각주(450행, "2026-09-10 정합화")의 현재 코드 상태(PATCH 가
  `inboundSigningPlaintext`/`inboundSigning` 을 400 으로 거부, `update-trigger.dto.ts` ·
  `chat-channel-rejection-messages.const.ts` 로 확인)는 target C1/C2 의 "표와 각주는 다른
  시점을 말할 뿐 모순이 아니다" 판정과 일치 — 결정을 요하는 항목이 아니라 시제 명시로 닫는
  것이 트래커의 "spec 본문끼리의 충돌이라 구현으로 못 닫는다"는 우려와도 모순되지 않는다
  (구현으로 어느 쪽이 맞는지가 아니라 "모순 자체가 없음"을 구현이 방증한 것).
- `11-workflow.md §3.1` FK `REFERENCES workflow(id)` 전수(마이그레이션 V001~V110 전체 스캔,
  CASCADE 9 · SET NULL 1)와 이후 마이그레이션의 미변경을 직접 재확인 — target D 표의 수치와
  일치.
- `TriggersService.remove()` 의 호출 순서(`scheduleRunner.removeJob`(조건부) →
  `chatChannelBinder.teardownChatChannel` → `secrets.deleteByPrefix` → 락)를 코드로 재확인 —
  target A4/D2 의 서술과 일치.
- 라인 인용 충돌 없음: 트래커의 별도 "줄-번호 인용 15곳" 항목이 지목하는 `15-chat-channel.md`
  줄들(:200/:201/:373/:377/:390)은 target 이 편집하는 450행과 무관하고, C1/C2 편집은 같은
  물리 라인(450) 안에서만 늘어나 하류 줄 번호를 밀지 않는다.
- 트래커의 "harness: `--spec` 번들이 `spec_impact` 를 떨군다" 항목(같은 문서 4350행)과 target
  말미 "(main 추가)" 보정 지시가 정확히 같은 결함 클래스를 가리키며, target 은 이를 회피책
  없이 그대로 노출해 checker 에게 직접 Read 를 요구한다 — 은폐 없음.

## 요약

target 은 트래커(`spec-draft-nullable-notation-followups.md`)의 "trigger-config advisory
lock 이 남긴 planner 범위" 6항목(1·2·3·4·5·5b)을 처방으로 받지 않고 코드·마이그레이션으로
재실측했고, 그 결과 트래커 문면이 3건에서 실제보다 좁게 적혀 있었음을 스스로 밝히며 정정한다.
독립적으로 재실측한 결과(소비자 3개·`exec-cap` 키 조립식·PATCH 400 거부·FK CASCADE 9+SET NULL
1·삭제 전처리 호출 순서)는 모두 target 의 서술과 일치했다. 미해결 결정을 일방적으로 내린
자리는 없다 — 유일한 잠재적 결정 지점(§5.4.1.1 표-각주 "모순")은 실측으로 애초에 결정이
필요 없었음을 보였고, 유일한 진짜 미해결 항목(developer 항목 7)은 결정하지 않고 spec 에
`⚠️` 잔여로 정직하게 승계했다. 트래커 항목 1 의 편집 대상 재배정(chat-channel.md →
trigger-list.md)은 트래커 문면과 다르지만 Rationale 에 자체 정당화돼 있어 은폐된 결정 우회가
아니다. 후속 항목 누락이나 선행 plan 미해소도 발견되지 않았다.

## 위험도

NONE
