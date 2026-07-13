### 발견사항

- **[INFO]** SoT 상수화 3번째 호출부 완성(직전 라운드 20_02_41 WARNING #1 반영)이 실제 코드·spec 서술과 정확히 일치함을 직접 대조로 재확인
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:269,283,334,342`(기존 2곳) + `:473,477`(`propagateContainerInMap`, 신규 반영분) vs `spec/3-workflow-editor/2-edge.md` R-3 "커플링 주의" 단락
  - 상세: 이번 payload(파일 1~26)에는 커밋 `12ea43d7a`(editor-store.ts 4줄 변경)가 diff 로 포함돼 있지 않아, 작업 트리를 직접 grep 해 확인했다. `editor-store.ts` 전체에서 `'body'`/`'emit'`/`"body"`/`"emit"` 리터럴이 0건이고, `detectContainerConflict`(269,283)·`propagateContainerOnConnect`(334,342)·`propagateContainerInMap`(473,477) 3개 호출부 모두 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 공유 상수(`edge-utils.ts` export)를 사용한다. `RESOLUTION.md`(20_02_41) WARNING #1 "반영" 서술("472/477 을 CONTAINER_BODY_HANDLE/CONTAINER_EMIT_HANDLE 로 치환... editor-store 내 body/emit 리터럴 0건")과 정확히 일치하며, spec R-3 "두 핸들 값은... 공유 상수로... compile-time 으로 묶여 있다(hidden coupling 제거)" 서술도 이제 완전히 성립한다(3곳 전부 커버). `detectContainerConflict` 상단 JSDoc 의 "COUPLING(§4.1 edge split)" forward-pointer 는 원자성 보장의 근거인 거부 분기 함수만 정확히 겨냥하고 있어(propagateContainerInMap 은 거부가 아닌 전파 함수라 이 코멘트 대상 밖) 범위 설정도 적절하다.
  - 제안: 조치 불요 — 문서(spec)와 코드 간 드리프트 없음.

- **[INFO]** RESOLUTION.md(20_02_41) 가 주장한 backlog 등록("`plan/complete/spec-sync-edge-gaps.md` 비고에 `task_78c80fec`/`task_89a0d3a2` 등록")도 직접 대조로 확인 — 정확함
  - 위치: `plan/complete/spec-sync-edge-gaps.md` `## 비고` 섹션 (line ~39)
  - 상세: 직전 라운드(requirement.md, 20_02_41)가 지적한 "canonical plan 위치에 소급 미반영" WARNING #2 가 실제로 해소됐다. `task_78c80fec`(UX 프리뷰 이월)·`task_89a0d3a2`(노드 복제 phantom-undo)가 기존 관례(같은 섹션의 다른 이월 항목과 동일 서식)로 정확히 등록돼 있다. `grep -rl "task_89a0d3a2"` 로도 이제 `plan/**`·`review/**` 양쪽에 존재해 review-only 고립 상태가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드(20_16_42) payload 에도 실제 소스 diff(커밋 `12ea43d7a` 의 `editor-store.ts`/`plan/complete/spec-sync-edge-gaps.md`)가 포함되지 않음 — harness diff-list 갭 3회 연속 재발(19_42_07→20_02_41→20_16_42)
  - 위치: 본 세션 `meta.json`/`_prompts/*.md` 26개 파일 목록(review 산출물 25개 + `spec/3-workflow-editor/2-edge.md` 1개뿐, `codebase/frontend/src/lib/**` 실제 소스 0개)
  - 상세: requirement/architecture reviewer 가 이미 두 라운드 연속 이 계열 결함을 WARNING 으로 보고했고(review-infra 이슈, 코드 무관 판정), 본 문서화 리뷰도 동일하게 diff 를 신뢰하지 않고 `git show 12ea43d7a`/직접 grep 으로 우회 검증해 위 두 항목(SoT 상수화·backlog 등록)의 정확성을 확인했다. 문서화 관점 자체의 새 결함은 아니나, 이 harness 갭이 계속되면 향후 라운드에서 comment-drift(코드 주석이 실제 구현과 어긋나는 경우)를 문서화 리뷰가 놓칠 위험이 누적된다는 점만 재확인해 둔다(요청 조치는 requirement/architecture 리포트가 이미 등재).
  - 제안: 조치 불요(중복 트래킹 회피) — orchestrator diff-base 수정은 requirement.md 권고를 참조.

- **[INFO]** CHANGELOG.md 최상단 §4.1 항목이 4/5회차(SoT 상수 추출) 세부는 명시하지 않음 — 기존 관례와 일치, 결함 아님
  - 위치: `CHANGELOG.md` "Unreleased — 워크플로 편집기 엣지 분할(중간 노드 삽입)" 항목, "부수 수정(ai-review 3회차)" 문구까지만 기재
  - 상세: 이 항목은 3회차(undo phantom 스냅샷 제거, 사용자가 체감 가능한 실제 버그 수정)까지만 명시하고, 4/5회차의 "컨테이너 경계 핸들 SoT 상수화"는 behavior-preserving 내부 리팩터라 언급이 없다. CHANGELOG 가 지금까지 "사용자/동작 영향이 있는 수정"만 개별 언급하고 순수 유지보수성 리팩터는 생략해 온 기존 패턴(1회차 CRITICAL·2회차 통합 테스트·3회차 undo 버그는 언급, 그 사이 세부 리팩터는 미언급)과 일치한다.
  - 제안: 조치 불요 — 관례 유지. (원한다면 "SoT 상수 추출로 hidden coupling 제거"를 한 문장 추가해도 되나 차단 사유 아님.)

- **[INFO]** 5회 연속(consistency-check `18_06_53` → ai-review 2·3·4·5회차) 동일 non-blocking 각주 2건이 이번 라운드에도 여전히 미반영
  - 위치: `spec/3-workflow-editor/0-canvas.md` §3.3 ↔ `2-edge.md` §4/§4.1 상호참조 각주, `1-node-common.md`/`2-edge.md` §3.1 "컨테이너 포트=보라" 대상 구분 각주
  - 상세: 매 라운드 "차단 사유 아님, 여유 있을 때 반영"으로 재상기되고 있으나 실제 반영은 없다. 5회 연속 재상기는 이전 라운드(20_02_41 documentation.md)가 이미 지적한 "추적 피로(tracking fatigue)" 신호가 지속되고 있음을 의미한다.
  - 제안: 여전히 비차단. 다만 이 changeset(spec-sync-edge-gaps 5 surface)이 사실상 종결 단계이므로, 이번 기회에 실제 반영하거나 "확정 보류"로 SUMMARY/RESOLUTION 에 명시해 이후 라운드에서 재상기를 멈추는 편을 권고(반복만으로 우선순위가 오르지 않으므로 이번이 매듭짓기 좋은 시점).

### 확인된 사항 (문제 없음 — 근거 포함)

- spec R-3 "커플링 주의"·§4.1 본문 서술은 실제 코드(3개 호출부 전부 SoT 상수 사용)와 line-level 로 완전히 일치.
- `edge-utils.ts` `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` JSDoc 과 `editor-store.ts` `detectContainerConflict` JSDoc 의 상호 forward-pointer 는 여전히 정확하고 범위도 적절(원자성 근거인 거부 분기 함수만 겨냥, 전파 함수는 코멘트 대상 밖이라 누락이 아님).
- `plan/complete/spec-sync-edge-gaps.md` 비고 섹션의 backlog 등록(task_78c80fec/task_89a0d3a2)이 RESOLUTION.md 주장과 일치.
- 이번 라운드에 새로 추가된 review 산출물(19_42_07, 20_02_41 각 라운드의 SUMMARY/RESOLUTION/개별 checker md/meta/_retry_state.json) 상호 내용이 정확히 일치하며 왜곡·과장 없음(SUMMARY 의 WARNING 표가 각 checker 원문과 대응, RESOLUTION 의 "반영" 주장이 실제 코드 변경과 대응).
- CHANGELOG·사용자 가이드 MDX(ko/en)·plan 라이프사이클은 이전 라운드(20_02_41)에서 이미 확인된 상태 그대로 유지되며 이번 라운드에서 추가로 갱신이 필요한 사용자 영향 변경은 없음(SoT 리팩터·backlog 등록 모두 내부/절차성).

### 요약

이번 6회차 documentation 리뷰 대상은 실질적으로 직전 5회차(20_02_41) 아키텍처 WARNING(컨테이너 경계 핸들 SoT 상수화 부분 미완)의 최종 반영 결과(커밋 `12ea43d7a`)와, 그 반영을 기록한 review/ 하위 절차적 산출물이다. payload 에는 이번에도 실제 코드 diff 가 빠져 있어(harness diff-list 갭 3회 연속, review-infra 이슈로 이미 등재됨) 작업 트리를 직접 대조했고, 그 결과 SoT 상수화가 3개 호출부 전부(detectContainerConflict·propagateContainerOnConnect·propagateContainerInMap) 완료돼 spec R-3 "hidden coupling 제거" 서술이 이제 완전히 성립하며, RESOLUTION.md 가 주장한 backlog 등록(task_78c80fec/task_89a0d3a2)도 canonical plan 위치에 정확히 반영돼 있음을 확인했다. 새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다. 유일하게 남은 것은 5회 연속 이월된 non-blocking 각주 2건(0-canvas §3.3↔2-edge §4.1 상호참조, 컨테이너 포트 색상 대상 구분)으로, 여전히 차단 사유는 아니지만 반복 이월 자체가 tracking fatigue 신호이니 이번 changeset 종결 시점에 실제 반영하거나 "확정 보류"로 매듭짓기를 권고한다.

### 위험도

NONE
