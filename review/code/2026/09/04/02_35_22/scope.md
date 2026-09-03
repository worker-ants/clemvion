# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38}/**` (파일 10~33) 이 diff 에 포함됨
  - 위치: `review/code/2026/09/04/01_48_39/meta.json` 외 다수 (파일 10~33 전체)
  - 상세: 이 PR 자체의 1R·2R 리뷰 세션 산출물이다. `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 "마무리 커밋에 리뷰 산출물을 함께 담는 관례"에 정확히 부합한다. 내용도 대조해 보면 지금 검토 중인 바로 이 두 작업(walker 통합·낡은 spec 캐스트 가드)에 대한 리뷰이지, 무관한 산출물이 섞여 들어온 것이 아니다. 직전 라운드(02_12_38) scope 리뷰에서도 동일 결론(INFO#9, "스코프 이탈 아님")이 나왔다.
  - 제안: 조치 불필요. 스코프 이탈이 아님을 재확인하는 차원의 기록.

## 확인한 것 (스코프 정합성의 근거)

핵심 코드 변경 9개 파일(`source-scan.ts`/`.spec.ts`, 4개 walker 소비 가드, `nullable-type-lie-cast-guard.ts`/`.spec.ts`, plan 문서)이 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 **이미 사전 계획된 두 후속 항목**과 정확히 결속되는지 `git show` 로 직접 대조했다.

1. **`repo-guards/__tests__/` 공용 walker 추출** — 배치 3 완료 커밋(`562d3119f`)에 이미 `- [ ] **후속 — ... 공용 walker 추출** (리뷰 W5)` 로 명시돼 있었다(형제 가드 4개 walker 사본 문제, "이 배치에 넣지 않는다"로 유예). 이번 diff 가 그 유예를 해소한다 — `collectTsFiles` 하나로 5사본을 통합하고 소비처 4곳(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`)을 갱신했다. 계획에 없던 새 범위가 아니다.
2. **넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트 가드** — 같은 커밋에 `- [ ] **가드 사각지대 — .spec.ts 의 낡은 캐스트** (배치 2 리뷰 W2·W3)` 로 이미 존재했고, "배치가 끝날 때마다 `grep 'as unknown as' --include='*.spec.ts'` 로 훑는 것이 현실적이다"라고 수작업 임시 조치까지 적혀 있었다. 이번 diff 는 그 수작업을 `widenedEntityFields`+`findStaleSpecCasts` 자동 가드로 승격한다. 역시 사전 계획 범위 안이다.

두 항목 모두 이번 diff 의 `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경(`git diff` 단일 hunk, `@@ -241,10 +241,49 @@`)에서 `[ ]` → `[x]` 로 정확히 닫혔고, 그 외 plan 문서의 다른 절은 건드리지 않았다.

라운드 간 추가 조치(2R fix, 커밋 `79bce075e` — 동명 필드 오탐 수정)도 `git show --stat` 으로 확인했다: 건드린 파일은 `nullable-type-lie-cast-guard.ts`·`nullable-type-lie-cast.spec.ts`·plan 문서·해당 라운드 리뷰 산출물뿐이다. 새 파일·무관 모듈로 번지지 않았다.

`withFiles`/`withFixture` 통합(1R W3 지적에 대한 자기 수정)·`stripComments` export 확대·신규 `collectTsFiles`/`stripLiterals` 전용 테스트 추가는 전부 **이 diff 자신이 도입한 코드에 대한 같은 diff 내 자기 교정**이다 — 무관한 리팩터링이 아니라 이번 리팩터 자체의 완결에 필요한 부분이다.

`git diff -w`(공백 무시) 결과가 원본과 동일해, 포맷팅 변경이 실질 변경에 섞여 들어간 부분도 없다.

## 요약

핵심 변경 9개 파일은 plan 문서에 사전 등록된 두 후속 항목(walker 통합·낡은 spec 캐스트 가드)에 정확히 결속되며, 라운드 간 추가 fix 커밋도 해당 가드 파일·spec·plan·리뷰 산출물 밖으로 번지지 않았다. `review/code/**` 하위 리뷰 세션 산출물 24개 파일은 프로젝트 관례상 정상 커밋 대상이고 내용도 이 PR 자신의 리뷰 이력이다. 포맷팅-only 변경이 실질 변경과 섞인 곳도 없다. 요청 범위를 벗어난 리팩터링·기능 확장·무관한 파일 수정을 찾지 못했다.

## 위험도

NONE
