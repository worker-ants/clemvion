# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** DTO 4개 파일에 걸쳐 동일한 6줄 설명 주석이 글자 그대로 복제되어 있다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:104-110`
  - 상세: "── 아래 필드는 **이미 응답에 실려 나가고 있었다** ..." 로 시작하는 6줄 블록이
    네 파일에서 공백·문구 하나 다르지 않게 반복된다(직접 대조 확인). 코드 로직 복제는
    아니지만, §5.4 기본형 규칙의 근거 서술이라 규칙이 조금이라도 바뀌면(예: `nullable`
    조건이나 `@ApiPropertyOptional` 별칭 설명이 수정되면) 네 곳을 모두 찾아 갱신해야
    하고, 한 곳만 갱신되면 나머지 세 곳이 조용히 낡은 설명으로 남는다.
  - 제안: 이 규칙 설명을 `spec/conventions/` 의 §5.4 관련 문서(예 `swagger.md §3`)로
    한 번만 두고, 각 DTO 파일에서는 그 문서로 링크하는 한 줄만 남기는 편이 유지보수
    비용을 줄인다. 다만 이번 PR의 목적(선언을 실제에 맞추는 최소 개입)에 비춰 이 정도
    문서 중복이 병합을 막을 사유는 아니다.

- **[INFO]** `SchedulesController.toResponse` 가 한 메서드에서 세 가지 책임(비밀 필드
  드롭·`trigger` 미로드 불변식 검증/500 던지기·응답 형태 재구성)을 겸한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` —
    `toResponse` 메서드
  - 상세: "서비스가 아니라 컨트롤러에서 좁히는 이유"를 설명하는 주석이 있어 배치
    자체는 근거가 있지만, 검증(불변식 위반 시 로깅+`InternalServerErrorException`)과
    순수 데이터 재형성(참조 필드 추출)이 한 함수 본문에 섞여 있다. 실질 코드 라인은
    ~20줄로 과도하게 길지는 않으나, 다음에 이 메서드에 로직을 더 얹을 경우(예: 방어
    분기 추가) 책임이 더 뒤섞이기 쉬운 지점이다.
  - 제안: `assertTriggerLoaded(schedule): asserts schedule is Schedule & { trigger: Trigger }`
    같은 별도 가드 함수로 불변식 검증을 분리하면 `toResponse` 는 순수 형태 변환만
    남는다. 급하지 않은 리팩터 후보.

## 요약

18개 응답 DTO 로 §5.4 계약 검증 배선을 넓히는 스윕이자, 그 과정에서 드러난 트리거
비밀 컬럼 유출(조인을 통한 2차 유출 포함)과 `isActive`/PATCH 관련 응답 회귀를 함께
고친 변경이다. 핵심 로직(`TriggersService.sanitizeForResponse`)은 과거 리뷰가 지적한
78줄 단일 메서드를 `omitKeys`/`stripChatChannelSecrets`/`stripInteractionSecrets`/
`stripNotificationSigningSecrets`/`deleteSecretColumns`/`narrowWorkflowRef` 로 축(axis)별
단일 책임 함수로 쪼갠 상태로, 이름이 각자의 역할을 정확히 드러내고 중첩도 얕다
(`if (cfg) { if (...) {...} }` 2단 이내). `response-contract.ts`의 `allowMissing`/
`allowUndeclared` 옵션 명명은 서로 거울상으로 일관되고, `contractForDto` 의
DTO-클래스별 메모이제이션도 실패 promise 를 캐시에서 지우는 처리까지 포함해 꼼꼼하다.
반복되던 5곳의 트리거 참조 키셋 단언은 `schedule-trigger-ref.ts` 헬퍼로, 반복되던
계약 대조 호출은 `assertMatchesContract`/`contractForDto` 두 줄 패턴으로 각각 수렴했다.
함수 길이·중첩 깊이·순환 복잡도 모두 우려할 수준이 아니며, 네이밍은 목적과 등급
(`_KEYS` vs `_COLUMNS`, JSONB 내부 키 vs 엔티티 컬럼)을 정확히 구분해 일관적이다.
드러난 흠은 문서(주석) 수준의 4파일 verbatim 중복과 컨트롤러 헬퍼 하나의 경미한 책임
혼재뿐이며, 둘 다 실행 동작에는 영향이 없고 병합을 막을 사유가 아니다.

## 위험도
LOW
