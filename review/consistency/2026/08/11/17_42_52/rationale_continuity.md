# Rationale 연속성 검토 — llm-model-config.controller.ts:118 주석 반전 + 잔여 13건 부착

## 조사 방법

`prompt_file` 의 spec/conventions 번들에는 코드 diff 섹션이 포함되어 있지 않아(스캔 결과
`llm-model-config`, `controller.ts` diff, `@@` hunk 마커 전무), 오케스트레이터 지시에 따라
**작업 워킹트리(HEAD)** 를 직접 열고 `git log -S` / `git merge-base --is-ancestor` 로 실제
커밋 이력을 재구성했다. HEAD 는 `165960a92`("fix: 술어가 규약보다 좁았다 — 잔여 13건 +
codemod 파서 버그 + 내 뮤테이션 주장 정정") — 대상 변경은 이미 커밋된 상태(작업트리 diff 없음).

## 발견사항

없음 — 아래는 조사 결과 기각된 두 가설과 확인된 사실이다.

- **[INFO] §5-4 절이 두 hop 짜리 근거를 갖는데 comment 는 그중 하나만 인용**
  - target 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts:118-122`
  - 과거 결정 출처: `spec/conventions/swagger.md` `### §5-4 확장 배경` (2026-08-08) +
    `spec/data-flow/12-workspace.md` `### 멤버십 검증은 가드 1곳에서 — @Roles() 와 무관 (2026-08-08)`
  - 상세: 주석은 "`swagger.md §5-4`, 2026-08-08 확장"만 지목한다. 그 §5-4 자체가 인용하는
    1차 근거(`RolesGuard` 를 opt-in→무조건 검증으로 바꾼 실제 보안 fix)는 `data-flow/12-workspace.md`
    에 있다. 두 문서 모두 실재하고 서로 정합하므로 결함은 아니나, 코드 주석만 보는 독자는
    "왜 RolesGuard 가 항상 검증하는가"의 근본 근거(P0 cross-tenant 갭)까지는 한 hop 더 타야
    한다.
  - 제안: 조치 불요(정보성). 필요하면 주석에 `data-flow/12-workspace.md` 앵커까지 체인할 수
    있으나 `swagger.md §5-4` 가 이미 그 링크를 대신 지고 있어 중복이다.

## 검증 상세 — 오케스트레이터가 지목한 3개 관점

### 1. 주석 반전이 근거 없는 번복인가 (핵심 질문)

**결론: 아니다. 실제 보안 fix 로 뒷받침된 정당한 정정이다.** `git log -S`/`merge-base` 로
시간순을 재구성하면 다음과 같다:

| 날짜 | 커밋 | 사실 |
|---|---|---|
| 2026-06-27 | `3e102ed3d` | `:id/models` 에 원래 주석 도입: "역할 제한이 없어 `@ApiForbiddenResponse` 도 두지 않는다 — 워크스페이스 멤버십 미충족 403 은 컨트롤러 공통 인증 계층 책임". **이 시점 실제로 맞는 서술이었다** — 당시 `RolesGuard.canActivate` 는 `requiredRoles` 가 비면(= `@Roles()` 없으면) 멤버십 조회 **이전에** 통과시켰다(opt-in 모델). |
| 2026-08-08 | `8d84f6e9f` (`fix(auth): @Roles() 없는 라우트의 워크스페이스 멤버십 검증 누락 — cross-tenant 차단 (P0) #1103`) | 바로 그 구멍을 P0 보안 fix 로 닫는다 — `@Roles()` 유무와 무관하게 `RolesGuard` 가 멤버십을 **무조건** 검증하도록 재구성. |
| 2026-08-08 | `spec/data-flow/12-workspace.md` Rationale 신설 | "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" — 전수 실측 "222건 중 73건이 `@WorkspaceId()` 소비 + `@Roles()` 부재"로 노출됐던 cross-tenant 갭과 정정을 명문화. |
| 2026-08-08 | `spec/conventions/swagger.md §5-4 확장 배경` | 동일 사실을 규약 체크리스트 레벨로 승격: "`@Roles()` 가 있어야 403 이 가능하다"는 opt-in 전제가 위 fix 로 깨졌다고 명시. |
| 2026-08-11 | `165960a92` | 컨트롤러 주석을 새 사실에 맞춰 정정. 옛 주석의 전제("역할 제한 없음 = 403 불가")를 명시적으로 지목하고 왜 깨졌는지(`swagger.md §5-4`, 2026-08-08) 를 인라인으로 남김. |

**`git merge-base --is-ancestor` 로 위상학적 순서도 확인**: `8d84f6e9f`(P0 fix) 는
`3e102ed3d`(구 주석 커밋)의 조상이 **아니다** — 즉 구 주석이 쓰였을 때 그 fix 는 아직
존재하지 않았다. 옛 주석은 "폐기된 규칙을 되살린" 사례가 아니라, **그 시점엔 참이었던
서술이 이후 실제 런타임 동작 변경으로 거짓이 된** 정상적인 spec-drift 케이스다. 정정은
(a) 코드 주석에 옛 전제·정정 사유를 명시했고, (b) 그 사유가 가리키는 `swagger.md §5-4`
Rationale 과 `data-flow/12-workspace.md` Rationale 이 **모두 실재**하며 날짜(2026-08-08)까지
일치한다. "결정의 무근거 번복"(관점 3) 에 해당하지 않는다 — 오히려 새 Rationale 을 이미
갖춘 상태에서의 문서-구현 동기화다.

참고로 오해하기 쉬운 함정: `RolesGuard` 를 `APP_GUARD` 전역 등록으로 바꾼 "opt-in → opt-out"
리팩터(`c0ae17280`, author-date 2026-05-04)는 **가드 프로바이더 등록 방식**(컨트롤러마다
`@UseGuards` 없이도 전역 적용)에 대한 변경이지, "`@Roles()` 없으면 멤버십 검사를 생략한다"는
**가드 내부 로직**과는 별개다. 후자를 고친 것이 2026-08-08 의 `8d84f6e9f` 다. 이름이 비슷해
혼동할 뻔했으나 실제 코드(`roles.guard.ts` 커밋 이력에 `8d84f6e9f` 단독 등재)와 spec Rationale
서술("`requiredRoles` 가 비면 멤버십 조회 이전에 통과") 이 이 구분을 명확히 뒷받침한다.

### 2. 주석이 인용한 `spec §3·R-7` 이 실재하고 정정과 모순되지 않는가

**실재 확인**: `spec/2-navigation/6-config.md` §3 "Model Config API" + `### R-7. action-POST
인 test 와 preview-models 를 Editor 로 게이트`. R-7 은 `:id/test`·`preview-models` 를
Editor+ 로 게이트하는 근거와 "`:id/models` 는 Viewer+ 유지"(§3.2 의 `R`(읽기)에 해당하므로
인가 매트릭스를 좁히지 않는다) 를 명시한다.

**모순 없음**: 이번 주석 수정은 `@Roles()` 미부착(Viewer+ 유지) 결정 자체를 전혀 건드리지
않는다 — `:id/models` 핸들러에는 여전히 `@Roles()` 가 없다(코드 확인: line 123
`@Get(':id/models')` 아래 `@Roles(...)` 부재, `listModels` 시그니처 그대로). 바뀐 것은
**Swagger 문서화 데코레이터**(`@ApiForbiddenResponse`) 부착 여부뿐이다. R-7 은 이 데코레이터
에 대해 아무것도 말하지 않으므로 인용 범위가 정확히 스코프됐다 — 정정이 R-7 을 무효화하거나
재해석하지 않는다.

### 3. 새 13건 부착이 다른 기각된 결정을 되살리는가

**되살리지 않는다.** 13건 전부 diff 확인 결과 순수 추가형 `@ApiForbiddenResponse` Swagger
데코레이터이며(`agent-memory.controller.ts` 2 · `executions.controller.ts` 2 ·
`knowledge-base.controller.ts` 1 · `workflow-assistant.controller.ts` 4 ·
`workflow-test-datasets.controller.ts` 3 · `workflows.controller.ts` 1), 전부 이미 `@Roles()`
가 붙어 있던 라우트에 **문서만** 추가한 것이다 — `@Roles()` 자체를 신규 부착하지 않았다.

`data-flow/12-workspace.md` Rationale 은 명시적으로 별개의 **기각된 대안**을 등재한다:
"73개 라우트에 `@Roles('viewer')` 부착 — opt-in 모델의 연장이라 74번째 라우트에서 같은
누락이 재발한다". 이번 13건 부착은 `@Roles()` 부착이 아니라 `@ApiForbiddenResponse` Swagger
문서 데코레이터 부착이므로 이 기각된 대안과 범주가 다르고, 되살리지 않는다.
`git log -S "ApiForbiddenResponse"` 로 6개 대상 컨트롤러 이력을 훑어도 "한 번 넣었다가 특정
근거로 뺀" 패턴은 없다 — 전부 순증가 이력이다.

## 요약

오케스트레이터가 지목한 핵심 우려(§118 주석 반전이 근거 없는 번복인지)는 `git log -S` +
`merge-base --is-ancestor` 로 위상학적 시간순을 재구성한 결과 **기각됐다** — 옛 주석은 작성
시점(2026-06-27)엔 실제로 참이었고, 2026-08-08 의 P0 cross-tenant 보안 fix(`8d84f6e9f`)가
`RolesGuard` 의 실제 런타임 동작을 opt-in에서 무조건 검증으로 바꾸며 그 전제를 깼다. 이
사실은 `spec/data-flow/12-workspace.md` 와 `spec/conventions/swagger.md §5-4` 두 Rationale
에 날짜까지 일치해 기록돼 있고, 컨트롤러 주석 자체도 옛 전제·정정 사유를 인라인으로 남겨
"새 Rationale 없는 번복"에 해당하지 않는다. 인용된 `spec §3·R-7` 은 실재하며 이번 정정이
건드리지 않는 별개 결정(Viewer+ 유지)을 정확한 범위로 지목한다. 신규 부착된 13건의
`@ApiForbiddenResponse` 는 이미 문서화된 규약(§5-4 predicate)의 기계적 적용이며 `data-flow/
12-workspace.md` 가 명시적으로 기각한 "73건에 `@Roles('viewer')` 부착" 대안과는 범주가 달라
되살리지 않는다.

## 위험도
NONE

---

BLOCK: NO
STATUS: OK
