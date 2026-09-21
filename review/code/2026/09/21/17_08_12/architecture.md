# 아키텍처(Architecture) 리뷰 — modelconfig-dup-delete

## 발견사항

- **[WARNING]** "무락 조회 → 원자적 `DELETE` → `affected === 0` 명시 비교 → notFound" 판별자 관용구가 서비스 계층 ≥6개 클래스에 공유 추상화 없이 그대로 복제되고 있다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `remove()` (403~442행, JSDoc 포함 399행부터). 동일 관용구가 반복되는 형제 자리: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:296-336`(`remove`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:793-838`(`removeMember`), `codebase/backend/src/modules/schedules/schedules.service.ts:308-380`(`remove`), `codebase/backend/src/modules/integrations/integrations.service.ts:765-803`(`remove`), `codebase/backend/src/modules/executions/executions.service.ts`(`grep affected === 0` 일치). `grep -rln "affected === 0" codebase/backend/src/modules/*/*.service.ts` 로 직접 확인.
  - 상세: 이번 PR 은 이 결함 클래스의 여덟 번째 자리를 정확히 형제와 동일한 형태로 고쳤다는 점에서 개별 수정 자체는 타당하다. 다만 아키텍처 관점에서 보면, "조회는 잠그지 않는다 → 단일 원자적 DELETE 문의 `affected`(TypeORM `DeleteResult.affected`)만을 신뢰한다 → `null`/`undefined`(드라이버 미보고)와 `0`(실제 미삭제)을 반드시 명시 비교로 구분한다 → 구분 실패 시 진 쪽에서 스킵할 후속 부수효과(캐시 무효화 통지·감사 기록)를 건너뛴다" 라는 하나의 정합성 불변식이 이제 8개 서비스 클래스에 걸쳐 **복붙으로만** 존재한다. 공유 헬퍼·데코레이터·믹스인·베이스 클래스가 전혀 없다 — 매 자리마다 20줄 안팎의 동일한 근거 주석(FK cascade 실측·`!affected` 회귀 경고·형제와 다른 404 코드 이유)까지 함께 손으로 복제된다.
  - 이 반복이 실제로 결함을 낳은 전례가 있다: CHANGELOG(`#1371`, schedules)에 따르면 이 판별자가 없던 자리에서 `!affected`(truthy) 판정으로 되돌리는 뮤턴트가 **32건** 통과했다 — 명시 비교 불변식이 코드 리뷰/주석에만 의존하고 타입 시스템이나 공유 primitive 로 강제되지 않기 때문에, 다음 자리(#9 WebAuthn, 그리고 그 이후 새 리소스)에서도 동일한 실수가 재발할 표면이 여전히 열려 있다. 개방-폐쇄 관점에서, 이 불변식에 새 요구가 하나 추가되면(예: 판별자 로깅·메트릭 추가) 8개 파일을 전부 찾아 고쳐야 한다.
  - CHANGELOG 는 아홉 번째 자리(WebAuthn)가 "감사가 서비스가 아니라 컨트롤러에 있어 축이 다르다"고 명시하므로, 8개 서비스를 하나의 상위 클래스/템플릿 메서드로 완전히 통합하는 것은 과도한 추상화가 될 수 있다(축이 이미 발산했다) — 그래서 완전 통합이 아니라 **최소 범위 추출**을 제안한다.
  - 제안: 발산 축(예외 타입·감사 액션·notify 유무·서비스/컨트롤러 위치)까지 통합하는 템플릿 메서드는 피하고, 가장 위험하고 가장 순수한 부분 — `affected` 판별자 자체(`affected === 0` 명시 비교 + `null`/`undefined` 방어) — 만 `common/` 계층의 작은 타입 유틸(예: `isDeleteMiss(result: DeleteResult): boolean`)로 추출해 8개 호출부가 그 하나의 함수를 호출하도록 통일할 것을 검토한다. 이렇게 하면 각 서비스의 예외 타입·감사·notify 순서는 그대로 각자 소유하면서, 회귀가 실제로 발생했던 지점(판별자 비교 연산자)만 한 곳에서 강제할 수 있다. 이번 PR을 막을 사유는 아니다(형제 패턴을 정확히 재사용했고, 개별 수정은 옳다) — 다음(9번째, WebAuthn) 착수 시점에 e2e 헬퍼 추출 여부 결정과 함께 이 프로덕션 코드 판별자 추출도 같이 검토 대상에 넣을 것을 권장한다.

## 검증한 내용 (문제 없음으로 확인)

- **레이어 책임**: 이번 diff 는 컨트롤러를 건드리지 않는다. `remove()` 는 서비스 계층에 남아 영속성(원자적 DELETE)·동시성 판별·부수효과 오케스트레이션(캐시 무효화 통지·감사 기록)을 그대로 캡슐화하고, 컨트롤러는 라우팅·인가·직렬화만 담당하는 기존 경계가 유지된다.
- **순환 의존 회피(기존 설계, 이번 diff 로 재확인)**: `ModelConfigService` 는 `LlmService` 를 알지 못한다 — `onConfigInvalidated`/`notifyInvalidated` 옵저버 등록으로 의존을 `LlmService → ModelConfigService` 단방향으로 유지한다(코드 주석 42~49행이 `forwardRef` 순환을 피하려는 의도를 명시). 이번 `remove()` 수정은 진 쪽에서 `notifyInvalidated` 호출 자체를 스킵하도록만 바꿨을 뿐 이 관찰자 패턴 경계를 변형하지 않았다. `grep` 으로 `llm/*.ts` 가 `ModelConfigService` 를 참조하되 그 역방향 import 는 없음을 확인했다.
- **원자성/추상화 수준**: check-then-act(무락 SELECT → 무조건 성공 처리) 를 애플리케이션 레벨 락(advisory lock) 도입 없이 DB 원자적 단일 문장(`DELETE ... WHERE id = $1 AND workspace_id = $2`)으로 옮긴 선택은 이 규모의 문제에 적정한 추상화 수준이다 — 새 동시성 프리미티브(락 매니저 등)를 도입하지 않고 기존 ORM API(`Repository.delete`)만으로 해결했다.
- **모듈 경계**: `repo.delete({ id, workspaceId })` 조건에 `workspaceId` 가 계속 포함되어 테넌트 스코프가 삭제 경로에서도 유지된다(모듈 경계를 넘는 cross-workspace 접근 없음). 이번 diff 가 도입한 새 외부 의존(예: `DeleteResult` 타입)은 테스트 파일 한정 type-only import 이며 런타임 결합을 추가하지 않는다.
- **e2e 테스트 파일 간 구조적 중복**: `model-config-delete-concurrency.e2e-spec.ts` 는 형제 e2e 8개와 거의 동형이다. 이는 이미 동일 세션의 maintainability 리뷰(WARNING, 유예)에서 상세히 다뤄졌고 plan(`modelconfig-dup-delete.md` §"이 PR 이 하지 않는 것")에 9번째 착수 시 결정을 못박은 선행 조건이 있어, 이 리뷰에서 반복하지 않는다. 다만 위 WARNING 이 지적하는 "프로덕션 코드 판별자 자체의 추출"은 그 테스트 중복 논의와는 별개 축이며 지금까지 어느 리뷰에서도 다뤄지지 않았다.

## 요약

이번 PR 이 `ModelConfigService.remove()` 에 적용한 개별 수정(무락 조회 → 원자적 `DELETE` → `affected === 0` 명시 비교 → 진 쪽 404·통지/감사 스킵)은 형제 자리 7건과 동일한, 이미 검증된 패턴을 정확히 재사용했고 레이어 경계·순환 의존 회피·테넌트 스코프 유지 모두 기존 설계를 그대로 보존한다. 새로 도입된 CRITICAL 급 아키텍처 결함은 없다. 다만 이번이 이 관용구의 여덟 번째 자리라는 사실 자체가 아키텍처 관점의 신호다 — "동시 삭제 판별자"라는 하나의 불변식이 공유 추상화 없이 8개 서비스 클래스에 손으로 복제되고 있고, 그 불변식이 빠졌던 자리(#1371)에서 실제로 32건의 뮤턴트가 통과한 전례가 있다. 아홉 번째 자리(WebAuthn)가 감사 위치 축 자체를 다르게 가져가는 것으로 보아 완전한 템플릿 통합은 과도하겠지만, 판별자 비교 연산 자체만이라도 최소 범위로 공유 유틸로 뽑아내는 것을 다음 자리 착수 시점에 함께 검토할 가치가 있다.

## 위험도

LOW
