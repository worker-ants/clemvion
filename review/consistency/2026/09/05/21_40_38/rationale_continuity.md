# Rationale 연속성 검토 — sweep-response-contract-5ba0ad (impl-done, scope spec/5-system/)

## 메타

- diff-base: `origin/main`(`9a9c024a6`) → `HEAD`(`67881bbd4`)
- `spec/5-system/` 자체 델타: 0 파일 (정상 — 이 브랜치는 코드 전용 PR)
- 직전 라운드(`review/consistency/2026/09/05/20_45_39/rationale_continuity.md`, tip `a4e1e04dc`)는 이미 "없음/NONE" 으로 수렴했음을 확인. 본 라운드가 추가로 다루는 것은 그 이후 신규 커밋 `67881bbd4`("create() 를 고치고 자매 update() 를 두었다 — 대칭 복구 + 미검증 분기 4건") 하나뿐이며, `git show --stat 67881bbd4`/`git show <path>` 로 실 diff 를 워킹트리에서 직접 확보해 대조했다.
- 대조에 사용한 spec 근거: `spec/5-system/2-api-convention.md §5.4`(부재 표현 규약·검증 층), `spec/2-navigation/3-schedule.md` Rationale("Schedule 생성 경로만 trigger+schedule 2-step 생성을 보장"), `spec/2-navigation/4-integration.md` Rationale("Cafe24 App URL 상세 페이지 표시" — `IntegrationDto.appUrl: string | null`)

## 발견사항

없음. 신규 커밋 `67881bbd4` 는 기존 Rationale 을 뒤집거나 기각된 대안을 되살리는 새 설계 결정을 내리지 않는다 — 전부 이전 라운드에서 이미 확립된 원칙을 **일관되게 적용**하는 대칭 버그 수정·테스트 보강·문서 정정이다. 대조 과정에서 확인한 근거(발견 아님, 참고용):

- **`schedules.service.ts` — `saved.trigger = trigger ?? schedule.trigger` 를 `if (schedule.isActive)` 밖으로 이동**: 새 원칙 도입이 아니라 직전 라운드(`review/code/2026/09/05/20_45_37` W1)가 `create()` 에 이미 적용한 것과 **동일한 불변식**("trigger 는 isActive 와 무관하게 존재하며 응답도 그래야 한다")을 자매 메서드 `update()` 에도 적용한 것. 이 불변식 자체는 `spec/2-navigation/3-schedule.md` Rationale("Schedule 생성 경로만 trigger+schedule 2-step 생성을 보장한다")과 정합적이다 — schedule 이 있으면 trigger 도 항상 있다는 spec 의 기존 서술을 코드가 어기고 있던 것을 바로잡은 것이지, 새 규칙을 만든 것이 아니다.
- **`response-contract.ts`/`response-contract.spec.ts` — 실패 promise 캐시 축출 + `allowMissing` 중첩 경로 검증**: `§5.4 검증 층` 표(`spec/5-system/2-api-convention.md`)가 이미 규정한 "값 ↔ 선언" 런타임 검증자(`response-contract.ts`)의 **내부 정확성 보강**이다. 검증자의 판정 축(required/nullable 은 §5.4, undeclared 키는 swagger 규약 §5-1)을 재배치하거나 새 축을 만들지 않았고, §5.4 자신의 지시("판정 규칙의 상세 표는 코드의 JSDoc 이 단일 진실")를 그대로 따라 spec 본문에 옮겨 적지도 않았다.
- **CHANGELOG.md — `appUrl` 을 "키 생략형 예외"에서 "기본형"으로 정정**: 이 정정은 오히려 `spec/2-navigation/4-integration.md` Rationale("Cafe24 App URL 상세 페이지 표시")이 이미 `IntegrationDto.appUrl: string | null` 로 명시해 둔 타입(→ nullable 상시 존재, 기본형)과 **더 일치**하는 방향이다. e2e 계약 대조(`assertMatchesContract`)가 첫 판의 잘못된 선언(키 생략형)을 반증해 바로잡은 것으로, §5.4 검증 층이 설계대로 작동한 사례이며 결정 번복이 아니라 오류 정정이다.
- **plan 항목 신설("§5.4 래칫 canary fixture 를 `code:` 에 등재")**: `2-api-convention.md §5.4` Rationale 이 이미 명시한 원칙("두 검증자가 양쪽 문서의 `code:` 에 모두 등재돼 있다 — 한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다")을 fixture 파일에도 동일하게 적용하려는 후속 조치이며, 이번 커밋은 이를 아직 실행하지 않고 planner 백로그로만 등재했다 — 원칙과 상충 없음.

## 요약

이번 라운드가 다루는 신규 델타(`67881bbd4`)는 직전 라운드가 확립한 판정("NONE")을 뒤집을 만한 새 설계 결정을 포함하지 않는다. `schedules.service.update()` 수정은 `create()` 에 이미 적용된 불변식의 대칭 적용이고, `response-contract.ts` 변경은 §5.4 가 이미 규정한 검증자의 내부 결함 수정이며, CHANGELOG 정정은 기존 Rationale(`appUrl: string | null`)과의 정합성을 오히려 높이는 방향이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 발견하지 못했다.

## 위험도

NONE
