# 요구사항(Requirement) 리뷰 — forbidden-desc-codes

## 범위

`lowestRequiredRole` 추출(순수 리팩터, `RolesGuard.assertMember` 인라인 reduce 를
`common/constants/workspace-roles.ts` 로 이동) + `common/swagger/forbidden-descriptions.ts`
신설(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`) + 24개 컨트롤러의 `@ApiForbiddenResponse`
설명을 헬퍼로 치환 + 신규 저장소 가드 `forbidden-response-codes`(reflection 기반, 실제 `RolesGuard`
를 대조군에 돌리는 모델 캐너리 포함).

## 검증 방법

- `codebase/backend/src/common/constants/workspace-roles.ts` · `codebase/backend/src/common/guards/roles.guard.ts`
  전체 파일을 직접 `Read`.
- `spec/conventions/swagger.md` §5-4 · §Rationale "§5-4 403 설명의 거부 코드"와
  `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"를 대조.
- 30개 컨트롤러 diff 전수를 `@Roles(...)` 실제 인자와 `forbiddenForRole(...)` 인자로 교차 대조
  (`grep`), 특히 복합 문장 상수(`FORBIDDEN_EDITOR_OR_ORG_ADMIN` · `FORBIDDEN_OWNER_OR_PERSONAL` ·
  `FORBIDDEN_EDITOR_OR_NOT_OWNER`)가 실제 가드 요구 역할과 일치하는지 `integrations.controller.ts` ·
  `workspaces.controller.ts` · `workflow-test-datasets.controller.ts` 전체 파일을 열어 확인.
- `grep -rl "@Roles(\|@WorkspaceId(\|@WorkspaceParam(" --include="*.controller.ts"` 로 전 컨트롤러를
  나열해 헬퍼를 쓰지 않는 잔여 파일이 있는지 확인 — `auth/auth.controller.ts` 한 곳만 나왔고, 그 안의
  유일한 대상 라우트(`switchWorkspace`)는 이미 `${NOT_A_MEMBER.code}` 를 손으로 보간해 코드를 싣고
  있어(이 PR 이전 별도 PR 에서 처리) 저장소 가드의 요구를 충족한다 — 누락 아님.
- `grep`으로 role 문구가 남아 있는데 `FORBIDDEN`/`forbiddenForRole` 를 안 쓰는 나머지 두 지점
  (`auth/sessions.controller.ts` `재인증 수단 부재`, `executions.controller.ts` 의 e2e 전용
  `_test/*` 라우트 2곳)을 열어 확인 — 전자는 `@Roles()`/`@WorkspaceId()`/`@WorkspaceParam()` 어느
  것도 쓰지 않는 인증-세션 라우트(가드 대상 밖), 후자는 `@ApiExcludeEndpoint()` 가 붙어 OpenAPI 밖(가드
  자신의 `isExcluded()` 가 스킵하는 자리, spec 도 "OpenAPI 밖 — 광고가 없으니 묻지 않는다" 로 명시) —
  둘 다 결함 아님.
- 신규/관련 테스트를 실제로 실행: `forbidden-response-codes.spec.ts` · `workspace-roles.spec.ts` ·
  `forbidden-descriptions.spec.ts` · 기존 `roles.guard.spec.ts` — 전부 GREEN(15+64 테스트,
  실측 스캔 `checked` 157 라인 그대로 위반 0). 저장소 파일은 어떤 것도 수정하지 않았다
  (`git status --short` 로 확인 — 리뷰 세션이 만든 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `auth.controller.ts:448`(`switchWorkspace`) 은 신설 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER`
  대신 `${NOT_A_MEMBER.code}` 를 직접 보간한 기존 문장을 그대로 쓴다.
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` — `switchWorkspace` 핸들러의
    `@ApiForbiddenResponse({ description: 대상 워크스페이스의 멤버가 아님(${NOT_A_MEMBER.code}) })`
    (이 PR 의 diff 에는 포함되지 않은 파일이라 프롬프트 게이트 번호 없음 — 함수명으로 기재).
  - 상세: 저장소 가드는 설명 문자열에 코드(`NOT_A_MEMBER`)가 부분 문자열로 있는지만 보므로 위반은
    아니다. 다만 이 PR 의 취지(§5-4 Rationale: "문장 형식이 컨트롤러마다 갈렸다... 헬퍼로 흡수한다")를
    엄밀히 적용하면 이 자리도 헬퍼로 통일하는 것이 일관적이다. 이 PR 의 diff 범위 밖(스캔이 이미
    통과하는 기존 코드)이라 이번 변경이 만든 결함은 아니다.
  - 제안: 필수 조치 아님. 후속 정리 PR 에서 `FORBIDDEN_NOT_A_MEMBER` 로 교체해도 좋다.

## 항목별 점검 결과 (요약)

1. **기능 완전성** — `lowestRequiredRole` 추출은 `RolesGuard.assertMember` 의 인라인 reduce 와
   바이트 단위로 동일한 식이며, 실제 사용처(`roles.guard.ts:222`)도 새 함수를 호출하도록 정확히
   치환됨. 신규 저장소 가드는 실측 157개 대조 라우트에서 위반 0으로 수렴(베이스라인 129→0).
2. **엣지 케이스** — 빈 요구(`lowestRequiredRole([])` → `TypeError`), 서열 밖 문자열이 문턱이 되는
   경우(`superadmin`/`constructor` — `Object.hasOwn` 으로 프로토타입 키 배제), `viewer`(멤버십과
   동일 코드), 클래스 레벨 `@Roles` 상속·핸들러 오버라이드, `@Public()`, `@ApiExcludeEndpoint()` 모두
   대조군 fixture 로 커버되고 모델 캐너리가 **실제 `RolesGuard` 를 인스턴스화해** 대조.
3. **TODO/FIXME** — 없음.
4. **의도-구현 괴리** — 함수명·주석(`lowestRequiredRole` 의 JSDoc)이 실제 구현·호출자 계약(빈 배열
   금지, `string[]` 시그니처 이유)과 정확히 일치.
5. **에러 시나리오** — `lowestRequiredRole([])` 의 `TypeError` 전파가 호출자 계약 위반으로 명시적으로
   테스트됨. 가드 자체의 거부 코드 매핑(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/
   `OWNER_REQUIRED`)은 실가드 캐너리로 검증.
6. **데이터 유효성** — 해당 없음(순수 문자열/역할 서열 로직, 외부 입력 없음).
7. **비즈니스 로직** — "여럿 중 하나라도 충족하면 통과 → 가장 낮은 역할이 실제 문턱" 규칙이 가드·
   저장소 가드 양쪽에서 **같은 함수**로 계산되어 괴리 가능성이 구조적으로 닫힘(spec Rationale
   "따로 옮겨 적으면 둘이 갈리는 날..." 과 일치).
8. **반환값** — `lowestRequiredRole` 은 모든 비어있지 않은 입력에서 `string` 반환, 빈 입력에서만
   예외(계약대로). `forbiddenForRole` 은 `viewer`/그 외 두 분기 모두 문자열 반환.
9. **spec fidelity** — `spec/conventions/swagger.md` §5-4 및 §Rationale "§5-4 403 설명의 거부 코드"
   (실측 157/129 수치, `NOT_A_MEMBER` 항상 포함, `viewer` 단일 코드, 헬퍼 명칭 `FORBIDDEN_NOT_A_MEMBER`·
   `forbiddenForRole`, 서비스 거부 비대상, reflection 근거)와 `spec/data-flow/12-workspace.md`
   §Rationale "가드 거부의 오류 코드"(코드 표, "가장 낮은 역할이 요구") 본문이 코드와 line-level 로
   일치한다. spec 자체의 결함은 발견되지 않았고, SPEC-DRIFT 도 없음(spec 이 이 PR 이 구현한 정확한
   설계를 이미 선반영해 기술하고 있다 — 즉 이 PR 자체가 그 spec 결정의 구현).

## 요약

`lowestRequiredRole` 단일 함수 공유(가드 ↔ 저장소 가드)로 문턱 계산 로직의 이원화 위험을 구조적으로
제거했고, 24개 컨트롤러의 하드코딩된 403 설명을 공용 헬퍼로 전환해 `@Roles(...)` 실제 요구 역할과
설명 문구 간 괴리를 신규 저장소 가드(실 스캔 157개 라우트, 위반 0)가 상시 방지한다. 복합 문장 상수
(Organization admin·개인 워크스페이스·소유자 판정 등 서비스 거부 부가)도 실제 `@Roles` 데코레이터와
정확히 대응한다. spec(`swagger.md` §5-4, `12-workspace.md` §Rationale)과 구현이 수치·규칙·명칭
수준에서 일치하며, 관련 테스트(신규 3개 스위트 + 기존 `roles.guard.spec.ts`)를 직접 실행해 전부
GREEN 을 확인했다. 발견된 유일한 항목은 이 PR 범위 밖의 기존 파일(`auth.controller.ts`)에 남은 손으로
쓴 동등 문장 하나이며 결함이 아닌 일관성 참고사항(INFO)이다.

## 위험도

LOW
