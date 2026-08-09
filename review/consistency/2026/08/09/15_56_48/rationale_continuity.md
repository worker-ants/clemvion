# Rationale 연속성 검토 결과

## 검토 대상
- 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
- diff: `codebase/backend/src/app.module.ts`, `common/decorators/workspace-reflection-canary.{ts,spec.ts}`(신규), `common/decorators/workspace.decorator.spec.ts`, `common/guards/roles.guard.spec.ts`, `common/utils/uuid.{ts,spec.ts}`, `common/utils/workspace-context.util.{ts,spec.ts}`, `main.ts`
- 요지: (1) 부팅 시 `@WorkspaceId()` reflection(`handlerConsumesWorkspaceId`)이 여전히 동작하는지 확인하는 fail-closed 캐너리 신설, (2) `X-Workspace-Id` 헤더 형식 검증(`isUuidShaped`) 추가로 형식 오류 시 400 `VALIDATION_ERROR` 조기 반환. 이번 diff 에는 `spec/` 변경이 없다(코드 전용 hardening).

## 발견사항

- **[WARNING]** 신규 부트 가드(`assertWorkspaceIdReflectionWorks`)의 설계 근거가 spec `## Rationale` 에 미반영 — 같은 문서가 확립한 "부트 가드 결정은 spec Rationale 에 남긴다" 관행과 어긋남
  - target 위치: (diff) `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(신규, 상단 JSDoc 전체가 사실상의 rationale) · `main.ts` 의 `assertWorkspaceIdReflectionWorks(app)` 호출부. 대응해야 할 spec 위치는 `spec/5-system/1-auth.md` `## Rationale`(§"Production fail-closed 가드" 인접) 또는 `spec/data-flow/12-workspace.md` `## Rationale` §"멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" 절 바로 아래.
  - 과거 결정 출처:
    1. `spec/5-system/1-auth.md` `## Rationale` § "Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)" — 이 프로젝트는 부팅 시 fail-closed throw 가드를 도입할 때마다 "단일 블록 응집 이유"·"의도적으로 분리한 항목과 그 이유"를 spec Rationale 에 명시하는 관행을 이미 확립했다("DI·요청 컨텍스트가 필요하거나… 정당 용도가 있는 항목은 의도적으로 분리한다" 같은 문장이 그 예).
    2. `spec/data-flow/12-workspace.md` `## Rationale` § "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" — 바로 이 절이 `RolesGuard`/`handlerConsumesWorkspaceId` 판별 로직을 구조적으로 정정한 최신 Rationale이며, "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착"을 명시적으로 남겼다.
  - 상세: 이번 diff 는 (2)의 Rationale 이 정정한 바로 그 판별 로직이 향후 조용히 깨질 경우(Nest 내부 메타데이터 포맷 변경 등) cross-tenant 결함이 되살아난다는 점을 근거로 부팅 시 fail-closed 캐너리를 신설한다. 코드 주석(`workspace-reflection-canary.ts`)은 "왜 필요한가", "무엇을 단언하나", "`SetMetadata`+`Reflector` 로 옮기지 않은 이유", "`assertProductionConfig` 에 합치지 않은 이유" 를 상세히 서술하는데, 이는 사실상 하나의 완결된 설계 rationale이다. 그런데 이 내용이 대응 spec 문서의 `## Rationale` 에는 전혀 반영되지 않았다(spec 텍스트 전체를 검색해도 "reflection"·"canary"·"캐너리" 언급 0건). (1)의 선례(Production fail-closed 가드)가 유사한 부트 가드를 도입할 때마다 spec Rationale 에 남기는 관행을 세워 두었으므로, 이번 결정만 코드 주석에만 존재하는 것은 그 확립된 관행에서 벗어난다. `## 점검 관점 3(결정의 무근거 번복)` 의 정신에 해당 — 과거 결정을 "뒤집는" 것은 아니지만, 그 결정이 보호하려는 대상인 §"멤버십 검증은 가드 1곳에서" Rationale 을 구조적으로 보강하는 후속 결정이면서도 그 Rationale 문서에 동반 갱신되지 않았다.
  - 제안: `spec/5-system/1-auth.md` `## Rationale`(§Production fail-closed 가드 인접) 또는 `spec/data-flow/12-workspace.md` `## Rationale` §"멤버십 검증은 가드 1곳에서" 절 하단에 소절을 추가해 (a) 부팅 시 reflection 자가 검증을 두는 이유, (b) `SetMetadata`+`Reflector`(라우트별 opt-in 마커) 대안을 재차 기각한 이유(§Rationale 이미 확립한 "opt-in 은 74번째 라우트에서 재발" 논리와 연결), (c) `assertProductionConfig` 와 별도 부트 단계로 둔 이유를 코드 주석 요지대로 옮겨 적을 것. spec 변경이 필요하면 이 턴은 developer 권한 밖이므로 project-planner 로 넘긴다.

- **[INFO]** 캐너리 코드 주석의 "73건" 인용이 원 Rationale 의 서브셋 수치를 전체 수치처럼 읽힐 수 있음
  - target 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — "이 저장소에는 그런 라우트가 다수 있으므로(2026-08-08 실측 73건) 0 은 'reflection 이 통째로 깨졌다'는 뜻이다."
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` §"멤버십 검증은 가드 1곳에서" — "2026-08-08 전수 실측: HTTP 라우트 222건 중 `@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는 것 **73건**".
  - 상세: Rationale 의 73건은 "`@WorkspaceId()` 소비 **+** `@Roles()` 미부착" 이라는 서브셋 카운트다. 반면 캐너리의 `countWorkspaceIdConsumingRoutes` 는 `@Roles()` 유무와 무관하게 `@WorkspaceId()` 를 소비하는 라우트 전체를 센다("그런 라우트" = 소비 라우트 전체를 가리키는 문맥). 두 모집단이 다르므로 실제 부팅 시 관측되는 카운트는 73 이 아니라 그 이상(73 + `@Roles()` 를 동반한 소비 라우트 수)일 가능성이 높다. 캐너리의 "0 이면 깨졌다" 는 판정 자체는 두 모집단 어느 쪽으로 세어도 여전히 유효하지만, 주석이 인용한 근거 수치가 실제 부팅 로그 값과 다르면("N건 인식" 로그) 향후 운영자가 급락을 판단할 기준선("정상은 대략 73")을 착각할 위험이 있다.
  - 제안: 주석에서 "73건"이 `@Roles()` 없는 서브셋 수치임을 한 단어로 명시하거나("그중 최소 73건은 `@Roles()` 도 없다" 등), 부팅 로그(`assertWorkspaceIdReflectionWorks` 의 `count`)로 실측한 전체 소비 라우트 수를 별도로 재확인해 정확한 기준선을 남긴다.

## 확인된 정합 사례 (참고, 발견사항 아님)

- `workspace-reflection-canary.ts` 주석은 "`SetMetadata`+`Reflector` 로 옮기지 않은 이유"에서 "`spec/data-flow/12-workspace.md` §Rationale 이 **명시적으로 기각한** '라우트별 opt-in 마커' 패턴" 이라고 인용하는데, 이는 실제로 `spec/data-flow/12-workspace.md` `## Rationale` §"멤버십 검증은 가드 1곳에서"의 "**기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착**: opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다(이미 최소 2회 발생)" 항목과 정확히 대응한다. 지어낸 이력이 아니라 실제 Rationale 을 정확히 인용했고, 그 기각된 대안을 다시 채택하지 않는 방향(구조적 전수 스캔)으로 설계했다 — 이 프로젝트가 반복적으로 문제 삼아 온 "허위 기각 이력 인용" 패턴에 해당하지 않는다.
- 부트 가드를 `assertProductionConfig` 와 별도 단계로 둔 선택은 `spec/5-system/1-auth.md` `## Rationale` §"Production fail-closed 가드" 가 이미 명시한 분리 기준("DI·요청 컨텍스트가 필요하거나… 의도적으로 분리한다")과 정합한다 — 새 캐너리는 `app.get(DiscoveryService)` 로 DI 컨테이너가 필요해 순수 env-var 체크인 `assertProductionConfig` 와 다른 축이다.
- fail-closed 기본값(0건이면 throw)은 프로젝트 전반의 "인프라 가용성(Redis/DB) 이외의 데이터/구조 정합성 게이트는 fail-closed 가 원칙" 이라는 반복 확인된 설계 성향(예: `4-execution-engine.md` §Rationale "왜 fail-closed(판정 불가도 거부)인가", sub-workflow workspace 격리 fail-closed 전환 선례)과 같은 방향이라 원칙 위반이 아니다.
- 헤더 형식 검증(`isUuidShaped`) 도입은 header-first 우선순위(`spec/data-flow/12-workspace.md` §"활성 워크스페이스 = 토큰 클레임") 자체를 바꾸지 않는다 — 유효한 헤더는 여전히 우선이며, 형식이 깨진 값만 조기 400 으로 걸러 500 마스킹을 막는 추가 방어다. 신규 코드가 반환하는 코드는 기존에 이미 카탈로그화된 일반 `VALIDATION_ERROR`(400, `3-error-handling.md §1.3`)를 재사용하므로 새 에러 코드 신설도 아니다.

## 요약

이번 diff 는 순수 코드 hardening(부팅 시 reflection 캐너리 + 헤더 UUID 형식 검증)으로, `spec/data-flow/12-workspace.md` 가 2026-08-08 자로 확립한 "멤버십 검증은 가드 1곳에서, `@Roles()` 라우트별 opt-in 마커는 기각" Rationale 을 정확히 인용하며 그 기각된 대안을 재도입하지 않는 방향으로 설계됐고, fail-closed·DI-분리 등 기존에 반복 확인된 설계 원칙과도 정합한다. 유일한 실질적 갭은 이 신규 부트 가드 자체의 설계 근거가 (같은 문서가 확립한 "Production fail-closed 가드" 선례와 달리) 대응 spec 문서의 `## Rationale` 에 동반 반영되지 않았다는 점이며, 부수적으로 캐너리 주석이 인용한 "73건"이 원 Rationale 의 서브셋 수치를 전체처럼 읽힐 여지가 있다. 둘 다 즉각적인 결함 재발이나 원칙 위반은 아니고 문서 동기화 성격의 이슈다.

## 위험도
LOW
