# 신규 식별자 충돌 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위 요약

이번 impl-prep 게이트가 실제로 실행 착수를 승인하는 대상은 `plan/in-progress/trigger-save-partial-patch.md`
(스코프 선언 `spec_impact: none`)다. `spec/2-navigation/2-trigger-list.md` 등 번들에 포함된 spec 본문은
이미 `origin/main` 에 병합된 기존 내용(직전 커밋 `217fadecb`)이라 이번 target 이 spec 층에서 새로 도입하는
식별자는 없다. 따라서 검토는 (a) 이 plan 이 구현 단계에서 만들 것으로 예고한 코드측 신규 식별자와, (b) 기존
spec/코드 코퍼스 간의 충돌 여부에 집중했다.

## 확인한 신규 식별자와 대조 결과

| 신규 식별자 후보 | 소스 | 대조 결과 |
|---|---|---|
| `codebase/backend/test/trigger-save-window-probe.e2e-spec.ts` | 이미 생성된 untracked 파일 | `PROJECT.md:329` 의 `<scope>.e2e-spec.ts` 관례 준수. 동일 파일명 기존 사용 없음(`grep -rl` 0건) |
| `assertTriggerFound` | plan 코드 스니펫이 재사용 | **신규 아님** — `triggers.service.ts:356` 에 이미 정의된 기존 private 메서드. plan 은 새로 도입하지 않고 기존 계약대로 재사용 |
| `창 1` / `①` `②` `②b` `③` 라벨 | plan 본문 | **신규 아님, 의미도 일치** — `창 1`은 `trigger-config-lock.ts`·`triggers.service.ts`·`triggers.service.spec.ts`·`plan/complete/trigger-config-lost-update.md` 전반에서 이미 `TriggersService.update()`의 인라인 `save()`를 가리키는 확립된 라벨이고, plan 의 `①`/`②`는 spec `2-trigger-list.md §3` ⚠️ 문장이 이미 쓴 `① CASCADE 창 / ② 락 밖 컬럼 갱신` 매핑을 그대로 이어받는다. `③`(0행 update)은 새 케이스이나 기존 `①②` 를 재활용하지 않고 별도 번호를 매겨 충돌 없음 |
| `notification_secret_v2` / `chat_channel_token_v2` / `last_triggered_at` (컬럼명) | plan 표 | **신규 아님** — `trigger.entity.ts:73,104,148` 에 이미 정의된 컬럼과 정확히 일치 |
| Postgres 에러 코드 `23503`/`23502` | plan 실측 표 | 표준 Postgres 코드, 신규 도입 아님 |
| API endpoint·DTO·ENV var·config key | plan 전체 | 신규 도입 없음 — 이 plan 은 `TriggersService.update()` 내부 저장 대상(`save` 인자)만 좁히는 구현 변경이라 계약 표면(엔드포인트·요청/응답 shape)을 추가하지 않는다 |

## 발견사항

### [INFO] 두 e2e 파일의 주제가 인접해 구분 근거가 파일 내부에만 있음

- target 신규 식별자: `codebase/backend/test/trigger-save-window-probe.e2e-spec.ts`
- 기존 사용처: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (기존, `plan/complete/trigger-config-lost-update.md` §C 산출물)
- 상세: 두 파일 모두 "트리거 저장 시 동시 쓰기가 서로를 덮어쓰는가"라는 인접한 주제를 다룬다. `trigger-config-lost-update.e2e-spec.ts`는 `config` JSONB 에 대한 동시 PATCH 충돌(락·재읽기 도입 전후 대조, 단언 있음)을 다루고, 신규 `trigger-save-window-probe.e2e-spec.ts`는 재읽기~저장 사이의 CASCADE/컬럼 경합을 다루는 **측정용(단언 없음) probe**다. 이름만으로는 두 파일의 책임 경계(“config lost update” vs “save window probe”)가 명확히 갈리지 않아, 이후 이 영역을 만지는 개발자가 어느 파일에 새 케이스를 추가해야 할지 혼동할 여지가 있다. 실제 충돌(같은 식별자가 다른 의미로 쓰이는 경우)은 아니며, 두 파일의 JSDoc 이 각자 자기 범위는 명확히 서술하고 있어 실질 위험은 낮다.
- 제안: 신규 파일이 plan 상 "측정 spec → 특성 테스트로 전환" 예정이므로, 전환 시점에 파일 상단 JSDoc 에 `trigger-config-lost-update.e2e-spec.ts` 와의 책임 분리(“이 파일은 컬럼 경합·CASCADE 창, 저쪽은 `config` JSONB 병합 경합”)를 한 줄 교차 참조로 남기면 향후 탐색 비용을 줄일 수 있다. 차단 사유 아님.

## 요약

target(`plan/in-progress/trigger-save-partial-patch.md`, scope `spec/2-navigation/`)이 예고하는 코드측 식별자(신규 e2e 파일명, 재사용하는 `assertTriggerFound`, `창 1`/`①②③` 라벨, DB 컬럼명)를 모두 대조한 결과 기존 spec·코드·plan 코퍼스와의 명명 충돌은 발견되지 않았다. `spec/2-navigation/` 번들 자체는 이미 병합된 기존 내용이라 spec 층에서 새로 부여되는 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수도 없다. 유일한 관찰 사항은 두 e2e 테스트 파일 간 주제 인접성으로 인한 탐색 편의성 이슈(INFO)뿐이며, 이는 명명 충돌이 아니라 문서화 보완 제안이다.

## 위험도

NONE
