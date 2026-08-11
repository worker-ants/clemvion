# 신규 식별자 충돌 검토 — spec/conventions (impl-done)

## 발견사항

- **[INFO]** `'owner 이상 권한 필요'` 는 저장소 최초 도입 문구 — 충돌은 없음
  - target 신규 식별자: `'owner 이상 권한 필요'` (`@ApiForbiddenResponse` description)
  - 기존 사용처: 저장소 전체 grep 결과 이 정확한 문자열의 선재 사용처 **없음**. 도입처는
    `codebase/backend/src/modules/executions/executions.controller.ts:221,242`
    (`@Roles('owner')` 테스트 훅 2곳, `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`
    리뷰 라운드에서 codemod 로 부착).
  - 상세: `spec/conventions/swagger.md` §5-4 는 `'<role> 이상 권한 필요'` 를 **역할 문자열을
    그대로 꽂는 기계적 패턴**(예시로 `'editor 이상 권한 필요'`)으로 정의하고 있고, `owner`
    도 `spec/data-flow/12-workspace.md:202` 의 역할 열거(`owner/admin/editor/viewer`)에 속한
    유효한 역할명이므로 패턴 적용은 규약을 그대로 따른 것 — 다른 의미로 이미 쓰이던 식별자와
    부딪힌 것이 아니라 **패턴의 첫 인스턴스**다. 저장소에 이미 있던 owner 전용 표현은
    `spec/5-system/1-auth.md:380` 의 `"Owner 전용"`(Admin 역할 부여 행 설명)인데, 문자열 자체가
    다르고(`이상 권한 필요` vs `전용`) 같은 자리에서 경합하지 않는다. `owner` 가 역할 계층
    최상위(그 위에 역할 없음)라 "OO 이상" 표현이 사실상 "OO 전용" 과 동의어가 되는 점은
    스타일상 사소한 잉여이지 충돌은 아니다.
  - 제안: 조치 불필요. 확인 목적의 INFO.

- **[INFO]** swagger.md → 12-workspace.md 앵커, 한 줄로 편 뒤에도 유효
  - target 신규 식별자: 앵커 프래그먼트
    `#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` (`spec/conventions/swagger.md:350,398`).
  - 기존 사용처: 타깃 heading `spec/data-flow/12-workspace.md:313`
    `### 멤버십 검증은 가드 1곳에서 — \`@Roles()\` 와 무관 (2026-08-08)`.
  - 상세: `github-slugger`(가드가 실제 쓰는 라이브러리, `spec-links.ts` `slugify()`)로 위
    heading 을 직접 슬러그화해 `멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` 을 얻었고,
    swagger.md 두 앵커와 문자 그대로 일치함을 확인했다. `git diff origin/main` 상으로도 이번
    변경은 기존 링크(`(../data-flow/12-workspace.md)`, 앵커 없음)를 **한 줄로 펴면서 앵커를
    추가**한 것뿐이고 링크 텍스트·타깃 파일은 그대로다 — 새 식별자가 아니라 기존 링크의 앵커
    정밀화.
  - 제안: 조치 불필요.

- 새 요구사항 ID / 엔티티·DTO 명 / API endpoint / 이벤트명 / ENV·config key / spec 파일 경로 —
  target diff(`spec/conventions/node-cancellation.md`, `spec/conventions/swagger.md`, 둘 다
  `git diff origin/main` 확인) 는 신규 식별자를 **0개** 도입한다. node-cancellation.md 변경은
  기존 문구("Editor+ 전용", `@Roles('editor')`, `1-auth §3.2`, `에디터 실행 §4`)를 조합한 서술
  1문장 삽입뿐이고, swagger.md 변경은 위 앵커 프래그먼트 추가뿐이다. 새 파일 생성도 없다.

## 요약
target(`spec/conventions`) 의 실제 diff 는 서술 보강 1건 + 앵커 프래그먼트 정밀화 1건으로,
신규 식별자를 도입하지 않는다. 프롬프트가 지목한 세 설명 문자열 중 `'owner 이상 권한 필요'`
는 저장소 최초 등장이지만 `swagger.md §5-4` 가 정의한 기계적 명명 패턴(`'<role> 이상 권한 필요'`)
을 그대로 따른 것이라 다른 의미의 기존 사용과 충돌하지 않는다. 앵커는 `github-slugger` 로 직접
재계산해 대상 heading 과 문자 그대로 일치함을 확인했다.

## 위험도
NONE

BLOCK: NO
STATUS: OK
