# 테스트(Testing) 리뷰

## 스코프 확인

이 변경셋은 `git diff origin/main..HEAD` 기준 **순수 docstring/문서 변경**이다. 프로덕션 로직 변경은
0줄이다:

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — JSDoc 주석만 변경(라우트
  수 "73건" → "142건" 정정 + 상위집합/서브셋 구분 명시). `countWorkspaceIdConsumingRoutes`·
  `assertWorkspaceIdReflectionWorks` 본문은 무변경.
- `codebase/backend/src/common/utils/uuid.ts` — `isUuidShaped` docstring 만 변경(잘못된 e2e 캐너리
  인용을 두 단위 테스트 인용으로 교체). `UUID_SHAPE_PATTERN`·`isUuidShaped` 본문은 무변경.
- `plan/**` 2건 — 체크리스트 상태 갱신 + `git mv`(in-progress → complete).
- `review/consistency/2026/08/09/20_34_07/**` — 직전 consistency-check 세션의 산출물(로그성 아티팩트).

따라서 관점 1(테스트 존재)·2(커버리지 갭)·3(엣지 케이스)·4(Mock)·5(격리)·8(테스트 용이성)은
**해당 없음(N/A)** — 새 코드 경로도 새 분기도 없다. 실질 검토 대상은 관점 6(가독성/정확성)과
7(회귀 테스트 유효성)이다: docstring 이 "이 동작을 어떤 테스트가 고정하는가"를 구체적으로
인용하므로, 그 인용이 **사실과 일치하는지**를 직접 실측했다.

## 실측 검증

- `uuid.spec.ts:55` — `it('accepts UUID-shaped values that isValidUuid rejects (nil / v6+ /
  비-RFC variant)', ...)`. docstring 인용과 문자 그대로 일치.
- `workspace-context.util.spec.ts:134` — `it('Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID —
  403 이 400 으로 뒤바뀌지 않도록)', ...)`. docstring 인용과 문자 그대로 일치(단, 아래 INFO 참고).
- `roles.guard.spec.ts:337` — `it('형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다 — 단축이
  헤더 파싱보다 먼저다', ...)`. plan 문서(`spec-draft-auth-invariants-sync.md`)가 인용하는 "그쪽
  캐너리" 문구와 일치.
- `system-status.e2e-spec.ts:147` — `.set('X-Workspace-Id', '00000000-0000-0000-0000-000000000000')`.
  docstring 이 "그 e2e 는 nil UUID 를 보내는 게 사실이지만 이 술어에 닿지 않는다"고 한 전제(사실
  관계) 확인.
- `system-status.controller.ts` — `@Roles()`/`@WorkspaceId()` 미부착, `@Controller('system-status')`
  + `@Get('overview')` 뿐. docstring 주장과 일치.
- `roles.guard.ts` — `if (!needsRoleCheck && !handlerConsumesWorkspaceId(...)) return true;` 가
  `resolveRequestWorkspaceContext` 계열 호출보다 앞선다. docstring 주장과 일치.
- "142건" 수치 — `grep -ro "@WorkspaceId()" **/*.controller.ts` 원시 결과는 145건이나, 그중 3건은
  실제 파라미터 데코레이터가 아니라 **주석 안에서 `@WorkspaceId()` 를 언급**하는 줄
  (`executions.controller.ts:83`, `agent-memory.controller.ts:46`,
  `background-runs.controller.ts:53`)이다. 이를 제외하면 정확히 142건 — docstring 수치가 실측과
  일치한다.
- 인용된 3개 spec 파일(`uuid.spec.ts`, `workspace-context.util.spec.ts`,
  `roles.guard.spec.ts`) + `workspace-reflection-canary.spec.ts` 를 직접 실행해 전부 GREEN 확인
  (`npx jest` 4개 스위트, 61 테스트 전체 통과 — 회귀 없음).

즉 이번 변경은 "테스트가 실제로 무엇을 고정하는지"를 정확하게, 검증 가능하게 문서화했다. 이전
버전(`e2e 하나가 nil UUID 를 프로브로 쓴다`는 부정확한 인용)보다 신뢰도가 높아졌다 — 이 저장소가
반복적으로 겪은 "유예/캐너리 근거는 실측해야 한다" 결함 클래스를 스스로 교정한 사례다.

## 발견사항

- **[INFO]** 플랜 문서의 테스트 위치 인용이 실제 줄과 1줄 어긋남
  - 위치: `plan/complete/spec-draft-auth-invariants-sync.md` (§⚠️ 착수 중 발견 절, "진짜 캐너리는 두
    단위 테스트다" 목록) — 게이트 57행: `` `workspace-context.util.spec.ts:135` ``
  - 상세: 실제 테스트는 `codebase/backend/src/common/utils/workspace-context.util.spec.ts` **134번째
    줄**의 `it('Postgres 가 파싱할 수 있는 값은 통과시킨다 …')`이다. 인용된 `:135` 는 그 `it(` 블록의
    둘째 줄(설명 문자열 이어지는 줄)을 가리켜 오프바이원이다. 코드 쪽 docstring(`uuid.ts`)은 정확한
    줄 번호를 인용하지 않으므로 영향 없고, 이 문서 자체도 향후 소스가 한 줄만 옮겨도 stale 해질 수
    있는 취약한 앵커(정확한 줄 번호 고정)라는 점도 함께 지적한다.
  - 제안: 줄 번호 대신 `it(...)` 설명 문자열만으로 인용하거나(이미 그렇게 하고 있으므로 줄 번호는
    부가 정보), 다음에 이 문서를 편집할 기회에 `:134` 로 정정. 급하지 않음(plan 문서이지 코드
    docstring 이 아님 — CI 가드 대상 아님).

## 요약

이번 변경은 프로덕션 코드 로직을 건드리지 않는 순수 docstring 정정 PR이라 신규 테스트가
필요하지 않다. 다만 그 docstring 자체가 "이 불변식을 어떤 테스트가 지키는가"라는, 사실상 테스트
문서화(test provenance) 역할을 하므로 인용의 정확성이 핵심 리스크였다 — 인용된 테스트 제목 3건,
컨트롤러/가드 소스의 분기 순서, 그리고 정정된 라우트 수치("142건")까지 전부 직접 실측/실행으로
대조한 결과 모두 사실과 일치했고, 관련 spec 4개 스위트(61 테스트)도 전부 GREEN이다. plan 문서의
테스트 줄번호 인용 1건이 실제와 1줄 어긋나지만 코드 docstring 이 아니고 CI 가드 대상도 아니라
영향은 미미하다.

## 위험도
NONE
