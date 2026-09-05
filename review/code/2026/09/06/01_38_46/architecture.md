# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 응답 경계에서 "엔티티 → 안전한 응답 형태" 로 좁히는 동일 성격의 책임이 이 PR 안에서
  서로 다른 레이어(컨트롤러 vs 서비스)에 놓였다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:71` (`private toResponse`) vs
    `codebase/backend/src/modules/triggers/triggers.service.ts:698` (`private sanitizeForResponse`) +
    `triggers.service.ts:190` (`function narrowWorkflowRef`)
  - 상세: 두 메서드 모두 "조인된 연관 엔티티를 응답 직전에 참조 수준으로 좁히고 비밀 컬럼을
    제거한다" 는 동일한 문제를 푼다. `SchedulesController.toResponse` 는 **컨트롤러**에,
    `TriggersService.sanitizeForResponse`(+`narrowWorkflowRef`)는 **서비스**에 있다.
    `schedules.controller.ts:67-69` 주석은 "서비스 반환 타입을 좁히면 내부 로직(`update()` 가
    `trigger.isActive` 를 만지는 경로)이 깨지므로 나가는 자리에서 좁힌다" 고 설명하는데, 정작
    `TriggersService.sanitizeForResponse` 도 정확히 같은 기법(원본을 변경하지 않고 반환 직전에
    새 사본만 좁힌다, `triggers.service.ts:678` "엔티티를 변경하지 않는다 — 항상 새 객체를
    돌려준다")을 쓴다. 즉 두 모듈이 같은 기법으로 같은 문제를 풀면서 배치 레이어만 다르다 —
    다음에 세 번째 모듈(예: webhook trigger 목록 같은)이 같은 문제를 만나면 어느 레이어
    관례를 따라야 하는지 코드베이스에 단일 답이 없다.
  - 제안: 시급하지 않다(둘 다 정상 동작하고 각자 근거가 문서화돼 있다). 다음에 같은 패턴이
    필요할 때는 "응답 경계 좁히기는 어디에 두는가" 를 컨벤션 문서(`spec/conventions/` 또는
    `api-convention.md`)에 한 줄로 명문화해 두면, 세 번째 사례부터는 판단 비용 없이 재사용
    가능하다.

- **[INFO]** 응답 좁히기 매핑이 DTO 클래스와 타입 수준으로 연결되지 않은 손수 작성 객체
  리터럴이다 — 이 PR 이 고치고 있는 "선언 vs 실제" drift 클래스가 매퍼 계층 자체에서 재발할
  수 있는 자리.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:104-112` (`toResponse` 의
    반환 객체), `codebase/backend/src/modules/triggers/triggers.service.ts:741-745` (`overrides.workflow`)
  - 상세: `toResponse` 는 `{ id: t.id, name: t.name, workflowId: t.workflowId, ...(t.workflow ? {...} : {}) }`
    를 손으로 나열하고, 이 형태는 `ScheduleTriggerRefDto`(`schedule-response.dto.ts`)의 필드
    목록과 **문자열로만** 일치해야 한다. `tsc` 는 이 함수의 반환 타입을 `ScheduleDto` 로
    선언하지 않으므로(추론된 타입), `ScheduleTriggerRefDto` 에 새 필드가 추가돼도 컴파일러가
    `toResponse` 의 리터럴 누락을 잡아 주지 않는다. 지금은 `schedule-trigger-ref.ts` 의
    `expectNarrowedScheduleTriggerRef` 헬퍼 + e2e `assertMatchesContract` 가 이 간극을 **테스트로**
    막고 있지만, 그것은 구조적(타입) 안전망이 아니라 테스트 커버리지에 의존하는 안전망이다 —
    정확히 이 PR 이 78곳에서 발견한 "선언은 있는데 강제되지 않는다" 문제와 같은 형태가
    매퍼 함수 안에 남아 있는 것이다.
  - 제안: 조치 불요(현재 테스트 안전망이 실효성 있게 동작 중임을 확인했다). 다만 향후 이런
    수동 매퍼가 늘어나면, 반환 타입을 명시적으로 DTO 클래스로 어노테이션하거나
    `Pick<Trigger, 'id'|'name'|'workflowId'>` 같은 유틸리티 타입으로 원본과 반환 타입을 링크해
    컴파일러가 필드 목록 drift 를 잡게 하는 편이 테스트에만 의존하는 것보다 견고하다.

- **[INFO]** 모듈 경계를 넘는 테스트 전용 의존 — `modules/executions` 스펙이 `repo-guards/__tests__`
  의 순수 함수를 직접 import 한다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts:13`
    (`import { findOptionalNullableResponseFields } from '../../../../repo-guards/__tests__/swagger-dto-contract-guard'`)
  - 상세: `repo-guards/__tests__` 는 원래 저장소 전수 스캔용 가드 모음이 사는 자리인데, 개별
    도메인 모듈의 스펙이 그 스캐너 함수를 직접 끌어다 쓴다. 의도는 문서화돼 있고
    (`execution-response.dto.spec.ts` 헤더 — "두 목록을 서로 비교하는 대신 양쪽의 공통
    출처에 이 파일을 물린다"), 부작용 없는 순수 함수 호출이라 실질 위험은 낮다. 다만 이
    디렉터리 이름(`repo-guards/__tests__`)이 "저장소 전수 가드" 라는 스코프를 표방하는데
    개별 모듈이 거기 의존하는 형태라, 이 함수가 앞으로 저장소 스캔에 특화된 방향으로
    바뀌면(예: 캐싱을 저장소 루트 기준으로 건다) 이 모듈 테스트가 예상 못 한 영향을 받을 수
    있다.
  - 제안: 조치 불요. 다만 이런 교차 의존이 세 번째 자리에 또 생기면, 공유 함수를
    `repo-guards/__tests__` 밖의 중립적 위치(예: `shared/testing`)로 옮기는 편이 "레이어 밖으로
    나가는 의존" 이라는 신호를 줄인다.

## 잘 된 점 (참고)

- `response-contract.ts` 는 "응답 값 vs DTO 선언" 이라는 단일 책임을 갖고,
  `swagger-dto-contract-guard.ts`(선언 vs TS 타입, 정적)와 명확히 경계를 나눈 문서(판정 규칙
  표)를 갖고 있다 — 두 검증자가 책임을 침범하지 않는다.
- `TriggersService.sanitizeForResponse`(`triggers.service.ts:698`)는 종전 78줄 단일 메서드였던
  것을 축별 이름 있는 순수 함수(`stripChatChannelSecrets`/`stripInteractionSecrets`/
  `stripNotificationSigningSecrets`/`deleteSecretColumns`/`narrowWorkflowRef`)로 분해했고, 자신을
  얇은 오케스트레이터로 문서화했다 — SRP 개선.
- `swagger-dto-contract-guard.ts` 는 파서 순수 로직(스캔 3축: presence/null, optional+nullable
  금지 조합, numeric-as-number)과 소비 스펙을 분리하는 저장소 관례를 따르고, 정규식이 세 번
  틀렸던 이력을 근거로 TS AST 파서를 쓴다 — 적절한 추상화 수준 선택.
- `src/shared/testing/**` 는 `@nestjs/testing` devDependency 를 끌어오므로 `tsconfig.build.json`
  에서 명시적으로 프로덕션 빌드 제외 처리돼 있다(기존 관례, 이 PR 이 정확히 지킨다) — 레이어
  경계(테스트 인프라가 프로덕션 번들로 새지 않음)가 실제로 강제되고 있다.
- e2e 전반에 걸친 `assertMatchesContract(payload, await contractForDto(Dto))` 한 줄 배선은
  확장성이 좋다 — 새 엔드포인트를 계약 대조에 편입시키는 비용이 상수(한 줄)로 유지된다.

## 요약

이 변경은 응답-계약 검증자(§5.4) 배선을 4개→18개 DTO 로 넓히는 응집력 있는 스윕이며, 검증자
자체(`response-contract.ts`, `swagger-dto-contract-guard.ts`)는 책임 분리·추상화 수준·정적 vs
런타임 검증자 간 경계가 명확하게 설계돼 있다. 스윕 도중 드러난 트리거 secret 유출 수정
(`TriggersService.sanitizeForResponse` 4축 분해)도 SRP 개선을 동반한 양호한 리팩터다. 발견된
사항은 전부 CRITICAL/WARNING 이 아니라 INFO 수준의 구조적 관찰이다 — 같은 문제(응답 경계에서
연관 엔티티 좁히기)가 두 모듈(schedules/triggers)에서 서로 다른 레이어(컨트롤러/서비스)에
놓였고, 그 매핑이 컴파일러가 아니라 테스트로만 DTO 선언과 연결돼 있다는 점, 그리고 모듈
스펙이 `repo-guards/__tests__` 스캐너를 직접 참조하는 경계 넘기가 있다는 점이다. 셋 다 문서화된
근거가 있고 즉각적인 위험은 낮다.

## 위험도
LOW
