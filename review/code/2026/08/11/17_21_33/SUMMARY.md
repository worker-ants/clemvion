# ai-review SUMMARY — `17_21_33` (6) + consistency `17_21_43` (5)

델타 = 커밋 `91edf4f6e` (51 라우트 `@ApiForbiddenResponse` + spec 3곳 + plan).

## 집계 — 11/11 착지, **CRITICAL 0**, consistency 전원 BLOCK:NO

| reviewer | 위험도 |
|---|---|
| scope · documentation | **NONE** |
| convention · naming · rationale · plan_coherence | **NONE** |
| security · api_contract · maintainability · cross_spec | LOW |
| **testing** | **MEDIUM** |

## 이 라운드의 값 셋

### 1. 술어가 규약보다 좁았다 — 3명 수렴, 그러나 **셋이 다 다른 수를 냈다**

`swagger.md §5-4` 는 **"`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는"** 을 대상으로
정하는데, 티켓 §2 는 **"`@Roles()` 부재"** 로 좁혀 적었다. 그래서 `@Roles()` 는 있는데
`@ApiForbiddenResponse` 가 아예 없는 라우트가 남았다.

| 리뷰어 | 센 개수 |
|---|---|
| security | 6 |
| api_contract | 3 |
| convention_compliance | 12 |
| **내 실측** | **13** |

**세 리뷰어가 모두 달랐다** — 각자 훑은 범위가 달랐기 때문이다. 수렴한 것은 "남았다" 라는
사실이지 개수가 아니다. 직접 세는 것 말고는 답이 없었다. 13건 전부 처분, §5-4 술어 기준 잔여 0.

### 2. testing 이 내 뮤테이션 주장을 반증했다 (MEDIUM)

나는 "가짜 앵커 주입 → `spec-link-integrity` RED 확인" 이라 적었다. testing 이 scratch 미러에서
재현해 **절반만 참**임을 밝혔다 — 두 앵커 중 `swagger.md:350` 은 **멀티라인 마크다운 링크**라
`extractLinks()` 의 한 줄 단위 정규식이 원천적으로 못 잡는다.

원인은 명확하다: **나는 둘을 동시에 바꾸고 RED 하나를 봤다.** 자매를 각각 뮤테이트하라는
이 저장소의 교훈을, 하필 **검증 자체**에서 어겼다.

testing 은 또 `@ApiForbiddenResponse` 부착을 지키는 **회귀 가드가 저장소에 없음**을 짚었다 —
P0 PR 이 `@Roles()` 에 대해 만든 `workspace-roles-attachment.spec.ts` 와 비대칭이다.

### 3. codemod 가 데코레이터 인자 안쪽에 삽입했다 (내가 diff 읽다 발견)

2차 codemod 첫 판이 `@UseInterceptors(` 안의 `FileInterceptor('file', {` 를 메서드 시그니처로
오인해 문법을 깼다. 괄호 깊이 0 조건으로 수정. (1차 51건은 이 버그가 없었고 `tsc` 가 그것을
독립 확인했다.)

## 처분한 발견

| 출처 | 내용 |
|---|---|
| security·api_contract·convention (3명) | `@Roles()` 보유 잔여 **13건** 부착 |
| **testing** | 앵커 링크를 한 줄로 펴서 **각각 독립 RED** 재검증 |
| api_contract | `llm-model-config.controller.ts:118` 이 이번 부착과 **정면 모순**하는 주석 |
| convention | §4 표 `**Editor+**` bold → 선례(`13-replay-rerun.md`)대로 plain |
| cross_spec | `1-auth §3.2` 를 따옴표로 감싼 **비-verbatim 인용** → 표 참조 서술 |
| plan_coherence | 후속 항목의 §5-4 인용 오류 → **§2-4**(401 요구는 그쪽 소관) |

## 등재만 (범위 밖)

- **`spec-link-integrity` 멀티라인 링크 사각지대** — 전수 실측 **6건/6파일**. 가드가 조용히
  통과시키므로 깨진 앵커가 있어도 아무도 모른다. testing 발견 + 내 전수 측정.
- `workflow-assistant` 3라우트 `@ApiUnauthorizedResponse` 부재 (§2-4).
- `@ApiForbiddenResponse` 부착 회귀 가드 부재 (testing).

## 검증되어 조치 불요

- **api_contract 가 `RolesGuard` 를 직접 읽어** 51건이 실제로 403 을 낼 수 있음을 확인 —
  "안 나는 에러를 난다고 문서화" 가 아니다. `@Public()` 제외도 코드로 확인.
- **maintainability 가 공용 데코레이터 추출을 정직하게 기각** — 기존 인라인 63+156건,
  `applyDecorators` 사용처는 저장소 전체 1곳뿐. 관례 위반이 아니라 준수다.
- **plan_coherence 가 `backend-lint-gate-broken-on-main` 과의 파일 충돌 0건** 확인.
- **rationale 이 EIA `R14`(403 미사용)와의 충돌 가설을 실측 반증** — R14 는 EIA
  `interaction-token` 전용이고 내부 RBAC 403 은 이미 전역 표준.
- scope 가 `+57/-0` 순수 추가를 **전수 정규식으로** 확인(삭제 0, 패턴 외 추가 0).

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 6 (전부 처분)
