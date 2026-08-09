# Rationale 연속성 검토 — spec/5-system/ (--impl-done, auth-guard-reflection-hardening)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- target spec 번들(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 등) 자체는 이번 diff 에서 변경되지 않았다(`diff --git` 대상은 전부 `codebase/backend/src/**`, 순수 코드 PR·`spec_impact: none`).
- 실제 diff: `app.module.ts`(DiscoveryModule 등록)·신규 `workspace-reflection-canary.ts`(+spec)·`workspace.decorator.spec.ts`·`roles.guard.spec.ts`·`uuid.ts`(+spec, `isUuidShaped` 신설)·`workspace-context.util.ts`(+spec, 비-UUID 헤더 400화)·`main.ts`(캐너리 부트 호출).
- 대응 plan: [`plan/in-progress/auth-guard-reflection-hardening.md`](../../../../plan/in-progress/auth-guard-reflection-hardening.md). 이 plan 은 동일 worktree 의 **직전 세션**(`--impl-prep`, `review/consistency/2026/08/09/14_01_15`)이 낸 WARNING #1·#2·INFO #2 를 명시적으로 반영해 착수했다고 기록하고 있어, 이번 검토는 (a) 그 인용이 실제 이력과 부합하는지, (b) 구현이 그 결정대로 됐는지, (c) 새로 도입된 fail-closed 부트 동작이 기존 Rationale(특히 `spec/data-flow/12-workspace.md ## Rationale`, `1-auth.md`의 "Production fail-closed 가드")과 충돌하지 않는지를 중심으로 확인했다.

## 관점별 확인

1. **기각된 대안의 재도입** — 해당 없음, 오히려 회피 성공 사례. `workspace-reflection-canary.ts` 는 `SetMetadata`+`Reflector` 공식 확장점 대신 `DiscoveryService` 로 등록된 전 컨트롤러를 훑어 기존 `@WorkspaceId()` reflection 이 살아있는지만 검증한다 — 라우트별 추가 마커를 요구하지 않는다. 이는 `spec/data-flow/12-workspace.md ## Rationale` → "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관"의 "**기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착**: opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다(이미 최소 2회 발생)" 항목과 동일 구조의 "라우트별 opt-in 마커" 패턴을 **재도입하지 않기 위해 의도적으로 회피**한 결과다. `plan/in-progress/auth-guard-reflection-hardening.md` §1 은 이 대안을 "채택 안 함(근거 확보)"로 명시 기록했다.
2. **합의된 원칙 위반** — 해당 없음. (a) `spec/data-flow/12-workspace.md`의 "적용 범위: 워크스페이스 컨텍스트를 소비하는 인증된 라우트 / 워크스페이스 컨텍스트를 쓰지 않는 라우트는 검증 대상 없음" 원칙이 신규 400 화 로직에도 유지된다 — `roles.guard.spec.ts` 신규 테스트("형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다")가 `@WorkspaceId()` 를 쓰지 않는 라우트는 헤더 형식 검증을 아예 타지 않음을 고정했다. (b) `1-auth.md ## Rationale`의 "Production fail-closed 가드" 절이 스스로 밝힌 분리 원칙 — "DI·요청 컨텍스트가 필요하거나 … 정당 용도가 있는 항목은 의도적으로 분리한다" — 를 새 캐너리가 그대로 따른다: `assertWorkspaceIdReflectionWorks(app)` 은 `INestApplication`(DI 컨테이너) 이 필요해 `assertProductionConfig`(env-only 블록)에 합치지 않고 별도 부트 단계로 뒀다(`main.ts` diff, 코드 주석에도 명시).
3. **결정의 무근거 번복** — 해당 없음. 에러 코드 선택(`VALIDATION_ERROR` vs `WORKSPACE_ID_REQUIRED`)은 직전 `--impl-prep` WARNING 이 지적한 정의 불일치("헤더·클레임 둘 다 없음" vs "present-but-malformed")를 그대로 반영해 **제네릭 `VALIDATION_ERROR`**(`2-api-convention.md §5.3` 400 기본값)를 채택했고, 그 근거를 plan §3 과 `workspace-context.util.ts` 코드 docstring 양쪽에 새로 남겼다 — "새 Rationale 없이 번복"이 아니라 정확히 요구되던 형태(코드 주석 + plan Rationale)로 근거를 기록한 사례다. `WORKSPACE_ID_REQUIRED`(§1.3, "헤더·클레임 둘 다 없음")의 기존 정의는 변경되지 않았고 spec 문서도 그대로다 — spec 변경이 필요 없는 선택지를 택했으므로 `spec_impact: none` 과도 정합한다.
4. **암묵적 가정 충돌** — 해당 없음. `roles.guard.spec.ts` 신규 스위트("형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다")가 403(비멤버)과 400(형식 오류)을 구분해 고정했고, `getMemberRole` 이 형식 오류 시 호출되지 않음을 단언해 "멤버십 검증은 가드 1곳에서 무조건 수행" invariant 의 **집행 순서**(헤더 형식 검증 → 멤버십 조회)가 명시적으로 테스트로 봉인됐다. `isUuidShaped`(Postgres 파싱 가능 여부 기준, nil UUID 포함) vs 기존 `isValidUuid`(RFC variant 엄격) 의 경계도 "403 이 400 으로 뒤바뀌면 안 된다"는 동일 축(§"멤버십 검증은 가드 1곳" 절의 취지)을 지키기 위해 신중히 분리됐다.

## 인용 정확성 별도 검증 (fabrication 여부)

코드·plan 이 인용하는 "`--impl-prep` rationale_continuity WARNING #2"·"동 세션 INFO #2"는 **개별 `rationale_continuity.md`(14_01_15) 파일 내부 순번으로는 각각 WARNING #1·INFO #1**이지만, 같은 세션의 `SUMMARY.md`(체커 간 통합 표)에서는 정확히 **WARNING #2**("공식 확장점 전환 옵션 … opt-in 마커 재도입 위험")·**INFO #2**("부트타임 캐너리가 boot-fail-closed 라면 … Production fail-closed 가드 정합 여부")로 번호가 매겨져 있다. plan·코드 주석은 SUMMARY.md 의 통합 번호를 인용한 것으로, **내용은 실제 이력과 정확히 일치**하며 지어낸 인용이 아니다(과거 세션 교훈 — "Rationale '기각된 대안' 은 실제 이력 필수, 지어내면 checker 가 잡는다" — 를 통과함).

## 발견사항

- **[INFO]** WARNING/INFO 번호 인용이 통합 SUMMARY 기준이라 단독 파일 열람 시 혼동 가능
  - target 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` JSDoc("2026-08-09 --impl-prep rationale_continuity WARNING #2", "동 세션 INFO #2") / `plan/in-progress/auth-guard-reflection-hardening.md` §1 체크박스 2·3
  - 과거 결정 출처: `review/consistency/2026/08/09/14_01_15/rationale_continuity.md`(개별 파일 순번 WARNING #1·INFO #1) vs 같은 세션 `SUMMARY.md`(통합 순번 WARNING #2·INFO #2)
  - 상세: 인용된 내용 자체는 정확하지만, 번호만 보고 `14_01_15/rationale_continuity.md` 를 단독으로 열람하는 미래 독자는 "WARNING #2"를 그 파일의 두 번째 항목("`WORKSPACE_ID_REQUIRED` 재사용 위험")으로 오독할 수 있다 — 실제로는 opt-in 마커 항목(그 파일의 WARNING #1)이다. 두 항목 모두 같은 파일에 있어 실질 혼선 위험은 낮다.
  - 제안: 후속 정리 시 "SUMMARY.md WARNING #2" 처럼 출처 파일을 명시하거나, 인용 시 번호 대신 항목 제목 일부를 병기하면 재추적이 쉬워진다. 차단 사유 아님.

## 요약

이번 diff(spec 변경 없는 순수 코드 PR)는 spec/5-system/ 번들 및 교차 인용된 `spec/data-flow/12-workspace.md ## Rationale` 의 기존 결정을 위반하거나 기각된 대안(라우트별 opt-in 마커)을 재도입하지 않는다. 오히려 그 기각 이유를 정확히 파악해 캐너리 방식으로 우회했고, 에러 코드 선택은 직전 `--impl-prep` 리뷰의 권고(제네릭 `VALIDATION_ERROR`)를 그대로 따르며 근거를 코드·plan 양쪽에 남겼다. `1-auth.md`의 "Production fail-closed 가드" 분리 원칙, "멤버십 검증은 가드 1곳에서 무조건" invariant, "@WorkspaceId() 미소비 라우트는 검증 대상 아님" 범위 제한 모두 신규 테스트로 명시적으로 지켜졌다. 코드가 인용하는 과거 리뷰 근거("WARNING #2"/"INFO #2")는 실제 이력(SUMMARY.md 통합 번호)과 정확히 일치해 지어낸 인용이 아니다. 유일한 흠은 그 번호가 개별 checker 파일 순번이 아니라 통합 SUMMARY 순번이라는 사소한 참조 방식 차이(INFO)뿐이다.

## 위험도

NONE
