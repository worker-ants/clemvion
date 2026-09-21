# 부작용(Side Effect) 리뷰 — model-config 동시 DELETE 중복 감사 수정 (8번째 자리)

## 발견사항

- **[INFO]** 통지 콜백(`notifyInvalidated`) 호출 여부가 변경된다 — 의도된 부작용, 계약대로 구현됨
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` (게이트 426~434)
  - 상세: 종전에는 `repo.remove(config)` 가 0행이어도 던지지 않아 동시 DELETE 의 패자도 `notifyInvalidated(id)` 를 호출했다. 이번 변경으로 `affected === 0` 이면 `notifyInvalidated`·`recordAudit` 모두 건너뛰고 즉시 던진다. 유일한 구독자는 `codebase/backend/src/modules/llm/llm.service.ts:81` 의 `clearClientCache(configId)` 하나뿐이며 캐시 축출은 멱등이라(직접 확인) 실질적 위해는 없다. 다만 "콜백이 호출되는 조건" 자체가 바뀐 것은 사실이므로 이벤트/콜백 관점에서 기록해 둔다. 단위 테스트(`model-config.service.spec.ts:1104-1120`)가 패자 쪽에서 `listener` 가 호출되지 않음을 명시적으로 단언하므로 회귀 감지는 확보돼 있다.
  - 제안: 조치 불요 — 계약이 코드 주석·JSDoc·테스트 3곳에 일관되게 기록돼 있다.

- **[INFO]** 동시 삭제 패자의 HTTP 응답이 `204`→`404`로 바뀐다 — 공개 API 인터페이스의 관측 가능한 동작 변경(의도됨)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:426-429` (`remove()`), 컨트롤러 쪽은 `codebase/backend/src/modules/model-config/model-config.controller.ts:161-176` (변경 없음, 직접 열어 대조 확인)
  - 상세: `ModelConfigService.remove(id, workspaceId, userId): Promise<void>` 시그니처 자체는 그대로이고 호출부(`model-config.controller.ts:175`)도 변경 없다. 하지만 동시 삭제에서 패자가 이제 새 예외 경로(`this.notFound()` → `MODEL_CONFIG_NOT_FOUND`)를 타므로, 외부에서 보면 같은 요청이 상황에 따라 `204` 또는 `404` 를 반환할 수 있게 된다. 새 에러 코드나 스키마 도입은 아니며 `findEntity` 가 이미 쓰던 동일 `notFound()` 헬퍼·이미 `@ApiNotFoundResponse` 로 문서화된 응답을 재사용한다. 형제 7건(#1369~#1374)과 동일 패턴이며, "먼저 지운 요청은 성공, 나중 요청은 이미 없어서 404" 라는 REST 관례에 더 부합하는 방향의 수정이다.
  - 제안: 조치 불요. `DELETE` 를 멱등 재시도로 여기고 "재전송 시 항상 204" 를 가정하는 외부 클라이언트가 있다면 인지가 필요하나, 코드베이스 내에서 그런 클라이언트는 확인되지 않았고 CHANGELOG 에 판별력 실측까지 기록돼 있어 별도 조치는 불필요하다.

- **[INFO]** 함수 시그니처·리포지토리 호출 표면 변경 — 외부 호출자 영향 없음 확인
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:403` (`remove(id, workspaceId, userId): Promise<void>`)
  - 상세: `this.repo.remove(config)` → `this.repo.delete({ id, workspaceId })` 로 내부 구현만 바뀌었다. `ModelConfigService.remove()` 의 공개 시그니처(파라미터 3개, 반환 `Promise<void>`)는 변경되지 않았고, 저장소 전체에서 이 메서드를 호출하는 곳은 `model-config.controller.ts:175` 한 곳뿐임을 `grep` 으로 확인했다(다른 호출자 없음). `ModelConfig` 엔티티에 `cascade: true`·`@OneToMany`·remove 계열 라이프사이클 훅이 없음을 엔티티 파일에서 직접 확인했고, 참조 FK 둘(`knowledge_base.rerank_config_id` — `migrations/V090__model_config_absorb_rerank.sql:22`, KB embedding — `migrations/V091__kb_embedding_model_config.sql:23`)이 모두 `ON DELETE SET NULL` 임을 마이그레이션 파일에서 직접 확인해 `remove(entity)`→`delete(criteria)` 전환이 DB 레벨 부수효과를 바꾸지 않는다는 코드 주석의 주장과 일치함을 검증했다.
  - 제안: 조치 불요.

- **[INFO]** 새 전역 상태·환경 변수·네트워크 호출·파일시스템 부작용 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts`, `model-config.service.spec.ts`, `model-config-delete-concurrency.e2e-spec.ts`
  - 상세: diff 전체를 검토한 결과 새 모듈 스코프 변수·싱글턴·환경 변수 read/write·외부 서비스 호출이 추가되지 않았다. 신규 e2e 는 테스트 전용 DB 커넥션(`locker`)을 `beforeAll`/`afterAll` 에서 열고 닫으며(`.end()`), `finally` 에서 `ROLLBACK` 을 항상 시도해 트랜잭션·락 누수가 없다. `plan/`·`review/`·`CHANGELOG.md` 변경은 이 프로젝트의 workflow 산출물(작업 plan, 이전 리뷰 라운드의 RESOLUTION/SUMMARY 등)이며 코드 실행 경로에는 영향 없다.
  - 제안: 조치 불요.

- **[관측, 비-결함]** 저장소 상태 확인
  - 위치: 해당 없음 (worktree 전체)
  - 상세: 리뷰 시작·종료 시점 모두 `git status --short` 결과 `review/code/2026/09/21/17_08_12/`(이번 리뷰 세션 산출물) 외 변경 없음을 확인했다. 이전 리뷰 라운드(`16_39_52`)의 documentation 리포트가 관측했던 일시적 `.bak`/미커밋 diff 잔여물은 이번 세션 시작 시점에 이미 존재하지 않는다 — 재조사 불요. 이번 세션은 저장소에 어떤 뮤테이션도 가하지 않았다(가설 검증을 위한 코드 수정을 하지 않음).

## 요약

이번 diff는 `ModelConfigService.remove()` 를 무락 `findEntity → repo.remove(entity)` 조합에서 단일 원자적 `repo.delete({id, workspaceId})` + `affected === 0` 명시 비교 판정으로 전환해, 동시 DELETE 두 건이 `model_config.delete` 감사 행을 중복 기록하던 결함을 수정한다(형제 7건 #1369~#1374 와 동일 패턴). 공개 함수 시그니처는 변경되지 않았고 유일한 호출자(`model-config.controller.ts`)도 그대로다. 관측 가능한 부작용은 두 가지뿐이다 — (1) 동시 삭제 패자에서 무효화 콜백(`notifyInvalidated`)이 더 이상 호출되지 않는 것(유일한 구독자가 멱등이라 무해, 테스트로 계약 고정됨), (2) 패자의 HTTP 응답이 `204`→`404`(기존에 이미 문서화된 코드·스키마를 재사용, 의도된 버그 수정). 둘 다 코드 주석·JSDoc·CHANGELOG·단위/e2e 테스트에 일관되게 기록·검증돼 있다. 새 전역 상태, 환경 변수, 네트워크 호출, 예기치 않은 파일시스템 부작용은 발견되지 않았고, ORM 라이프사이클 훅·FK cascade 부재도 직접 확인했다. 저장소는 리뷰 시작·종료 시점 모두 깨끗했다.

## 위험도

NONE
