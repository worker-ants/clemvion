# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `CHANGELOG.md` 신규 섹션(트리거 회전 secret 유출)과 바로 다음 기존 섹션 사이에
  빈 줄이 두 번 들어가, 파일 전체의 "`## Unreleased` 항목 사이 빈 줄 1개" 관례와 어긋난다.
  - 위치: `CHANGELOG.md:80-81` (78행 "...래칫이다." 문장 끝과 82행 `## Unreleased — GET
    /api/audit-logs...` 사이의 두 빈 줄). 파일의 다른 모든 섹션 경계(예: 121행 부근,
    `## Unreleased — AlertRuleDto.threshold...` 앞)는 빈 줄이 하나뿐임을 대조 확인했다.
  - 상세: 렌더링에는 영향이 없으나(Markdown 은 연속 빈 줄을 하나로 접는다), raw diff 를
    읽거나 `git blame`/lint 로 포맷을 점검할 때 이 파일에서만 이질적인 두 줄짜리 간격이
    남는다. 신규 섹션을 파일 맨 위에 삽입하면서 뒤에 오는 원래 섹션과의 경계 처리가
    한 줄 어긋난 것으로 보인다.
  - 제안: 80행 또는 81행 중 하나를 제거해 다른 섹션과 동일하게 빈 줄 1개로 맞춘다.

- **[INFO]** `SchedulesController.toResponse()` 안의 지역 변수명 `t` 가 이 메서드의 상세한
  JSDoc(보안 경계 서술)과 대비되어 여전히 축약돼 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68`
    (`const t = schedule.trigger;`), 사용처 `:71-79`.
  - 상세: 이전 라운드(`review/code/2026/09/05/18_23_02/maintainability.md`)에서 동일하게
    지적됐고 "조치 불요(이월)" 로 처분된 항목이다. 이번 최종 diff 에서도 그대로 남아 있어
    참고로 다시 적는다 — 기능·문서 정확성에는 영향이 없는 순수 가독성 사안이라 이 라운드를
    막을 사유는 아니다.
  - 제안: 조치 불요(기록용). 다음에 이 메서드를 만질 일이 생기면 `t` → `trigger` 로 바꾸는
    편이 낫다.

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 동일한 배경 설명 주석 블록이
  4개 DTO 파일에 거의 그대로 반복된다 — 이전 라운드에서도 지적·이월된 항목으로, 최종
  diff 에서도 유지되어 있다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:69-75`.
  - 상세: 코드 중복이 아니라 설명 주석의 중복이라 위험도는 낮다. 각 DTO 마다 소비처(FE
    참조 수 등) 서술이 달라 완전한 추출은 어렵고, 이 저장소 관례("근거는 해당 문서에
    자기완결적으로")와도 충돌하지 않는다. 다만 이 서사(§5.4 스윕 경위)를 나중에 정정할 일이
    생기면 4곳을 모두 찾아 동기화해야 한다.
  - 제안: 조치 불요. 다음에 이 서사가 바뀔 때 4곳 전수 grep 동기화가 필요하다는 점만 기억.

## 교차검증 (반증 시도, 전부 통과)

문서화 관점에서 특히 의심스러운 정량 서술·주석-코드 일치 여부를 실측으로 대조했다 —
전부 실제 상태와 일치했다.

- `CHANGELOG.md` "선언이 뒤처져 있던 **23필드**" — 표의 DTO 별 필드 수(7+6+7+2+1)를 실제
  diff 와 대조해 합계 23 이 정확함을 확인.
- `CHANGELOG.md`·`swagger-dto-contract-guard.ts` 의 "**78건**" — `EXPECTED_OPTIONAL_
  NULLABLE_DRIFT` 배열(`swagger-dto-contract.spec.ts`)의 실제 원소 수를 세어 78 로 일치
  확인.
- `execution-response.dto.spec.ts` 상단 주석의 "**10개**" — `OPTIONAL_NULLABLE_DRIFT`
  배열의 실제 원소 수(10)와 일치.
- `IntegrationDto.appUrl` 주석("`{ appType: null, appUrl: null }` 기저값 위에 얹는다")을
  `IntegrationsService.toPublic`/`INTEGRATION_META_BASELINE` 실제 구현과 대조해 일치 확인.
- `triggers.service.ts` 의 `sanitizeForResponse` — 이전 두 라운드(`19_08_18`)의
  documentation 리뷰가 지적한 "JSDoc 블록이 대상 상수에서 떨어져 나감"·"rename 후 옛
  JSDoc 이 새 JSDoc 과 나란히 잔존" 두 건은 최종 diff에서 각각 자기 상수 바로 위로 재배치,
  단일 JSDoc 으로 병합돼 **실제로 해소**돼 있음을 현재 파일 상태로 재확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 인용하는
  "`formatVersion` 은 Planned 미구현" — `spec/2-navigation/1-workflow-list.md:153` 의
  실제 문구와 대조해 일치. `workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']`
  주석이 이 spec 출처를 정확히 가리킨다.
- `swagger-dto-contract-guard.ts` 의 "§5.4 자신이 '요청 바디는 대상이 아니다' 라고 적는다"
  및 "같은 커밋이 다른 파일에서 '동결, 확대 금지' 라고 적어 뒀다" — 후자의 실제 출처는
  `plan/in-progress/spec-draft-nullable-notation-followups.md:421` 이며, 문구가 실재함을
  확인(spec 본문이 아니라 plan 트래커라는 점도 정확).

## 요약

이 변경분(§5.4 응답-계약 검증자를 18개 DTO 로 넓히는 스윕 + 트리거 회전 secret 유출 수정 +
23필드 선언 보정 + 새 래칫 가드)은 문서화 관점에서 전반적으로 높은 완성도를 보인다.
CHANGELOG 는 발견 경위·영향·원인·수정·재발방지를 구조적으로 서술하고 각 DTO 파일의 신규
필드는 "왜 이 형태(§5.4 기본형)인가"를 인접 주석으로 남겼으며, `response-contract.ts` 의
`contractForDto`/`allowMissing` JSDoc 은 설계 근거(메모이제이션 이유, 실패 캐시 배제, 면제
사용 조건)를 코드와 함께 정확히 담고 있다. 여러 라운드의 사전 코드/일관성 리뷰가 지적한
문서 결함(rename 후 stale 메서드명 주석, JSDoc-대상 분리, enum 누락, CHANGELOG 수치
불일치 등)은 이번 최종 diff 상태에서 실제로 해소돼 있음을 직접 대조로 확인했다. 남은
항목은 전부 이전 라운드에서 이미 INFO 로 이월 처리된 사소한 사안(변수명 `t`, 4파일 주석
반복)과, 이번에 새로 발견한 CHANGELOG 의 빈 줄 포맷 사소한 불일치 하나뿐이며 셋 다 기능·
정확성에 영향이 없다. README·API 문서·환경변수 설정 문서를 갱신할 새 공개 기능·설정은
이 변경에 없다(내부 테스트 유틸리티·정적 가드·DTO 선언 보정 범위).

## 위험도

LOW
