# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. requirement/maintainability/testing 3개 reviewer 가 동일한 근본 원인(주석 "top-level 스코프가 같다" 주장과 `collectLivePlanMarkdown` 의 실제 필터 불일치 + 그 결과인 중복 스캔 로직)을 서로 다른 각도에서 지적해 수렴. 강제(forced) 화이트리스트 6개(maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Testing / Requirement (중복 지적 통합) | `plan-frontmatter.test.ts` 상단 주석이 "`collectLivePlanMarkdown`(spec-links.ts) 는 `collectTopLevelPlans` 와 같은 top-level 스코프"라고 주장하지만, 실제로는 `collectLivePlanMarkdown` 이 `0-`/`_` 접두 인덱스 파일을 걸러내지 않아(그룹 서브폴더 제외만 동일) 두 스캔 로직이 조용히 어긋난다. 게다가 `plan-frontmatter.test.ts` 는 이미 `collectLivePlanMarkdown` 을 import 하면서도 `collectTopLevelPlans` 를 별도로 손으로 재구현해, 이 파일 자신이 상단 주석에서 경고하는 "두 곳이 조용히 틀어진다" 패턴을 새로 재현하고 있다. 현재 `plan/in-progress/` 최상위에 해당 이름의 파일이 없어 실제 위반은 0건(잠복 상태)이며, 이를 고정하는 fixture 테스트도 없다. | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:34-38`(주석 주장), `:45-59`(`collectTopLevelPlans` 재구현) / `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:267-282`(`collectLivePlanMarkdown`, 접두 필터 없음) | `collectTopLevelPlans` 를 `collectLivePlanMarkdown(root)` 결과에 `0-`/`_` 접두 필터만 얹어 파생시켜 단일 스캔 소스로 통합. 의도적 차이로 남기려면 주석을 "그룹 서브폴더만 동일 제외, 접두 면제는 비대칭" 으로 정정하고 fixture 로 그 차이를 pin. |
| 2 | Testing | 신규 `findBrokenPlanLinks`/`collectLivePlanMarkdown` 진입점이 자매 함수(`findBrokenLinks`, `findBrokenSpecLinksInSources`)와 달리 fixture 기반 negative-path 테스트가 없어, "위반 0건"(positive-only)과 "파일 수 > 5"(vacuous-pass 방지)만으로는 스캐너가 실제로 깨진 링크·코드펜스 내 링크·self-anchor 를 올바르게 처리하는지 증명하지 못한다. | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:267`(`collectLivePlanMarkdown`), `:302`(`findBrokenPlanLinks`) / 호출부 `plan-frontmatter.test.ts:174`, `:185` | `spec-links.test.ts` 기존 패턴대로 임시 fixture 로 (1) DEAD 링크 탐지 (2) 코드펜스 내 링크 무시 (3) `checkSelfAnchors:false` 로 인한 self-anchor 무시를 양성 단언으로 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 마크다운 링크 타깃 경로가 `path.resolve` 시 경계 검증 없이 해석됨(이론상 저장소 밖 파일 존재 여부 확인 가능하나 slug 만 계산되고 원문은 노출 안 됨). 현재 신뢰 모델(레포 내부, read-only, 개발자 작성 콘텐츠)에서 익스플로잇 가능성 사실상 없음. | `spec-links.ts:224`(`findBrokenLinksInFiles`), `:302`(`findBrokenPlanLinks`) | 현재 조치 불요. 향후 외부 입력에 재사용 시 `resolved.startsWith(root)` 경계 검사 추가 검토. |
| 2 | Maintainability | 디렉터리 트리 순회 로직이 두 파일 5곳에서 각각 재구현(재귀 vs 반복 스택 혼재). | `plan-frontmatter.test.ts:45-59, 62-78` / `spec-links.ts:130-150, 268-282, 331-355` | 강제 아님. 향후 6번째 스캐너 추가 시 공통 `walkDir` 유틸 고려. |
| 3 | Maintainability | `findBrokenLinksInFiles` 내 동일 shape violation 객체 생성이 3회 반복. | `spec-links.ts:205-212, 225-232, 236-243` | 로컬 헬퍼(`push(kind)`)로 통합 권장. |
| 4 | Maintainability | `isExternal` 의 `http://`/`https://` 개별 `startsWith` 분기가 뒤따르는 일반 스킴 정규식과 중복(죽은 코드, 동작 영향 없음). | `spec-links.ts:106-115` | 개별 분기 제거해 의도 명확화. |
| 5 | Maintainability | 테스트 하한값(매직 넘버) 3곳(`>5`, `>20`, `>5`)이 인라인 리터럴로 분산. | `plan-frontmatter.test.ts:142, 199, 228` | 우선순위 낮음. 이름 있는 상수로 모으는 것 고려. |
| 6 | Testing | `TERMINAL_STATUSES` 4개 값 중 `complete` 외 3개(`implemented`/`applied`/`superseded`)는 실코퍼스에 각 1~4건만 존재해, non-vacuity 카운트 가드(`>20`)가 `complete` 128건만으로 충족되므로 나머지 분기가 코퍼스 변화에 따라 조용히 미실행될 수 있음. | `plan-frontmatter.test.ts:87, 197` | 우선순위 낮음. fixture 로 4개 어휘 각각 pin 권장. |
| 7 | Testing | `plan/complete/**` frontmatter 파싱 실패는 침묵 스킵(in-progress 는 명시적으로 실패시킴) — 의도된 설계이나 비대칭. | `plan-frontmatter.test.ts:207-211` | 낮은 우선순위. 필요 시 "깨진 YAML 을 가진 completed plan" 경고 후속 가드 고려. |
| 8 | Requirement | `status` 필드가 문자열이 아니면 조용히 skip(직전 RESOLUTION 에서 이미 검토·유보, 실측 0건). | `plan-frontmatter.test.ts:215` | 재조치 불요 — 참고용. |
| 9 | Requirement | `in-progress/` 에 종료 status 를 선언한 거울상 케이스는 미검사(직전 RESOLUTION 에서 의식적으로 유보). | (해당 없음) | 재조치 불요 — 참고용. |
| 10 | Scope | `collectTopLevelPlans` 와 `collectLivePlanMarkdown` 이 거의 동일한 스캔 로직 보유(스코프 위반 아님, maintainability WARNING#1 과 동일 관찰). | `plan-frontmatter.test.ts:45-59` / `spec-links.ts:267-282` | WARNING#1 조치로 함께 해소됨. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 경로 해석 경계 검증 부재(INFO, 익스플로잇 가능성 사실상 없음). 인젝션·시크릿·인증 문제 없음. |
| requirement | LOW | spec(`plan-lifecycle.md` §4/§5)과 line-level 일치, 149 테스트 GREEN 실측. 링크 검사 스코프 주석-구현 불일치 1건(WARNING). 직전 라운드 WARNING 2건 해소 확인. |
| scope | NONE | 순수 추가(insertion-only) 변경, 커밋 목적에 정확히 대응. 중복 스캔 로직 관찰(INFO, maintainability 로 이관). |
| side_effect | NONE | 모든 신규 코드 read-only 파일시스템 접근만 수행. 쓰기·네트워크·전역 상태 변경 없음. |
| maintainability | LOW | `collectTopLevelPlans` 가 이미 import 된 `collectLivePlanMarkdown` 과 거의 동일한 로직을 재구현(WARNING). 기타 사소한 중복·매직넘버(INFO). |
| testing | LOW | 신규 링크 진입점에 negative-path fixture 테스트 부재(WARNING), 스코프 주석-구현 불일치 미고정(WARNING). 실행 검증(18 files/2823 tests GREEN) 확인. |

## 발견 없는 에이전트

(없음 — 전 reviewer 가 최소 1건 이상 INFO 이상 발견 보고)

## 권장 조치사항
1. `collectTopLevelPlans` 를 `collectLivePlanMarkdown(root)` 파생으로 리팩터(0-/_ 접두 필터만 추가)해 스캔 로직을 단일 소스로 통합 — maintainability WARNING#1 / testing WARNING#2(스코프 갭) 동시 해소.
2. `spec-links.test.ts` 기존 fixture 패턴을 따라 `findBrokenPlanLinks`/`collectLivePlanMarkdown` 에 negative-path 테스트(DEAD 링크 탐지, 코드펜스 무시, self-anchor 무시) 추가 — testing WARNING#1.
3. (낮은 우선순위) violation 객체 생성 헬퍼화, `isExternal` 죽은 분기 제거, 매직넘버 상수화, `TERMINAL_STATUSES` 3개 희소 어휘 fixture pin — 전부 INFO, 강제 아님.

## 라우터 결정

- `routing=all` (라우터가 아닌 전체 실행 방침 — forced 화이트리스트로 강제 포함):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing` (6명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (전원, 6명) — 결과 전원 확보됨, 누락 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |