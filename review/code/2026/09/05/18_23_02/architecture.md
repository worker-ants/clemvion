# 아키텍처 리뷰

## 발견사항

- **[INFO]** 민감 필드 스트립 목록이 두 개의 독립된 상수로 나뉘어 있고, 이번 커밋이 그 분리 자체가
  1차 유출 원인이었음을 보여준다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(JSONB 키 축)와 `TRIGGER_RESPONSE_STRIP_COLUMNS`(엔티티 컬럼 축, 신설)
  - 상세: `Trigger` 엔티티에 "이 컬럼은 응답에 내보내면 안 된다"는 선언이 없다 — 그 지식은 서비스 레이어의
    수작업 allow/deny 목록 두 벌에 전적으로 위임되어 있다. 이번 CHANGELOG 가 스스로 인정하듯, 방어가
    "있었는데 한 칸 좁았던" 이유가 정확히 이 구조다: JSONB 안의 키는 지웠지만 같은 등급의 비밀이 사는
    엔티티 컬럼은 별개 축이라 커버되지 않았다. 향후 `Trigger`에 새 비밀 컬럼이 추가되면 두 목록 중
    어느 쪽에도 자동으로 반영되지 않고, 사람이 두 곳(때로는 그 이상)을 기억해서 갱신해야 한다.
  - 제안: 지금 범위에서 되돌릴 필요는 없다(`as const satisfies readonly (keyof Trigger)[]` 로 컴파일
    타임에 존재하지 않는 컬럼명은 막아 두었고, `select:false` 를 쓰지 않은 이유도 문서화되어 근거가
    있다). 다만 이 PR 이 "같은 병이 두 번째로 재발한 자리"라는 점은 다음 라운드의 참고로 plan 에
    남겨 둘 가치가 있다 — 예: 엔티티 컬럼 데코레이터에 `@Sensitive()` 같은 메타데이터를 얹고, 스트립
    목록을 그 메타데이터에서 도출하는 식으로 SoT 를 엔티티 쪽으로 옮기는 방안.

- **[INFO]** 조인된 자식 엔티티 전체 노출을 막는 방식이 모듈마다 다른 두 패턴(서비스 레이어 스트립 vs
  컨트롤러 레이어 참조-DTO 매핑)으로 갈려 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse`, 서비스 레이어) vs
    `codebase/backend/src/modules/schedules/schedules.controller.ts:67` (`toResponse`, 컨트롤러 레이어)
  - 상세: 두 선택 모두 각자 문서화된 근거가 있다 — Trigger 는 자기 자신의 필드라 서비스가 항상 정화해야
    하고, Schedule 은 `update` 등 내부 로직이 조인된 `trigger.isActive` 를 직접 소비하므로 서비스
    반환 타입을 좁히면 그 경로가 깨진다(실제로 `schedules.service.ts:218,222` 에서 `trigger.isActive`/
    `trigger.name` 대입을 확인). 그래서 판단 자체는 타당하다. 다만 "조인된 관계 엔티티가 컬럼을 통째로
    실어 응답까지 새어 나간다"는 같은 결함 클래스가 이번에 두 번째로 발견됐고(Trigger 자신 → Schedule
    을 통한 Trigger), 재사용 가능한 공용 매퍼/직렬화 전략(예: `class-transformer` 그룹 기반 노출 또는
    인터셉터) 없이 컨트롤러마다 손으로 `toResponse` 를 다시 짜는 구조다. 세 번째 모듈에서 같은 문제가
    나오면 또 새 ad-hoc 헬퍼가 생길 가능성이 높다.
  - 제안: 지금 당장 리팩터링을 요구할 사안은 아니나(서비스 반환 타입 통일이 더 큰 파급을 부른다는
    문서화된 판단은 합리적), 세 번째 재발 시점에는 "조인 관계를 응답 경계에서 좁히는 표준 방법"을
    convention 문서로 승격할 가치가 있다.

- **[INFO]** `SchedulesController.toResponse` 가 `Schedule` 엔티티 타입을 직접 import 해 프레젠테이션
  레이어가 영속성 레이어 타입에 결합된다
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:45` (`import type { Schedule } from './entities/schedule.entity'`)
  - 상세: 순수 타입 전용 import 이고, `model-config.controller.ts`/`users.controller.ts`/
    `graph.controller.ts` 에서도 동일하게 컨트롤러가 엔티티를 직접 참조하는 기존 관례가 이미 있어
    이 PR 이 새로 도입한 위반은 아니다. 서비스 레이어가 도메인 DTO 대신 TypeORM 엔티티를 그대로
    반환하는 코드베이스 전반의 기존 선택을 그대로 물려받은 것.
  - 제안: 이번 PR 범위에서 조치 불필요. 기존 관례와의 일관성 확인 차 기록만 남김.

- **[INFO]** `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 신설은 모듈 경계를 오히려
  개선하는 방향이다
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:15-38`
  - 상세: Schedule 모듈이 Trigger 모듈의 `TriggerDto`/엔티티를 직접 재사용하지 않고, 자신이 필요한
    4 필드(`id`/`name`/`workflowId`/`workflow.name`)만 담는 좁은 참조 DTO 를 자체 소유로 정의했다.
    이는 Trigger 응답 계약이 바뀌어도 Schedule 응답 계약이 영향받지 않게 하는 anti-corruption
    layer 패턴으로, 교차 모듈 결합도를 낮추는 바람직한 설계다.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** `contractForDto` 메모이제이션은 in-flight promise 캐싱까지 포함해 동시성 안전
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` (`contractForDto`/`buildContractForDto`,
    커밋 diff 상 `@@ -377,10 +389,39` 구간)
  - 상세: 클래스 참조를 키로 하는 모듈 레벨 `Map` 캐시이며, 실패한 promise 는 캐시에서 제거 후
    rethrow 하여 "한 번 실패하면 영원히 실패"를 피한다. 동시 호출이 프로브 모듈을 중복 부트스트랩하지
    않도록 진행 중인 promise 자체를 캐싱하는 점도 올바르다. 테스트 인프라의 전역 가변 상태이긴 하나
    프로덕션 코드 경로에 영향이 없고 그 성격에 맞는 스코프(Jest worker 단위 격리)로 문서화되어 있다.
  - 제안: 없음 — 설계상 문제 없음.

## 요약

이번 변경은 §5.4 응답-계약 스윕이 실측으로 드러낸 실제 결함(트리거 비밀 컬럼 유출, 조인을 통한
엔티티 전체 노출, DTO 선언 지연)을 계층 책임에 맞게 고쳤다는 점에서 아키텍처적으로 건전하다.
서비스가 내부적으로 소비하는 반환 타입은 건드리지 않고 "나가는 자리"(서비스의 자기 응답 정화,
컨트롤러의 조인 관계 좁히기)에서만 개입한 것은 SRP·레이어 책임 분리 관점에서 정확한 판단이며,
Schedule 모듈이 Trigger 의 DTO/엔티티를 재사용하지 않고 자체 참조 DTO 를 새로 둔 것도 모듈 경계를
강화하는 선택이다. 다만 이번 결함 자체가 "민감 필드 여부가 엔티티가 아니라 서비스 레이어의 수작업
목록 두 벌에 흩어져 있어 한쪽만 갱신되면 새는" 구조에서 비롯됐고, 그 구조는 이번 수정 후에도 그대로
남아 있다(엔티티 컬럼 축을 추가했을 뿐 SoT 를 통합하지는 않았음). 또한 "조인된 자식 엔티티가 응답에
통째로 실린다"는 결함 클래스가 이번이 두 번째 발견이면서도 서비스-레이어 스트립과 컨트롤러-레이어
매핑이라는 서로 다른 ad-hoc 해법으로 대응돼, 재사용 가능한 공용 패턴은 아직 없다. 두 관찰 모두 이번
PR 을 되돌릴 사안이 아니라 다음 라운드의 구조적 개선 후보로 남긴다.

## 위험도

LOW
