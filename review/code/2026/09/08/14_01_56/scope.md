# 변경 범위(Scope) 리뷰

## 사전 확인

`git diff --stat origin/main HEAD`(82개 파일, +4397/-162)를 실제로 실행해 프롬프트 번들(41개 코드/plan 파일 + `review/code/**`·`review/consistency/**` 산출물)과 대조 — **완전히 일치**한다. 이 브랜치는 4개 커밋으로 구성된다:

| 커밋 | 성격 |
|---|---|
| `03f665c63` | 배치 B 본체 (B-1~B-8, 8개 항목) |
| `9ab43690a` | 1라운드 `/ai-review`(`12_53_08`) 대응 fix — CHANGELOG 추가 + fail-open 술어 수정 |
| `05b899d1f` | `--impl-done`(`13_22_38`) 대응 fix — `spec_impact` 오기 정정 + planner 항목 2건 신규 등재 |
| `d80583700` | 2라운드 `/ai-review`(`13_34_28`, `--route=all`) 대응 fix — AST 워커 중복 통합(`enclosingScopeName`) |

`plan/in-progress/spec-followups-batch-b.md` 가 B-1~B-8 여덟 항목을 사전에 선언하고, 실제 diff 의 코드 파일 23개가 그 항목들에 1:1 대응한다(파일 1~23, 이전 라운드 `12_53_08/scope.md` 의 매핑표와 이번 라운드에서 직접 재검증한 결과 일치). 나머지 파일은 (a) `plan/in-progress/**` 3개 — 체크박스 플립 + 트리거 재판정 기록, (b) `review/code/**`·`review/consistency/**` 산출물 — 이 배치 자체의 게이트 증빙(`--impl-prep`/`--impl-done`/`/ai-review` 2라운드)이다.

3개 후속 fix 커밋(`9ab43690a`/`05b899d1f`/`d80583700`)은 모두 **같은 배치가 만든 코드에 대한 리뷰 응답**이고, 건드리는 파일도 원 배치가 이미 다룬 파일(`http-exception.filter.ts`, `endpoint-path-conflict-wrap-guard.ts`, `user-entity-exposure-guard.ts`, `source-scan.ts`, `CHANGELOG.md`, plan 파일)에 국한된다 — 새 모듈·새 서비스로 번지지 않았다.

## 발견사항

- **[INFO]** AST 워커 `enclosingName` 을 `user-entity-exposure-guard.ts` 에서 제거하고 `source-scan.ts` 의 `enclosingScopeName` 으로 통합 — 두 형제 가드(`user-entity-exposure-guard.ts`, `endpoint-path-conflict-wrap-guard.ts`)에 걸친 리팩터
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:12` (import 로 대체), `codebase/backend/src/common/__test-utils__/source-scan.ts:101` (`enclosingScopeName` 신설)
  - 상세: 이 배치가 신설한 `endpoint-path-conflict-wrap-guard.ts` 가 처음엔 자체 `enclosingMethodName` 을 갖고 있었는데, 2라운드 `/ai-review`(architecture WARNING#1)가 "형제 `enclosingName` 과 책임 중복"을 지적했다. 처리 커밋(`d80583700`)이 그 지적에 대해 "중복은 맞지만 형제에 같은 버그가 있다는 진단은 틀렸다"고 직접 반증한 뒤, 규칙을 바꾸지 않고 형제의 알고리즘을 `source-scan.ts` 로 승격해 두 가드가 공유하게 만들었다 — 형제 파일(`user-entity-exposure-guard.ts`)의 판정 로직 자체는 바뀌지 않았고(순서·우선순위 동일), 정의 위치만 옮겨졌다. 리뷰가 지적한 중복을 리뷰 응답 턴에서 해소한 것이라 배치 범위 이탈로 보기 어렵지만, 두 개의 독립된 가드 파일을 동시에 건드리는 cross-file 리팩터라는 점은 기록해 둔다.
  - 제안: 조치 불요 — 리뷰 지적에 대한 정당한 응답이고 대상이 그 두 파일로 한정된다.

- **[INFO]** `review/code/**` 2세트(`12_53_08`, `13_34_28`) + `review/consistency/**` 3세트(`12_21_11`, `13_22_38`, `13_34_30`) 산출물이 코드 변경과 같은 브랜치에 커밋됐다
  - 위치: `review/code/2026/09/08/12_53_08/**`, `review/code/2026/09/08/13_34_28/**`, `review/consistency/2026/09/08/{12_21_11,13_22_38,13_34_30}/**`
  - 상세: CLAUDE.md 가 명시한 `--impl-prep`/`--impl-done` 의무 절차 + `/ai-review` 2라운드의 산출물이며, 이 저장소 관례상 `review/**` 는 커밋 대상이다(gitignore 안 됨). 내용 대조 결과 각 라운드의 판정(`BLOCK: NO`, Critical 0)이 실제 코드 범위와 일치해 실질적 문제는 없다.
  - 제안: 조치 불요 — 프로젝트 관례에 부합.

- **[INFO]** `integration-oauth.service.ts` 의 import 문이 한 줄에서 여러 줄로 개행됨
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1` (`import { isPostgresUniqueViolation, pgErrorConstraint } from '../../common/db/pg-error';`가 3줄로 개행)
  - 상세: 새 심볼 `pgErrorConstraint` 추가로 줄 길이가 늘어 prettier 가 자동으로 멀티라인화한 결과이며, 논리와 무관한 드라이브바이 포맷팅이 아니다. `git diff -w`(공백 무시) 대비 일반 diff 의 라인 수 차이(1242 vs 1216, 전체 codebase diff 기준)도 이 개행 + `tsconfig.build.json` 의 신규 exclude 항목 앞 쉼표 추가 정도로 설명되는 범위이며, 별도의 대규모 재포맷 흔적은 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이 배치가 다루지 않는 planner 항목 2건이 신규 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — "쿼리 범위 `select` 투영을 `1-data-model.md ## Rationale` 에 정식 등재"·"`2-api-convention.md §5.4` 의 `swagger.md` 인용 절 정정" 두 항목(둘 다 `- [ ]`, planner 소관으로 명시)
  - 상세: `--impl-done`(`13_22_38`) 라운드에서 발견된 rationale/convention 갭을 developer 가 직접 고치지 않고 트래커에만 등재했다 — CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙을 그대로 따른 것이라 스코프 이탈이 아니라 오히려 올바른 경계 준수다.
  - 제안: 조치 불요.

이 4개 커밋을 개별 diff 로 대조했을 때, 계획(B-1~B-8) 밖의 신규 기능 추가·무관한 파일 수정·의미 없는 포맷팅·미사용 임포트·의도치 않은 설정 변경은 발견되지 않았다. `CHANGELOG.md`·`PROJECT.md`·`tsconfig.build.json` 변경은 각각 plan 이 명시적으로 요구한 동반 갱신(B-1, B-2, B-3)이다.

## 요약

`origin/main` 대비 4개 커밋 82개 파일 diff 전체를 실측 대조한 결과, 코드 변경 23개 파일은 `plan/in-progress/spec-followups-batch-b.md` 가 사전 선언한 B-1~B-8 여덟 항목에 1:1 대응하고, 나머지 3개 후속 fix 커밋은 그 배치 자체가 촉발한 두 차례 `/ai-review`·`--impl-done` 게이트 지적에 대한 응답으로 대상 파일이 원 배치 범위 안에 그대로 머문다. 유일한 cross-file 터치는 AST 워커 중복 통합(`enclosingScopeName` 승격)인데, 이는 리뷰가 직접 지적한 중복을 해소한 것이고 대상도 관련된 두 가드 파일로 한정된다. `review/**` 산출물 동반 커밋·import 개행·plan 신규 항목 등재는 모두 프로젝트 관례에 부합하는 정상적 부산물이다. 실질적인 스코프 이탈은 발견되지 않았다.

## 위험도

NONE
