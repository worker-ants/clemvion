# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** CHANGELOG 의 "트리거 회전 secret" 보안 공지가 같은 브랜치에서 추가로 발견·수정된
  두 건의 secret 유출을 누락했다 — `config.interaction.triggerToken`(영구 평문 bearer 토큰)과
  `config.notification.signing.secret`/`secretRef`.
  - 위치: `CHANGELOG.md` (파일 최상단 "Unreleased — 트리거 회전 secret 이 두 엔드포인트로
    나갔다" 항목, 실제 파일 1~96행). 특히 63~69행의 "선언 추가" DTO 표와 44~49행의
    "회귀 테스트가 고정한다" 단락.
  - 상세: CHANGELOG 최상단 항목은 `notificationSecretV2`·`chatChannelTokenV2` 두 필드에 대해
    무엇이 샜는지, 어느 엔드포인트로, 누가 영향받는지, 소비자가 취해야 할 조치("응답 본문을
    기록하는 클라이언트 로그·APM·프록시 캐시를 점검하고, 해당 트리거의 notification secret
    회전을 권고한다")까지 상세히 적었다. 그런데 같은 브랜치의 후속 커밋 두 개가 **같은 등급의
    secret 유출**을 추가로 찾아 고쳤는데도 CHANGELOG 는 갱신되지 않았다:
    - 커밋 `66a2510fd` ("§1.1 이 세 필드를 열거했는데 둘만 닫았다 — triggerToken 스트립")는
      `secret-store.md §1.1` 이 이름으로 금지한 세 필드 중 `config.interaction.triggerToken`
      (`itk_*`, 영구 평문 bearer 토큰)이 `GET/POST/PATCH /api/triggers` 응답에 그대로
      나가고 있던 것을 고쳤다. 이 커밋의 CHANGELOG diff 는 빈 줄 하나를 지운 것이 전부다
      (`git show 66a2510fd -- CHANGELOG.md` 로 직접 확인).
    - 커밋 `cb17f0870` ("§5.4 금지 조합을 내가 넓혔다 — 정정 + 래칫 가드 신설")는
      `config.notification.signing.secret`/`secretRef` 가 스트립 목록에 없었다고 커밋
      메시지에 명시하지만("`botTokenRef` 를 빼는 것과 같은 등급·같은 이유인데 chat-channel
      쪽 목록에만 있었다"), CHANGELOG 에는 이 secret 유출에 대한 언급이 없다.
    - `secret-store.md §1.1` 은 `config.interaction.triggerToken` 을 응답 비노출 대상으로
      **규범 문서에는** 이미 이름으로 등재해 두었지만(89행), 그것이 실제로 유출**됐었고**
      이 브랜치가 그것을 **닫았다**는 사실은 CHANGELOG 어디에도 없다
      (`grep -n "triggerToken\|signing" CHANGELOG.md` 로 확인 — 매치 0건).
  - 제안: CHANGELOG 의 해당 "Unreleased" 항목 표에 두 필드를 추가하거나(`triggerToken` ·
    `notification.signing.secret`/`secretRef`), 별도 소단락으로 "같은 스윕이 두 필드를
    더 찾았다" 를 적어 영향 범위·권고 조치를 기존 두 필드와 같은 수준으로 명시한다.
    `triggerToken` 은 **영구** bearer 토큰이라 회전 즉시 무효화되므로("revoke 가 값
    교체로 즉시 무효화"), 회전 권고 문구가 특히 유의미하다.

- **[WARNING]** `TriggerDto.workflow` 가 이전에 조인된 `Workflow` **엔티티 전체**를 선언 없이
  내보내고 있었다는 사실과, `PATCH /api/triggers/:id` 응답에서 `name` 필드가 통째로 사라지던
  버그가 CHANGELOG 에 기록되지 않았다.
  - 위치: `CHANGELOG.md` (동일 최상단 "Unreleased" 항목). 대조군: `ScheduleDto.trigger` 의
    동일 유형 결함은 1~40행에서 매우 상세히 다뤄진다(무엇이 샜는지, 어느 소비자가 어떤
    필드를 쓰는지 저장소 전수 확인까지).
  - 상세: `trigger-response.dto.ts` 의 `TriggerWorkflowRefDto` 도입 주석은 이렇게 적는다 —
    *"`findAll` 의 `leftJoinAndSelect('t.workflow','w')` 와 `findById` 의
    `relations: ['workflow']` 가 **Workflow 엔티티 전체**를 실어 왔고 `TriggerDto` 는 그것을
    선언조차 하지 않았다."* `ScheduleDto.trigger` 사례와 **구조적으로 동일**한 미선언
    전체-엔티티 유출이다(둘 다 §5.4 스윕이 검출, 둘 다 참조 타입으로 좁힘). 그런데
    `ScheduleDto.trigger` 는 CHANGELOG 최상단에 원인·수정·영향 분석까지 실렸고,
    `TriggerDto.workflow` 는 코드 주석과 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에만 남아 있다(`grep -n "TriggerWorkflowRefDto\|narrowWorkflowRef" CHANGELOG.md` 매치
    0건). 같은 커밋(`7e85da873`)이 함께 고친 `name [missing] on PATCH` 버그
    (`Object.assign(trigger, rest, …)` 가 로드된 `name` 을 `undefined` 로 덮어써 PATCH
    응답에서 필드가 사라지던 결함)도 CHANGELOG 미기재다 — 이쪽은 secret 유출은 아니지만
    실제 API 응답 형태가 깨졌던 사용자 관측 가능한 버그이므로 다른 "wire 변경" 항목들과
    같은 취급이 합당하다. 이 커밋 자체가 CHANGELOG.md 를 전혀 건드리지 않았다
    (`git show --stat 7e85da873 -- CHANGELOG.md` 출력 없음).
  - 제안: `ScheduleDto.trigger` 소단락과 대칭으로 "`TriggerDto.workflow` 도 같은 처방" 한
    문단을 추가하고, `name [missing]` 버그는 별도 줄로 — Workflow 엔티티에는 secret 이
    없으므로 회전 권고까지는 불필요하지만, 응답 형태가 바뀐 사실(`description`·`tags`·
    `settings`·`folder`·`creator` 등 부가 필드가 더 이상 안 실림)과 PATCH 버그 수정
    사실은 CHANGELOG 관례상 기록 대상이다.

- **[INFO]** `workflow-crud.e2e-spec.ts` 에서 같은 모듈의 두 DTO 를 import 두 줄로 나눠
  선언했다 — 기능상 문제 없는 스타일 수준 사소함(이미 이 세션의 `scope.md` 리뷰가 지적·
  불요 처분한 항목과 동일).
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13` (`ExportWorkflowDto` import)
    /  `:14` (`WorkflowDto` import, 같은 파일에서 옴).
  - 상세: 문서화 관점에서는 조치 불요 — 언급은 완전성을 위해서다.
  - 제안: 조치 불요.

## 요약

이 PR 은 문서화 관행이 이례적으로 철저하다 — CHANGELOG 는 발견된 근본 원인·영향 범위·소비자
조치 지침까지 담고, 모든 신규 DTO 필드·상수·헬퍼 함수는 "왜" 를 설명하는 JSDoc/인라인 주석을
동반하며(내부 서사는 `swagger.md §3` 규약에 따라 `//` 로, 공개 API 설명은 `/** */` 로 명확히
분리), 이전 라운드의 틀린 근거·주석을 실측으로 반증해 정정한 이력이 코드 곳곳에 남아 있다.
plan 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)는 완료·유예·후속
항목을 세밀하게 갱신했고, 스코프 밖으로 남긴 결정(`consecutiveNetworkFailures` 제거 보류,
2차 스윕 대상 등)도 근거와 함께 새 백로그 항목으로 등재했다. 다만 이런 높은 기준 자체가
CHANGELOG 완전성의 결함 두 건을 도드라지게 만든다 — 같은 브랜치에서 추가로 발견·수정된
secret 유출(`interaction.triggerToken`·`notification.signing.secret`) 과 별도의 엔티티-전체
유출(`TriggerDto.workflow`) + PATCH `name` 소실 버그가, 구조적으로 동일한 자매 결함
(`notificationSecretV2`/`chatChannelTokenV2`, `ScheduleDto.trigger`)이 받은 것과 같은 수준의
CHANGELOG 공지를 받지 못했다. 코드 주석·plan 트래커에는 남아 있으니 개발팀 내부에서는
추적 가능하지만, CHANGELOG 만 보는 소비자(운영·보안 담당)에게는 이 두 secret 유출과 한
API 버그가 보이지 않는다.

## 위험도
MEDIUM
