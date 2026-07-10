# Rationale 연속성 검토 — `plan/in-progress/spec-fix-webchat-eia-drift.md`

## 발견사항

없음 — target 의 D-1/D-2/D-3 는 모두 기존 spec 의 `## Rationale` 및 그 하위 원칙과 충돌하지 않는다. 각 항목을 실제 SoT·코드·이전 plan 결정과 대조한 결과는 다음과 같다.

- **D-1 (`4-security.md` §4 "interact 분당 60 Planned" 제거·EIA §8.4 참조로 축약)**
  - EIA SoT (`spec/5-system/14-external-interaction-api.md:734,736`) 는 명확히 "**구현됨**" 이라고 기술하며, 코드(`interaction.controller.ts`)도 이를 뒷받침한다. `4-security.md:136` 의 "Planned" 서술이 실제 drift다.
  - EIA 자체 Rationale R16(`14-external-interaction-api.md:183-187`)이 "다른 §5.x 엔드포인트와 동일하게 `{ data: ... }` 봉투로 일관 처리" 등 **단일 진실 원칙**을 이미 여러 차례 적용해왔고, target 의 R-D1(중복 서술 제거 → 참조만 유지)은 `0-overview.md` Rationale 서두("본문은 latest-only 사실을 기술하고... 결정 근거는 본 절을 참조")에서 이미 확립된 것과 동일한 원칙의 적용이다. 새로운 결정 번복이 아니라 기존 SoT 원칙을 재확인하는 정정.
  - 이 항목은 애초에 `plan/in-progress/widget-presentation-restore.md §5`(2026-07-10, PR #901 진행 중 검출)에 동일 근거로 이미 등재돼 있어 target 문서의 서술과 완전히 일치한다.

- **D-2 (`_product-overview.md` NAV-WC-06 🚧 → ✅)**
  - 배지 조건문("증분 2 — 위젯 co-deploy 후")이 요구하는 선행조건은 `plan/complete/web-chat-console.md` Phase 1(위젯 동봉, 커밋 `e5cb32e9`)·Phase 3(라이브 미리보기, 커밋 `e5cb32e9`)에서 **양쪽 다 "✅ 완료"** 로 이미 종결돼 있다. `5-admin-console.md` 도 `status: implemented`. 즉 badge 가 스스로 명시한 게이트 조건이 충족된 상태에서 값만 뒤처진 stale case이며, 조건을 우회하거나 재해석한 것이 아니다.
  - R-D2("배지 flip 근거는 항상 코드다")는 이 저장소에서 반복적으로 확립된 관행(예: `plan/in-progress/widget-presentation-restore.md` R2-a, 그리고 MEMORY 의 "plan 체크박스 = 실제 상태" 피드백 항목)과 정합적이며 새로운 원칙 도입이 아니다.

- **D-3 (`embed-config` 응답 `{ data }` 봉투 3곳 보완)**
  - `hooks.controller.ts:64`의 코드 주석 자체가 "전역 TransformInterceptor 에 의해 `{ data: ... }` 로 래핑" 이라고 명시하며, `swagger.md §2-5`의 전역 wrap 규칙에도 `/api/hooks/*` 에 대한 예외가 없다(hooks 컨트롤러의 유일한 예외는 `@ApiBearerAuth` 생략뿐, `swagger.md:132`).
  - `3-auth-session.md` 안에서도 step 0(라인 44, unwrap)과 바로 다음 step 1(라인 46, wrap + "전역 TransformInterceptor 가 모든 성공 응답을 `{ data }` 로 래핑" 주석)이 **같은 문서 내에서 이미 불일치** — target 이 지적하는 drift 는 문서 내부에서도 자기모순적이었다.
  - 클라이언트(`use-widget.ts:42` `json.data ?? json`)가 이미 양쪽을 다 수용해 런타임 영향이 없다는 target 의 주장도 코드로 확인됨. 코드를 unwrap 으로 바꾸는 대안(계약 변경)을 채택하지 않고 문서만 SoT(`swagger.md`)에 맞추는 R-D3 의 판단은 기존 전역 규약을 그대로 따르는 것이며 어떤 과거 결정도 뒤집지 않는다.

세 항목 모두 "기각된 대안의 재도입", "합의 원칙 위반", "무근거 번복", "invariant 우회" 어느 관점에도 해당하지 않는다 — 반대로 각 수정은 `0-overview.md` 단일 진실 원칙, `swagger.md` 전역 wrap 규약, "배지는 코드로 실증" 관행 등 기존에 이미 합의된 원칙을 정확히 복원하는 방향이다. target 의 R-D1/R-D2/R-D3 는 모두 새 Rationale 을 갖춰 결정 근거를 남기고 있어 "새 Rationale 부재" 유형의 WARNING 도 발생하지 않는다.

## 요약
target 문서(`spec-fix-webchat-eia-drift.md`)의 D-1·D-2·D-3 는 전부 "구현이 옳고 문서가 뒤처진" 사전 존재 drift 를 정정하는 것으로, EIA §8.4·`swagger.md` 전역 wrap 규칙·완료된 `web-chat-console.md` Phase 1/3·기존 저장소 관행("배지는 코드로 실증") 등 이미 확립된 SoT·원칙과 전량 정합한다. 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하는 사례, 합의된 설계 원칙을 위반하는 사례, 무근거로 결정을 번복하는 사례, 시스템 invariant 를 우회하는 설계는 발견되지 않았다. target 자체의 `## Rationale`(R-D1/R-D2/R-D3)도 각 정정의 근거를 명시적으로 남기고 있어 Rationale 연속성 관점에서 완전히 건전하다.

## 위험도
NONE
