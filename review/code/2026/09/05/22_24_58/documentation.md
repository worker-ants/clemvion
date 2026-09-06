# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `TriggerDto` 를 설명하던 한 줄 주석이 새로 삽입된 `TriggerWorkflowRefDto`
  클래스 앞으로 밀려나, 지금은 **`TriggerDto` 가 아니라 `TriggerWorkflowRefDto` 바로 위에
  붙는** 상태가 됐다 (JSDoc-대상 분리, 이 세션에서 여러 차례 재발한 것과 같은 결함 클래스).
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:7`
    (`/** 트리거 응답 DTO */`) 직후 `:8-17` 에 새 JSDoc 블록, `:18` 에
    `export class TriggerWorkflowRefDto {`, 그리고 `:28` 에 가서야
    `export class TriggerDto {` 가 나온다.
  - 상세: 이 diff 이전에는 `/** 트리거 응답 DTO */` 가 `export class TriggerDto` 바로 위에
    있어 그 클래스를 설명했다. 이번 diff 가 `TriggerWorkflowRefDto` 클래스(자신의 상세한
    JSDoc 포함)를 그 한 줄 주석과 `TriggerDto` 사이에 끼워 넣으면서, 원래 주석을 함께
    옮기지 않았다. 결과: (1) `export class TriggerDto` 는 이제 바로 위에 어떤 문서 주석도
    없다 — IDE 호버·TypeDoc 은 이 공개 클래스에 대해 아무 설명도 보여주지 못한다. (2)
    `/** 트리거 응답 DTO */` 는 지금 `TriggerWorkflowRefDto` 를 설명하는 JSDoc 블록 바로
    앞자리에 놓여, 사람이 위에서 아래로 읽으면 "트리거 응답 DTO" 라는 문구 직후에
    "워크플로우 참조" 를 설명하는 별개 블록이 이어지는 모양이라 어느 클래스를 가리키는지
    혼동을 준다. 같은 형태의 결함(새 선언을 기존 JSDoc 과 그 대상 사이에 끼워 넣어 문서가
    엉뚱한 심볼에 귀속됨)이 이번 PR 의 review 이력에서 이미 `TRIGGER_RESPONSE_STRIP_COLUMNS`
    (`review/code/2026/09/05/19_08_18`), `contractForDto`/`contractCache`
    (`review/code/2026/09/05/20_45_37`), 가드 스펙 `describe` 블록(`review/code/2026/09/05/21_40_37`
    INFO#6, "이 PR 에서 세 번째 재발") 세 차례 지적·수정됐는데, 바로 그 21_40_37 라운드가
    `TriggerWorkflowRefDto` 를 신설하면서 같은 패턴을 네 번째로 재현했다. 그 라운드의
    documentation.md 는 이 파일을 "이미 해소됨" 으로 확인했을 뿐 이 신규 삽입 자체는
    점검하지 않았다 — 즉 지금까지 어떤 라운드에서도 잡히지 않은 새 결함이다.
  - 제안: `/** 트리거 응답 DTO */` 를 `export class TriggerDto {` (28행) 바로 위로 옮긴다.
    `TriggerWorkflowRefDto` 는 이미 자신을 설명하는 충분한 JSDoc(8-17행)을 갖고 있으므로
    그 한 줄이 없어도 된다.

- **[INFO]** `SchedulesController.toResponse()` 의 지역 변수명 `t` 가 여전히 축약형으로
  남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68`
    (`const t = schedule.trigger;`), 사용처 `:78-81`.
  - 상세: 이전 세 라운드(`18_23_02`/`21_40_37` documentation·maintainability)가 동일하게
    지적했고 매번 "조치 불요(이월)" 로 처분된 항목이다. 기능·정확성에는 영향이 없다.
  - 제안: 조치 불요(기록용, 이월 계속).

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 동일한 배경 설명 주석 블록이
  4개 DTO 파일(`alert-rule-response.dto.ts`, `integration-response.dto.ts`,
  `knowledge-base-response.dto.ts`, `trigger-response.dto.ts`)에 거의 그대로 반복된다 —
  이전 라운드에서 반복 지적·이월된 항목이며 최종 diff 에도 그대로 남아 있다.
  - 상세: 코드 중복이 아니라 설명 주석 중복이라 위험도는 낮고, 각 파일의 FE 참조 수
    등 파일별 고유 정보도 함께 담고 있어 완전한 추출은 어렵다. 이 서사(§5.4 스윕 경위)를
    나중에 정정할 일이 생기면 4곳을 모두 찾아 동기화해야 한다는 점만 유의.
  - 제안: 조치 불요(이월).

## 교차검증 (반증 시도)

과거 라운드가 지적했던 문서 결함이 현재 diff 상태에서 실제로 해소돼 있는지 소스를 직접
열어 재확인했다 — 아래는 전부 **해소 확인**:

- `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` JSDoc — 이제 그 상수 선언
  바로 위(`:75-88` 부근)에 있고, `NOTIFICATION_SIGNING_STRIP_KEYS` 와 순서가 겹치지 않는다.
- `triggers.service.ts` 의 `sanitizeForResponse` — 옛 JSDoc(rename 전) 이 삭제되고 새
  JSDoc 하나만 메서드 바로 위(`:557-584`)에 있다. "항상 새 객체를 반환한다" 는 참조
  동일성 경고도 포함돼 있다.
- `response-contract.ts` 의 `contractForDto` — JSDoc 블록이 함수 선언(`:412`) 바로 위에
  있고, `contractCache` 상수(`:386`)에는 별도의 짧은 한 줄 주석이 붙어 서로 분리됐다.
- `CHANGELOG.md` 의 `appUrl` 서술 — "첫 판은 키 생략형이었는데 e2e 계약 대조가 반증해
  기본형으로 정정" 이라고 정확한 최종 상태(§5.4 기본형, `nullable: true` + `string | null`)
  를 서술하며, 실제 `integration-response.dto.ts:134-135` 선언과 일치한다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 하단 `## 종결 조건` 표 —
  종전에 두 번 낡았던 구체 수치("4개 DTO"·"60개 중 56개")가 이번 diff 에서 제거되고
  본문 포인터("「스윕 1차」 참조")로 대체됐다.
- 정량 서술 재검증: CHANGELOG "23필드"(DTO 별 7+6+7+2+1=23 합계 일치),
  `swagger-dto-contract.spec.ts`/`swagger-dto-contract-guard.ts` 의 "78건"
  (`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 원소 78개와 일치), 그리고
  "2026-09-05 스윕 커밋이 17개 필드를 금지 조합으로 새로 선언했다" — 스윕 원 커밋
  (`dfb2664af`)의 실제 선언을 세어(`TriggerDto` 5 · `IntegrationDto` 5 · `KnowledgeBaseDto`
  4 · `AlertRuleDto` 2 · `ScheduleDto.trigger` 1 = 17) 정확히 일치함을 확인.

## 요약

이 diff(§5.4 응답-계약 검증자 4→18 DTO 배선 + 트리거/스케줄 회전 secret 이중 유출 수정 +
23필드 선언 보정 + `swagger-dto-contract-guard.ts` 세 번째 축 신설)는 이미 네 라운드의
코드 리뷰와 네 라운드의 consistency 검토를 거치며 문서화 결함 다수(주석-대상 분리, stale
CHANGELOG 서술, plan 표 수치 낡음 등)를 반복적으로 잡아 정정했고, 그 이력을 직접 소스
대조로 재확인한 결과 전부 실제로 해소돼 있었다. CHANGELOG·plan 트래커·각 DTO 인접 주석의
정량 서술(23필드, 78건, 17건)도 실측과 정확히 일치한다. 다만 이번 라운드에서 새로
발견한 것이 하나 있다 — 바로 그 정정 라운드들 중 하나(`21_40_37`, `TriggerWorkflowRefDto`
신설)가 이 세션이 이미 세 차례 겪은 "새 선언을 기존 JSDoc 과 그 대상 사이에 끼워 넣어
문서가 엉뚱한 심볼에 귀속되는" 패턴을 `trigger-response.dto.ts` 에서 네 번째로 재현했고,
이후 어떤 라운드도 그 자리를 다시 점검하지 않아 지금까지 남아 있었다. `TriggerDto` 는
현재 문서 주석이 전혀 없는 상태이고 `/** 트리거 응답 DTO */` 는 엉뚱한 클래스 앞에
붙어 있다 — 동작에는 영향이 없으나 다음 사람이 이 자주 참조되는 공개 응답 DTO 를 열었을
때 문서가 안 보이거나 오귀속된 설명을 보게 되는 실질적 비용이다. README·API 문서·
환경변수 설정 문서를 갱신할 새 공개 기능·설정은 이 변경에 없다(내부 테스트 유틸리티·
정적 가드·DTO 선언 보정 범위).

## 위험도

LOW
