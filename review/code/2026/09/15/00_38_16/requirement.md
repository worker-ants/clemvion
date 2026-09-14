# 요구사항(Requirement) 리뷰 — trigger-config-lost-update

## 검토 범위

이 PR 은 동시 PATCH/웹훅 인입이 `trigger.config`(JSONB) 를 스냅샷 기준으로 통째로 되써
`chatChannel.inboundSigningRef` 를 잃고, 그 결과 인입 웹훅 서명 검증이 fail-open 으로
돌아가던 lost-update 결함을 advisory lock(`pg_advisory_xact_lock`) + "락 안에서 재읽고
서브키만 병합" 패턴으로 닫는다. `plan/in-progress/trigger-config-lost-update.md` 가 이미
11 라운드의 `/ai-review` 처분(각 라운드 CRITICAL/WARNING 을 뮤테이션 실측으로 검증하며
닫음)을 상세히 기록하고 있어, 이번 라운드는 그 누적 상태 위에서 실제 소스를 직접 열어
독립적으로 재검증했다: `trigger-config-lock.ts`, `triggers.service.ts`(전체 1618줄 중
핵심 경로 전부), `chat-channel-binder.service.ts`(전체), `hooks.service.ts`(`touchLastTriggeredAt`
및 호출부), `schedules.service.ts`(`update()`), `chat-channel-input-rules.ts`(신규
`extractInboundSigningRef`), 정적 가드(`endpoint-path-conflict-wrap-guard.ts`), 그리고
`trigger-config-lost-update.e2e-spec.ts`. 저장소는 mutate 하지 않았다(`git status --short` 로
확인 — untracked 항목은 이 리뷰 산출물 디렉터리 자신뿐).

## 발견사항

이번 라운드의 diff 및 관련 코드 경로를 전수로 대조한 결과, 요구사항 충족 관점에서
CRITICAL/WARNING 급 결함을 발견하지 못했다.

- **[INFO]** `TriggersService.create()`/`SchedulesService.create()` 의 `triggerRepository.save(trigger)` 는 이 결함 클래스에 해당하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:491-493`, `codebase/backend/src/modules/schedules/schedules.service.ts:173`
  - 상세: 두 자리 모두 `repository.create({...})` 로 만든 **신규 엔티티**의 최초 INSERT 라 "읽은 시점의 스냅샷이 옛 값을 되돌린다" 는 lost-update 전제(기존 행에 대한 재저장)가 성립하지 않는다. plan §D 의 "기존 행에 save(entity) 하는 자리는 8곳(신규 INSERT 2건 제외)" 서술과 정확히 일치하며, 정적 래칫(`endpoint-path-conflict-wrap.spec.ts`)의 `EXPECTED_WRAPPED_TRIGGER_SAVES` 에도 `create`/`update` 둘만 남아 있어 코드·래칫·plan 서술이 삼중으로 정합한다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `mergeIntoFreshSubKey` 의 `fallback` 분기가 실제로 행사되는지 직접 재현해 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:380-392`(헬퍼), `:4072-4099`(`triggers.service.spec.ts` 의 `revokePerTriggerToken — 재읽은 행에 그 키가 아예 없으면 fallback 으로 쓴다`)
  - 상세: 11라운드 리뷰가 지적한 "네 호출부 어느 fixture 도 fallback 분기를 행사하지 않는다"(뮤턴트 삭제 시 147건 GREEN)는 결함이 실제로 판별 fixture(재읽은 config 에 `interaction` 키 자체가 없는 상태)로 닫혀 있음을 테스트 본문을 직접 읽어 확인했다 — `freshConfig.interaction` 부재 → `base = fallback(updated)` 경로를 타고 `appearance: 'from-snapshot'` 이 그대로 실리는 것을 검증한다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** spec ID 인용의 line-level 정합성 재확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:97-105` (Cafe24 advisory-lock 기각 선례 인용) vs `spec/2-navigation/4-integration.md:1444`
  - 상세: JSDoc 이 인용한 문구("lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고")가 spec 원문과 정확히 일치함을 직접 대조했다. CCH-AD-02·CCH-AD-03·CCH-SE-01·CCH-SE-04·CCH-SE-04-C·CCH-NF-03·R-CC-21 등 코드 주석이 인용하는 스펙 ID 도 `spec/5-system/15-chat-channel.md` 에 실재하며 서술과 어긋나지 않는다. spec 본문 자체를 수정하지 않는 순수 서비스/영속성 계층 변경이라 spec fidelity 관점의 CRITICAL 은 없다.
  - 제안: 조치 불요.

## 요약

핵심 수정(`rewriteTriggerConfigLocked` + advisory lock, 4개 원래 창 + 발견된 7개 추가 창 전체 전환, 웹훅 인입 hot path 의 `touchLastTriggeredAt` 통합, `schedules.service.ts` 의 컬럼 한정 갱신, `extractInboundSigningRef` 중복 제거, 정적 가드의 `manager.transaction` 콜백 추적 확장)는 요구사항이 의도한 "동시 쓰기가 서로의 config 를 잃지 않는다"를 e2e(`trigger-config-lost-update.e2e-spec.ts`, 3중 대조군 단언 + telegram 전제 격리)로 실증하고 있으며, 함수 시그니처·부재 처리(404 vs `false` vs 조용한 skip)의 비대칭도 JSDoc 표로 명시적으로 설계돼 있다. TODO/FIXME/HACK/XXX 는 이번 diff 전체 17개 소스 파일에서 0건이다. 반환값은 모든 경로(락 재읽기 성공/삭제 경합/실패 전파)에서 정의돼 있고, 에러 시나리오(삭제 락 타임아웃 5초 초과 시 `logger.error` + throw, endpoint_path UNIQUE 충돌 재throw)도 커버된다. 이미 11라운드에 걸쳐 CRITICAL/WARNING 을 뮤테이션 실측으로 닫아 온 이력이 plan 문서에 남아 있고, 이번 독립 검증에서도 동일한 결론에 도달했다 — 요구사항 충족 관점에서 이번 배치를 막을 CRITICAL/WARNING 사유를 찾지 못했다.

## 위험도

NONE
