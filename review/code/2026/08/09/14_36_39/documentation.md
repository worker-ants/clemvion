# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 "추적" 링크가 이미 이동된 plan 경로를 가리킨다 (stale path)
  - 위치: `CHANGELOG.md:47`
  - 상세: `SoT: ... 추적: plan/in-progress/auth-workspace-membership-guard.md, plan/in-progress/auth-guard-reflection-hardening.md.` 인데, 실제로 `auth-workspace-membership-guard.md` 는 이미 `plan/complete/auth-workspace-membership-guard.md` 로 이동되어 있다(저장소에 `plan/in-progress/auth-workspace-membership-guard.md` 는 존재하지 않음 — `find plan -iname auth-workspace-membership-guard.md` 로 실측). 이번 diff 는 바로 이 줄(같은 문단)을 편집해 두 번째 경로(`plan/in-progress/auth-guard-reflection-hardening.md`, 이건 실제로 in-progress 라 정확함)를 추가하면서도, 옆의 stale 경로는 고치지 않고 그대로 남겼다. 같은 세션에서 다룬 `plan/in-progress/auth-guard-reflection-hardening.md` 자신은 정확히 `../complete/auth-workspace-membership-guard.md` 로 링크하고 있어(13번째 줄) 올바른 경로를 알고 있었다는 점에서 더 눈에 띄는 누락이다. 이 프로젝트는 "plan 서술은 철회로 거짓이 될 수 있다"·"체크리스트 동기화" 류의 stale-doc 회귀를 반복 학습한 이력이 있다.
  - 제안: `CHANGELOG.md:47` 의 경로를 `plan/complete/auth-workspace-membership-guard.md` 로 정정한다.

- **[INFO]** 신설 부팅 캐너리(`assertWorkspaceIdReflectionWorks`)가 배포 문서(`README.md`)에 노출되지 않음
  - 위치: `codebase/backend/README.md:37-42` (기존 "배포 주의" 섹션) / 관련 신규 코드: `codebase/backend/src/main.ts` (게이트 168), `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
  - 상세: `main.ts` 는 `assertProductionConfig` 와 별개로, **환경과 무관하게(항상)** `assertWorkspaceIdReflectionWorks(app)` 를 호출해 인식 라우트가 0건이면 `WorkspaceIdReflectionBrokenError` 로 부팅을 멈춘다(fail-closed). README 의 "배포 주의" 섹션은 현재 `NODE_ENV=production` 한정 5개 항목(JWT_SECRET 등 env 값 기반)만 나열하고 있어, 이 신규 캐너리는 그 섹션의 정의(env 값 판정)에 정확히 들어맞지 않는다는 점은 코드 JSDoc·plan 문서(`plan/in-progress/auth-guard-reflection-hardening.md`)에 이미 근거로 남아 있다(별도 축이라 `assertProductionConfig` 에 합치지 않기로 한 의도된 결정). 다만 배포 담당자가 부팅 실패를 조사할 때 첫 번째로 참고할 문서는 README 일 가능성이 높은데, 거기엔 "reflection 이 깨지면 부팅이 멈출 수 있다"는 신규 실패 모드에 대한 어떤 단서도 없다. 이 운영 지침(`@nestjs/*` 업그레이드 PR 에서 이 경로 테스트가 깨지면 flaky 취급하지 말고 보안 회귀로 우선 조사)은 현재 CHANGELOG·코드 JSDoc·plan 세 곳에만 존재한다.
  - 제안: README "배포 주의" 섹션(또는 그 아래 새 문단)에 한 줄만 추가해 이 캐너리의 존재와 실패 시 조사 지침(`common/decorators/workspace-reflection-canary.ts` 로 링크)을 남길지 판단할 것. (참고: `review/consistency/2026/08/09/14_01_15/rationale_continuity.md` INFO 항목이 이미 "프로덕션에서도 부팅 실패를 일으킬 수 있다면 최소 PR 설명/CHANGELOG 에 명시" 를 제안했고 CHANGELOG 는 채웠으나, README 가시성까지는 다루지 않았다. "구조적 code invariant 라 README 문서화 자체가 불필요하다"는 반대 결론도 방어 가능 — 결정만 명시적으로 남기면 충분.)

- **[INFO]** `spec/5-system/1-auth.md §2.1` 과의 가시성 정합 결정이 코드 주석에는 있으나 plan 체크리스트에 명시적 "결정 완료" 표기가 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (JSDoc "`assertProductionConfig` 에 합치지 않고 별도 부트 단계로 둔 것도 의도다" 문단, 파일 상단 40번째 줄 인근) / `plan/in-progress/auth-guard-reflection-hardening.md`
  - 상세: `--impl-prep` rationale_continuity 리뷰(INFO, `review/consistency/2026/08/09/14_01_15/rationale_continuity.md:59-80`)는 "부트타임 캐너리가 boot-fail-closed 라면 기존 Production fail-closed 가드 문서화 관행(JWT_SECRET 등 5개 항목, `1-auth.md §2.1`)과의 정합 여부를 **명시적으로 결정**할 것"을 제안했다. 코드 JSDoc 은 "이쪽은 환경과 무관한 구조 불변식" 이라는 근거로 별도 축임을 설명하지만, `1-auth.md §2.1` 에 5개 항목과 같은 수준의 한 줄을 추가할지 여부에 대한 결정 자체는 명문화되어 있지 않다(암묵적으로 "안 한다" 로 읽힘). `spec_impact: none` 은 유지되고 있어 결과적으로는 일관되나, 판단 근거를 plan 문서에 한 문장으로 남기면 다음 사람이 재조사하지 않아도 된다.
  - 제안: 사소한 항목이라 필수는 아니나, 여유가 있으면 `plan/in-progress/auth-guard-reflection-hardening.md` §1 체크리스트에 "spec/1-auth.md §2.1 에 캐너리 항목을 추가하지 않기로 결정(구조적 불변식이라 env 기반 5개 항목과 다른 카테고리)" 한 줄을 명시.

## 긍정적 관찰 (참고용, 조치 불요)

- 신설 `workspace-reflection-canary.ts` 는 "왜 필요한가(fail-open 실패 방향)", "무엇을 단언하나(라우트 목록이 아니라 0건 여부)", "왜 `SetMetadata`+`Reflector` 로 옮기지 않았는가", "왜 `assertProductionConfig` 와 분리했는가" 를 각 섹션으로 나눠 근거·기각된 대안·알려진 한계(부분 파손 미검출)까지 모두 문서화 — 이 저장소의 "문서한 보장이 구현보다 넓으면 안 된다" 원칙을 잘 지킨 사례.
- `uuid.ts` 의 `isUuidShaped` JSDoc 은 `isValidUuid` 와의 차이(버전/variant nibble 무시)를 이유와 함께 명확히 구분했고, 두 술어의 경계값(nil UUID·v7 등)이 `uuid.spec.ts` 테스트로 고정되어 있다.
- `workspace-context.util.ts` 의 `resolveRequestWorkspaceContext` JSDoc 은 반환 플래그가 아닌 `throw` 를 택한 이유(소비처 2곳의 drift 방지)와 토큰 클레임을 검증하지 않는 이유(서버 서명값 vs 클라이언트 입력)를 명시적으로 남겼다.
- `CHANGELOG.md` 신규 문단은 회귀 원인(FE `apiClient` 가 모든 요청에 `X-Workspace-Id` 부착)·수정 방식(reflection 기반 소비 여부 판별)·운영 지침(업그레이드 PR 관례)·400/500 응답 정정의 배경(SQLSTATE 22P02, `GlobalExceptionFilter` 매핑 갭)까지 정확하고 상세하게 기록되어 있다(코드와 대조해 서술 정확성 확인 완료).
- `main.ts`·`app.module.ts` 에 추가된 인라인 주석은 각각 왜 이 시점에 캐너리를 호출하는지, `DiscoveryModule` 이 왜 필요한지를 근거 파일로 교차 링크해 짧지만 충분하다.
- 새 테스트 파일(`workspace-reflection-canary.spec.ts`, `uuid.spec.ts` 등)의 픽스처·edge-case 주석은 "왜 이 값을 고르는지"·"이 테스트가 없으면 무엇이 놓치는지"를 설명해 테스트 자체가 문서 역할을 겸한다.
- 테스트 픽스처를 임의 문자열(`'ws1'`, `'victim-ws'`)에서 실제 형태의 UUID 상수로 바꾸며 각 파일 상단에 그 이유(프로덕션에서 존재 불가능한 값이었다)를 명시한 점도 일관되게 잘 되어 있다.

## 요약

이번 변경은 보안 회귀(reflection 파손 시 멤버십 검증 fail-open)를 막는 부팅 캐너리와 UUID 형식 검증을 다루는데, 코드 JSDoc·인라인 주석·CHANGELOG·plan 문서 간 근거·결정 배경의 정합성이 전반적으로 높고 서술 정확성도 코드와 대조해 문제가 없었다. 다만 CHANGELOG 의 plan 추적 링크가 stale 경로를 그대로 남겨(WARNING) 다음 독자가 잘못된 경로를 따라갈 수 있고, 신규 무조건적 부팅 실패 모드가 배포 담당자가 먼저 볼 README 에는 반영되지 않은 점(INFO)이 개선 여지다. Critical 급 문서화 결함은 없다.

## 위험도

LOW
