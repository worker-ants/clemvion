# 동시성(Concurrency) 리뷰

## 검토 방법

프롬프트에 포함된 19개 파일 전체 컨텍스트를 읽고, 그중 `codebase/backend/src/modules/triggers/triggers.service.ts` ·
`triggers.service.spec.ts` · `codebase/backend/src/modules/workflows/workflows.service.ts` ·
`workflows.service.spec.ts` 4개는 프롬프트 크기 제한으로 실리지 않아 `git diff origin/main --
codebase/...` 로 직접 diff 를 확인했다. 나머지 파일(`model-config.service.ts`,
`schedules.service.ts`, 각 controller/module)도 동일하게 `git diff origin/main` 으로
실제 변경 hunk 를 대조해, "전체 파일 컨텍스트"에는 보이지만 이번 PR 이 건드리지 않은 기존
로직(예: `saveWithDefaultSwap` 트랜잭션 본문)과 실제 diff 를 구분했다.

## 변경 내용 요약

이번 변경은 `workflow.*` / `trigger.*` / `schedule.*` / `model_config.*` 4개 리소스에
대한 CRUD 감사 로깅(audit logging) 커버리지 추가다. 패턴은 4개 서비스 모두 동일하다:

1. controller 에 `@CurrentUser('sub') userId` 파라미터 추가 → service 메서드에 스레딩.
2. 각 service 에 `private recordAudit(...)` 헬퍼 추가 (named 필드 — auth-configs W-1 과
   동일 근거로 positional 인자 스왑 방지).
3. 1차 mutation(저장/삭제) 이 **커밋된 뒤** `await this.recordAudit(...)` 호출.
4. `AuditLogsService.record()` 는 내부에서 실패를 삼킨다(`try/catch` + `logger.warn`) —
   감사 기록 실패가 주 동작에 영향을 주지 않는다.

## 동시성 관점 확인 결과

- **원자성/트랜잭션 경계**: `workflows.service.ts` 의 `create()`/`duplicate()` 는
  `this.dataSource.transaction(...)` 이 반환한 결과를 변수(`created`/`duplicated`)로
  받은 뒤 트랜잭션 밖에서 `recordAudit` 을 호출하도록 리팩터링됐다 — 트랜잭션 내부에서
  기록했다면 롤백 시 "일어나지 않은 일"이 감사 로그에 남는 문제가 생기는데, 이를 정확히
  피했다. `model-config.service.ts::setDefault`/`schedules.service.ts::create`/`update`
  도 동일하게 "커밋 직후" 기록 순서를 지킨다(코드 주석에 W6 근거로 명시).
- **await 누락 여부**: 4개 서비스의 신규 `recordAudit` 호출은 전부 `await` 로 감쌌다.
  fire-and-forget(미대기 Promise)로 남겨진 곳은 없어 unhandled rejection 이나 응답-이후
  DB 쓰기 유실 우려가 없다.
- **공유 가변 상태**: 이번 diff 는 module-level `const *_RESOURCE_TYPE` 문자열과
  `AUDIT_ACTIONS`(→`as const` 로 이미 불변) 몇 개만 추가한다. 요청 간 공유되는 새로운
  mutable 상태(캐시, 카운터, Map/Set 등)는 도입되지 않았다.
- **`ModelConfigService.invalidationListeners`(Set) / `notifyInvalidated()`**: 이번
  diff 가 손댄 부분은 아니지만(기존 로직), `recordAudit` 호출이 `notifyInvalidated(id)`
  *뒤에* 추가됐다. `notifyInvalidated` 는 동기 for-of 순회이고 `record()` 는 내부에서
  예외를 삼키므로, 이 순서 변경으로 새로 생기는 race 나 예외 전파 경로는 없다.
- **`setDefault` 의 default-swap 트랜잭션(`saveWithDefaultSwap`)**: 동시 두 요청이
  같은 (workspace, kind) 에 대해 `isDefault=true` 를 시도하는 TOCTOU 형태의 경쟁은
  이론적으로 앱 레벨 조건부 UPDATE 만으로는 완전히 막히지 않는 클래스의 버그다
  (본 레포에서 과거 `exec-intake PR2b` 때 실제로 이 클래스의 결함이 발견돼 advisory
  lock 으로 교정된 선례가 있다). 다만 `ModelConfig` 엔티티에는
  `model_config_workspace_kind_default_unique` — `(workspace_id, kind)` партial unique
  index (`WHERE is_default = true`, V089) 가 이미 걸려 있어(entity 파일 확인 완료),
  두 트랜잭션이 동시에 서로 다른 row 를 `isDefault=true` 로 세팅하려 하면 DB 유니크
  제약 위반으로 한쪽이 실패한다 — 데이터 정합성은 DB 레이어에서 보장된다. 이 로직
  자체는 이번 diff 의 변경 범위가 아니고(대상 함수 본문 미변경, `userId`+`recordAudit`
  추가만), 기존에 이미 올바르게 방어돼 있어 별도 조치가 필요한 결함으로 보지 않는다.
- **이벤트 루프 블로킹**: 추가된 `recordAudit` 은 단순 `repository.save()` 1회 INSERT이며
  동기 CPU-bound 작업이 없다. 각 mutation 이 순차 await 하나(추가 DB 왕복)를 더 갖게 돼
  요청 지연이 소폭 늘 수 있으나, 이는 성능 관점이지 동시성 결함은 아니다(별도 performance
  리뷰어 소관으로 남긴다).
- **리소스 풀링**: 신규 커넥션 풀·워커 풀·세마포어 도입 없음. `AuditLogsService` 는
  기존 TypeORM repository(공용 풀)를 그대로 사용한다.

## 발견사항

없음. 검토한 diff 범위 안에서 경쟁 조건·데드락·동기화 결함·await 누락·원자성 위반·이벤트
루프 블로킹·리소스 풀 이슈를 발견하지 못했다.

## 요약

이번 변경은 4개 리소스(workflow/trigger/schedule/model_config)에 대한 CRUD 감사 로깅을
추가하는 순수 additive 변경이며, 모든 신규 `recordAudit` 호출이 관련 트랜잭션 커밋 이후
`await` 로 순차 실행되도록 배치돼 롤백-후-기록·fire-and-forget 유실 같은 전형적 함정을
피했다. 새로운 공유 가변 상태·락·워커 풀도 도입되지 않았고, 유일하게 인접한 잠재
경쟁(모델 설정 `isDefault` 스왑)은 이번 diff 범위 밖의 기존 로직이며 DB partial unique
index 로 이미 방어돼 있다. 동시성 관점에서 조치가 필요한 이슈는 없다.

## 위험도

NONE
