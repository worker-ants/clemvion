### 발견사항

- **[INFO]** 이번 라운드(20_16_42) 리뷰 payload 는 실제 애플리케이션 코드 diff를 포함하지 않음 — harness diff-list 갭 3회 연속 재발
  - 위치: 본 prompt payload 파일 1~26 전체 (`review/code/2026/07/13/{19_18_01,19_42_07,20_02_41}/**` 산출물 md/json + `review/consistency/2026/07/13/18_06_53/**` + `spec/3-workflow-editor/2-edge.md`)
  - 상세: 직전 두 라운드(`19_42_07/requirement.md`, `20_02_41/requirement.md`·`architecture.md`)가 이미 지적한 "실제 마지막 커밋의 코드 파일이 diff 목록에서 빠짐" 문제가 이번 라운드에도 동일하게 재발했다. `git log --oneline -3` 로 확인한 결과 이번 라운드가 실제로 검증해야 할 마지막 커밋은 `12ea43d7a`("SoT 상수 3번째 호출부 완성")이며, 이 커밋은 `codebase/frontend/src/lib/stores/editor-store.ts`(4줄)와 `plan/complete/spec-sync-edge-gaps.md`(1줄 비고 추가)만 변경했는데 둘 다 이번 payload에 없다. 코드베이스 자체의 유지보수성 결함이 아니라 orchestrator diff-base 산출 로직 문제(기존 review-infra 이슈와 동형, 반복 재확인됨).
  - 제안: 신뢰 가능한 diff가 없어 직접 `git show 12ea43d7a`, `grep`으로 작업 트리를 대조해 검증했다(아래 참조, 결함 없음). orchestrator의 diff-base 계산 로직 점검은 이미 3회 연속 다른 리뷰어들이 권고한 사항과 동일하므로 중복 트래킹 불필요.

- **[NONE/양호]** 이번 라운드의 실질 코드 변경(`editor-store.ts` `propagateContainerInMap`)은 매직 스트링 제거 + SoT 완성이라는 유지보수성 개선 그 자체이며, 완전하고 정확하게 적용됨
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:473,477` (`propagateContainerInMap`)
  - 상세: 직접 대조 결과, 4회차(`d00d39c18`)가 놓쳤던 작은따옴표 `'body'`/`'emit'` 리터럴 2곳을 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE`(edge-utils.ts export, 137-138행) 상수로 정확히 치환했다. `grep -n "'body'\|'emit'\|\"body\"\|\"emit\""` 로 `editor-store.ts` 전체를 재검색한 결과 잔여 리터럴 0건 — 같은 파일의 `detectContainerConflict`(269,283행)·`propagateContainerOnConnect`(334,342행)·`propagateContainerInMap`(473,477행) 세 곳 모두 동일 상수를 사용해 3개 호출부의 SoT 커버리지가 완전해졌다. 변경 자체가 4줄로 매우 작고 로직 변경 없이 리터럴→상수 치환뿐이라 behavior-preserving 임이 diff 상으로도 자명하며, 순환 복잡도·중첩 깊이·함수 길이에 영향 없음.
  - 참고: 정확히 이 항목이 직전 라운드(20_02_41) architecture/requirement 가 제기한 WARNING("SoT 상수화가 3곳 중 2곳에만 적용")에 대한 조치로, 이번 라운드에서 완전히 해소됐다.

- **[INFO]** (사전 존재, 이번 diff 범위 밖) `detectContainerConflict`/`propagateContainerOnConnect`/`propagateContainerInMap` 세 함수가 동일한 "Rule 1(body)/Rule 2(emit)/Rule 3(chain)" 분기 로직을 각각 독립적으로 재구현
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` 245-291행(`detectContainerConflict`), 303-360행경(`propagateContainerOnConnect`), 454-511행경(`propagateContainerInMap`)
  - 상세: 세 함수는 데이터 표현(불변 `Node[]` 조회 vs in-place `Map` 갱신 vs 충돌만 판정)이 달라 하나로 합치기는 쉽지 않지만, "container body/emit/chain 3규칙"이라는 동일한 도메인 로직이 3중으로 손으로 동기화돼야 하는 구조다. 이번 changeset이 고친 것(상수 SoT)은 "핸들 값"의 중복만 해소했을 뿐, "규칙 자체"의 구조적 중복은 여전히 남아 있다. 다만 이는 이번 5개 라운드에 걸친 diff 어디에서도 새로 도입되거나 변경된 부분이 아니라 선재 코드이며, JSDoc 상호참조(`propagateContainerInMap`이 "propagateContainerOnConnect의 in-place 변형... 동일한 3개 규칙" 이라 명시)로 의도적 미러링임을 이미 문서화하고 있어 즉각 조치가 필요한 결함은 아니다.
  - 제안: 차단 사유 아님. 향후 이 3규칙에 변경이 필요해지면(예: Rule 4 추가) 세 함수를 동시에 갱신해야 하므로, 여유가 있을 때 "3규칙 판정"을 순수 함수 하나로 추출해 세 함수가 그 결과만 다른 방식으로 소비하도록 리팩터링을 고려할 수 있다(장기 개선, 이번 PR 스코프 아님).

- **[NONE]** `spec/3-workflow-editor/2-edge.md` §4.1/R-3 문서 자체는 유지보수성 관점(가독성·네이밍·일관성)에서 특별한 결함 없음
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1, R-3 Rationale
  - 상세: "분할(split)" vs "분리(detach)" 용어 구분, 컨테이너 경계·컨테이너 새 노드 제외 규칙, undo 단일 체크포인트, hidden-coupling 주의 문구 등이 이미 여러 차례(consistency-check, ai-review 1~5회차) 다듬어져 명확하고 일관된 용어를 사용한다. R-3 문단들이 다소 길고 정보 밀도가 높지만(가독성 측면에서 문단을 더 짧게 쪼갤 여지는 있음), 이는 코드가 아닌 spec 산문이라 본 리뷰 관점(함수 길이·중첩·매직넘버·순환복잡도)의 대상이 아니며 documentation reviewer 영역과 중복되므로 추가 지적하지 않는다.

### 요약

이번 라운드(20_16_42)의 payload는 review 산출물(md/json)과 spec 문서로만 구성돼 실제 코드 diff가 빠져 있어(harness diff-list 갭 3회 연속 재발, INFO), 직접 `git show`/`grep`으로 최신 커밋(`12ea43d7a`)의 실제 코드 변경을 검증했다. 그 결과 이번 커밋은 `editor-store.ts` `propagateContainerInMap`의 남은 매직 스트링 `'body'`/`'emit'` 2곳을 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 공유 상수로 치환해, 4회차가 부분적으로만 완료했던 SoT 상수화를 3개 호출부 전부로 완성한, behavior-preserving하고 규모가 작은(4줄) 순수 유지보수성 개선이다. 신규 CRITICAL/WARNING은 없다. 세 개의 형제 함수(`detectContainerConflict`/`propagateContainerOnConnect`/`propagateContainerInMap`)가 동일한 3규칙 로직을 구조적으로 중복 구현하는 선재 패턴이 남아 있으나, 이번 diff 범위 밖이며 JSDoc으로 의도가 문서화돼 있어 차단 사유가 아니다(장기 개선 참고용 INFO).

### 위험도

NONE