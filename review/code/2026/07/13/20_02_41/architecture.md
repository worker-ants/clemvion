### 발견사항

- **[WARNING]** 컨테이너 경계 핸들 SoT 상수화(직전 라운드 WARNING 수정)가 3개 호출부 중 2개에만 적용 — `propagateContainerInMap` 은 여전히 `'body'`/`'emit'` 하드코딩
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:473,477`(`propagateContainerInMap`) vs 같은 파일의 `detectContainerConflict`(269, 283행)·`propagateContainerOnConnect`(334, 342행)
  - 상세: 이번 changeset(19_42_07 라운드) RESOLUTION.md WARNING #1 "반영" 내역은 "컨테이너 경계 핸들을 `edge-utils.ts` `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 단일 export 상수로 추출... `detectContainerConflict`/`propagateContainerOnConnect`(editor-store)가 함께 import"라고 명시한다. 실제로 이 두 함수(269/283/334/342행)는 상수를 정확히 import·사용한다(직접 소스 확인). 그러나 같은 파일의 세 번째 함수 `propagateContainerInMap`(454행, 473/477행)은 자신의 JSDoc(450행)에서 "`propagateContainerOnConnect` 의 in-place 변형... 기존 함수와 동일한 3개 규칙을 적용한다"고 명시적으로 선언하면서도, 정작 `sourceHandle === 'body'` / `targetHandle === 'emit'` 를 원시 문자열 리터럴로 재하드코딩한다 — 같은 파일 상단(24-25행)에 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 가 이미 import 돼 있는데도 이 함수만 그 상수를 쓰지 않는다. 이 함수는 죽은 코드가 아니다: `deriveContainerAssignments`(402행, docstring 상 "workflow load, edge removal, node removal" 시 호출)가 매 pass 마다 `propagateContainerInMap` 을 호출하며, `deriveContainerAssignments` 는 엣지 제거 시 실행되므로 이번 §4.1 mid-insert 플로우의 `removeEdge`(원본 엣지 제거) 단계에서도 실행 경로를 탄다. 즉 원자성 보장의 SoT 로 지목된 값이 실제로는 여전히 3곳 중 1곳에서 사람이 손으로 동기화해야 하는 상태이며, 이는 정확히 원 WARNING 이 지적한 "컴파일러가 강제하지 않는 hidden coupling" 패턴이 수정 커밋(`d00d39c18`) 안에서 그대로 재발한 사례다. (현재는 리터럴 값이 상수 값과 동일해 기능적 회귀는 없음 — 순수 유지보수/구조적 리스크.)
  - 제안: `propagateContainerInMap` 의 473/477행도 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 로 치환해 SoT 커버리지를 3곳 모두로 확장할 것. 이 함수가 "동일 3규칙의 in-place 변형"임을 스스로 문서화하고 있으므로, 원 WARNING 수정과 동일한 논리로 같은 PR/커밋에서 함께 처리하는 것이 자연스럽다.

- **[INFO]** 이번 라운드(20_02_41) payload 에도 실제 소스 diff(`edge-utils.ts`/`editor-store.ts`/`workflow-canvas.tsx`)가 포함되지 않음 — 직전 라운드(19_42_07) `requirement.md` 가 이미 지적한 harness diff-list 갭과 동일 패턴 재발
  - 위치: 본 prompt payload 파일 1~19(review 산출물 md/json + `spec/3-workflow-editor/2-edge.md` 뿐, `codebase/frontend/src/lib/**` 실제 소스 없음)
  - 상세: RESOLUTION.md 가 주장하는 "SoT 상수화" 수정을 diff 만으로는 검증할 수 없어, 이번 리뷰는 작업 트리를 직접 Read/grep 해 실제 코드 상태를 대조했다(위 WARNING 은 그 결과 발견). 코드베이스 아키텍처 결함이 아니라 orchestrator 의 diff-base 선정 로직 문제이며, 직전 라운드가 이미 동일 사유로 INFO/WARNING 을 남겼다(같은 review-infra 이슈가 2회 연속 재현). 신뢰할 수 없는 diff 목록이 "리뷰가 실제로 반영된 수정 코드를 못 보고 clean 판정"하는 거짓 음성 위험을 계속 안고 있다는 점을 다시 표기해 둔다.
  - 제안: 차단 사유 아님(별도 harness 이슈로 이미 트래킹 중으로 보임). orchestrator diff-base 계산 로직 점검 권고를 재확인.

- **[INFO]** 레이어 분리·용어 정합·스코프 축소(R-3) 등 나머지 아키텍처 판단은 이전 라운드 architecture.md(19_42_07)의 평가와 동일하게 양호 — 재확인, 조치 불요
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1, R-3
  - 상세: hit-test(DOM/뷰포트 의존)는 `workflow-canvas.tsx` `onDrop`, 순수 판정/조립(`buildEdgeSplitPlan`, `isContainerBoundaryEdge`)은 `edge-utils.ts` 에 위치해 `0-canvas.md` R-2 계층 분리 원칙을 그대로 재사용한다. 컨테이너 경계 엣지·컨테이너형 신규 노드를 스코프에서 제외한 R-3 결정(대안 a/b 대비 c 선택)은 기존 §6/§11.2.1 불변식을 건드리지 않는 합리적 YAGNI 트레이드오프이고, backend `CONTAINER_LOOPBACK_PORTS` 전례를 재사용한 SoT 상수 패턴 자체(부분 미완만 제외하면)도 방향은 옳다.

### 요약

이번 changeset 은 review 산출물(SUMMARY/RESOLUTION/개별 checker 리포트)과 `spec/3-workflow-editor/2-edge.md` §4.1/R-3 갱신이 대부분이다. R-3 "커플링 주의" 단락과 RESOLUTION.md 는 원자성 보장의 hidden-coupling(직전 WARNING)을 `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 공유 상수로 해소했다고 서술하지만, 실제 작업 트리를 직접 대조한 결과 `editor-store.ts` 의 `detectContainerConflict`/`propagateContainerOnConnect` 두 곳만 이 상수를 쓰고, 동일 파일에서 "같은 3규칙의 in-place 변형"이라고 스스로 문서화한 `propagateContainerInMap`(엣지 제거 시 실행되는 `deriveContainerAssignments` 경로)은 여전히 `'body'`/`'emit'` 문자열을 하드코딩한다 — SoT 수정이 부분적으로만 완료됐다(WARNING). 현재 기능 회귀는 없으나(값이 우연히 일치), 정확히 원 WARNING 이 우려한 재발 패턴이 수정 자체 안에서 남아 있어 조치를 권고한다. 그 외 레이어 분리·스코프 축소 결정은 양호하며, 이번 라운드 payload 에도 실제 소스 diff 가 빠져 있어(harness diff-list 갭 재발) 직접 파일 대조로 보완했다.

### 위험도

LOW
