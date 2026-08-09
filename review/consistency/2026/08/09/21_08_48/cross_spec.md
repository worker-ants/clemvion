# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상 요약

diff 범위(`origin/main...HEAD`)는 코드 주석(docstring) 2건 뿐이다 — 신규 spec 변경 없음:

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
- `codebase/backend/src/common/utils/uuid.ts`

두 docstring 모두 이전에 잘못 지목했던 "캐너리"(2026-08-08 실측 **73건** = `@Roles()` 없는
서브셋, `system-status.e2e-spec.ts`)를 정정해 진짜 캐너리(`uuid.spec.ts` ·
`workspace-context.util.spec.ts` 단위 테스트, `@WorkspaceId()` 소비 라우트 전체 **142건**)를
가리키도록 고쳤다. 두 docstring 은 각각 `spec/data-flow/12-workspace.md §Rationale "UUID 검증
강도 비대칭"`(uuid.ts) · 같은 문서의 "멤버십 검증은 가드 1곳에서"(canary.ts) 를 SoT 로 명시
인용한다.

## 교차검증 절차

1. `spec/data-flow/12-workspace.md` 의 두 Rationale 절 원문을 직접 읽어 docstring 인용 문구·
   테스트 이름·숫자(73/142/222)가 spec 서술과 정확히 일치하는지 대조 — **일치**.
2. `spec/5-system/1-auth.md §"부트 캐너리 — @WorkspaceId() reflection 자가검증"` 을 대조 —
   구체 숫자를 적지 않고 "다수 있으므로" 로만 서술해 73/142 정정과 **무충돌**(애초에 stale 해질
   수치를 본문에 박아두지 않은 설계).
3. `spec/5-system/3-error-handling.md §1.3` 의 `WORKSPACE_ID_REQUIRED`/`VALIDATION_ERROR` 3분기
   서술 및 `data-flow/12-workspace.md` 앵커 링크 대조 — **일치**, 별도 정정 불요.
4. `codebase/backend/src/common/guards/roles.guard.spec.ts` · `uuid.spec.ts` ·
   `workspace-context.util.spec.ts` 에서 docstring 이 인용한 테스트 제목이 실제로 존재하는지
   확인 — 3건 모두 **글자 그대로 일치**.
5. `spec/**` 전수에서 `73건`/`142건`/`system-status.e2e-spec`/`reflection` 재검색 — 다른 영역
   문서(`spec/2-navigation/*`, `spec/7-channel-web-chat/*` 등)의 "워크스페이스 무관" 언급은
   본 변경과 무관한 별개 문맥(FE 라우팅/webchat origin)이라 충돌 없음. `plan/complete/
   auth-workspace-membership-guard.md` 의 73건 표기도 "no-`@Roles()` 서브셋" 문맥으로 일관되게
   쓰여 docstring 정정과 모순 없음.
6. `spec/conventions/error-codes.md` 의 `WORKSPACE_ID_REQUIRED` 항목 — 별개 이력(#566, chat-channel
   HTTP status 통일)이라 본 변경과 무관.

### 발견사항

없음. (Critical/Warning/Info 후보 모두 미발견)

## 요약

이번 변경은 `spec/**` 를 전혀 건드리지 않고 두 코드 파일의 docstring 만 정정한다. 정정 내용은
기존 `spec/data-flow/12-workspace.md` 의 "캐너리 지목 정정 (2026-08-09)" 절이 이미 서술한
사실(잘못 지목된 e2e 캐너리 → 진짜 단위 테스트 캐너리, 73건 서브셋 vs 142건 전체 라우트 수)을
코드 쪽에 뒤늦게 반영한 것이며, 인용한 테스트 이름·앵커 링크·숫자가 spec 원문·실제 테스트 코드와
정확히 일치한다. `spec/5-system/1-auth.md`(부트 캐너리)·`spec/5-system/3-error-handling.md`
(에러 코드 카탈로그)등 인접 영역과도 대조했으나 모순·중복·오래된 수치 잔존이 없다. 데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 충돌 후보가 발견되지 않았다.

## 위험도

NONE
