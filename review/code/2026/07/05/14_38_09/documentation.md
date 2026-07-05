# 문서화(Documentation) Review — V-04 folder depth/cycle guard (재검토, 14_38_09)

## 스코프 확인

이번 changeset 은 14_28_16 세션에서 이미 1회 리뷰된 동일 구현(`folders.controller.ts`/`folders.service.ts`/`folders.service.spec.ts`)에 더해, 그 리뷰 라운드 자체의 산출물(SUMMARY/RESOLUTION/각 reviewer 리포트, consistency-check 산출물)과 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-04 체크박스 갱신, 그리고 이미 반영되어 있던 `spec/1-data-model.md §2.5`·`spec/2-navigation/1-workflow-list.md §3.1` 를 포함한다. 실질적인 신규 프로덕션 코드 변경은 없다(RESOLUTION.md 에도 "프로덕션 코드 무변경" 명시).

## 발견사항

- **[INFO]** plan 체크박스 갱신이 이번 diff 로 완료 — 이전 라운드가 지적한 프로세스 갭 해소
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md:34`
  - 상세: 14_28_16 라운드의 `requirement.md` 가 "V-04 체크박스 미갱신"을 INFO 로 지적했었는데, 이번 diff 에서 `- [ ] 잔여: V-04·V-05·...` 가 `- [x] **V-04** (...) 잔여: V-05·V-09·...` 로 갱신되어 근거(브랜치명·구현 요약·spec 참조·TEST WORKFLOW 결과)까지 함께 기록됐다. 문서 추적성 관점에서 바람직한 조치다.
  - 제안: 없음(양호).

- **[INFO]** CHANGELOG.md 는 이번 라운드에서도 갱신되지 않음(기지 갭 반복)
  - 위치: 저장소 루트 `CHANGELOG.md`
  - 상세: 14_28_16 documentation.md 가 이미 "API 소비자 관점에서 관찰 가능한 breaking 성격 변경(종전엔 통과하던 parentId 이동 요청이 이제 400)이므로 CHANGELOG 후보"라고 INFO 로 남겼던 항목이 이번 diff 세트에도 반영되지 않았다. RESOLUTION.md 의 조치표에도 "maintainability/documentation INFO ... 비차단, 미조치(현 규모 적정)"로 명시적으로 스킵 처리되어 있어, 팀이 인지한 상태에서 의도적으로 보류한 것으로 보인다.
  - 제안: 기존 판단(비차단)을 유지해도 무방. 다만 팀 관례상 CHANGELOG 를 꾸준히 쓰는 편이라면 별도 후속 커밋에서 한 줄 추가를 고려.

- **[INFO]** `@ApiBadRequestResponse` description 비대칭이 이번 라운드에도 미해소 (기지 갭)
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts` (`update()` 의 `@ApiBadRequestResponse({ description: '입력값 검증 실패' })`)
  - 상세: 14_28_16 documentation.md·api_contract.md 양쪽에서 이미 지적된 사항으로, `create()` 는 `@ApiBadRequestResponse` description 에 "중첩 깊이 초과"를 명시하지만 `update()` 는 여전히 일반 문구만 남아 있고, 신규 cycle/cross-workspace/depth 사유는 `@ApiOperation.description` 에만 있다. 이번 diff(파일 1)에도 `@ApiOperation.description` 만 확장되고 `@ApiBadRequestResponse` 는 그대로다. RESOLUTION.md 에서 "비차단, 미조치(현 규모 적정)"로 처리된 항목과 동일 — 재확인 결과 실제로 코드에 반영되지 않은 채 남아 있음을 확인.
  - 제안: 낮은 비용의 후속 fix 후보로 계속 유지. blocking 은 아님.

- **[INFO]** review 산출물(SUMMARY/RESOLUTION/개별 reviewer .md, consistency-check 산출물)이 이번 diff 에 신규 커밋되는 것 자체는 프로젝트 관례(`review/` 커밋 대상)와 일치
  - 위치: `review/code/2026/07/05/14_28_16/*`, `review/consistency/2026/07/05/14_08_56/*`
  - 상세: CLAUDE.md 정보 저장 위치 표에 따라 `review/code/**`·`review/consistency/**` 는 정식 저장 위치이며 gitignore 대상이 아니다(사용자 memory: "review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋"). 이번 diff 는 그 관례를 그대로 따른 것으로 문서화 관점에서 문제 없음.
  - 제안: 없음.

- **[INFO]** spec 갱신은 코드와 이미 동일 커밋 계보에서 정합 — 재확인 결과 갭 없음
  - 위치: `spec/1-data-model.md:137-142`, `spec/2-navigation/1-workflow-list.md:140`
  - 상세: `§2.5` 제약 조건에 "생성·부모 변경 모두에 적용", "같은 워크스페이스", "비순환(acyclic)"이 추가되었고, `1-workflow-list.md` PATCH 행에도 4가지 실패 조건(cross-workspace/self·descendant cycle/depth 초과)과 에러코드(`VALIDATION_ERROR`), `parentId: null` 루트 이동 허용이 명시되어 있다. `validateParentChange()`(파일 3) 구현과 line-level 로 대응되며, 14_28_16 requirement.md 가 이미 이 정합을 확인한 바와 이번 재확인 결과가 일치한다.
  - 제안: 없음.

## 준수 확인 (긍정적 사항, 재확인)

- 인라인 주석(파일 3: `update()`, `getDepth()`, `validateParentChange()`, `collectSubtree()`)은 "무엇을"이 아니라 "왜"(create 는 검사하나 update 는 종전 무검증이었던 배경, visited-set 가드가 방지하는 구체적 실패 모드, 에러 코드 재사용으로 `CONTAINER_CYCLE`/`CYCLE_DETECTED` 와의 혼동을 피한 이유)를 설명하며, 코드와 100% 일치하는 최신 상태다. 오래된/부정확한 주석 없음.
- Swagger `@ApiOperation.description`(파일 1)이 신규 검증 규칙과 에러코드를 정확히 반영.
- `folders.service.spec.ts`(파일 2)의 신규 8개 테스트가 각 시나리오(무변경 skip, self-parent, cross-workspace/not-found, descendant cycle, depth 초과, 루트 이동, 정상 shallow reparent, 경계값 depth 5, 다중 서브트리 BFS, cyclic 데이터 무한루프 방지)를 mock 시퀀스 주석과 함께 문서화해 실행 가능한 예제 역할을 겸한다 — RESOLUTION.md 에 기록된 대로 이전 라운드 WARNING(경계값·형제다중 BFS 커버리지 갭)이 실제로 해소됨을 테스트 코드 자체로 확인.
- plan 문서(파일 4)가 구현 배경·spec 참조·테스트 결과까지 근거를 남기며 체크박스를 갱신해 추적성이 확보됨.

## 요약

이번 재검토 대상은 실질적으로 신규 프로덕션 코드 변경이 아니라, 이미 한 차례 문서화 리뷰(14_28_16, 위험도 LOW)를 통과한 V-04 구현에 대한 후속 아티팩트(리뷰 산출물 커밋, plan 체크박스 갱신)로 구성된다. 이전 라운드가 남긴 유일한 프로세스성 갭(plan V-04 미체크)은 이번 diff 로 정확히 해소되었고, spec-code 정합은 재확인해도 여전히 일치한다. 남은 항목은 모두 이전 라운드에서 이미 INFO 로 식별되고 팀이 "비차단·미조치"로 의식적으로 보류한 것들(CHANGELOG 미갱신, `update()` 의 `@ApiBadRequestResponse` description 이 `create()` 대비 비대칭)이며, 이번 재검토에서도 새로운 CRITICAL/WARNING 급 문서화 이슈는 발견되지 않았다.

## 위험도

NONE
