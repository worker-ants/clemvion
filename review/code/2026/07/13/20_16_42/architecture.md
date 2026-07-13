### 발견사항

- **[WARNING]** harness diff-list 갭이 3회 연속(19_42_07 → 20_02_41 → 20_16_42) 재발 — 실제 코드 변경(commit `12ea43d7a`)이 이번 라운드 payload 에도 누락
  - 위치: 본 세션 `_prompts/*.md` 전체(파일 1~26) — `codebase/frontend/src/lib/stores/editor-store.ts`, `edge-utils.ts`, `workflow-canvas.tsx` 및 테스트가 이번 payload 에도 포함되지 않음
  - 상세: `git diff origin/main..HEAD --stat` 로 직접 확인한 결과 이 브랜치는 `115ea91d2`(feat) → `0c4cd362d` → `c77db66b1` → `ad5fa3388` → `d00d39c18` → `12ea43d7a`(가장 최근) 6개 커밋에 걸쳐 실제 소스를 변경했는데, 이번 라운드(20_16_42) payload 26개 파일은 전부 `review/**` 산출물(9~26)과 `spec/3-workflow-editor/2-edge.md`(파일 26) 뿐이고 최신 커밋 `12ea43d7a` 가 변경한 `editor-store.ts` 4줄(`propagateContainerInMap` SoT 상수 치환)조차 포함하지 않는다. 직전 라운드(`20_02_41`) SUMMARY.md WARNING #3 이 "2회 연속 재발... 이번엔 실제 수정 권고" 라고 명시적으로 escalate 했음에도 이번 라운드에서 동일 갭이 그대로 재발해, orchestrator 의 diff-base 산출 로직이 여전히 고쳐지지 않았음을 시사한다. 본 리뷰어는 매 라운드와 마찬가지로 실제 파일을 직접 Read/grep 해 우회 검증했으나(아래 "확인된 사항" 참고), 이 우회가 매 라운드 반복되는 것은 지속 가능하지 않고 향후 실제 코드 결함을 조용히 놓칠 위험(기존 disk-write gap 거짓 음성과 동형의 실패 패턴)이 누적된다.
  - 제안: orchestrator 의 diff-base 계산 로직(어떤 커밋 범위를 payload 에 번들링하는지)을 지금 라운드에서 실제로 수정할 것 — 이미 2회 권고되었음에도 미조치 상태.

- **[INFO/양호, 확인됨]** 컨테이너 경계 핸들 SoT 상수화가 이번 라운드에서 3개 호출부 전부 완성됨 — 직전 WARNING 완전 해소
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:137-138`(`CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` export), `codebase/frontend/src/lib/stores/editor-store.ts:269,283`(`detectContainerConflict`), `:334,342`(`propagateContainerOnConnect`), `:473,477`(`propagateContainerInMap`, commit `12ea43d7a` 로 신규 치환)
  - 상세: 직접 grep 한 결과(`grep -n "'body'\|'emit'" editor-store.ts` 매치 0건) `editor-store.ts` 전체에서 `body`/`emit` 리터럴 문자열이 완전히 사라졌고, 세 호출부(`detectContainerConflict`/`propagateContainerOnConnect`/`propagateContainerInMap`) 모두 `edge-utils.ts` 의 공유 export 상수를 import 해 사용한다. 이는 4회차(19_42_07)에서 WARNING 으로 제기되고 5회차(20_02_41)에서 "3곳 중 2곳만 적용"으로 부분 미완이 재확인된 hidden-coupling 문제가 이번 커밋(`12ea43d7a`)으로 완전히 닫혔음을 의미한다 — 컨테이너 경계 판정(store 계층의 검증)과 분할 제외 판정(utils 계층의 계획 수립)이 이제 컴파일러가 강제하는 단일 상수 의존성으로 묶여, 향후 한쪽만 변경되는 drift 가 구조적으로 방지된다.
  - 제안: 없음(조치 완료). spec `2-edge.md` R-3 "커플링 주의" 단락도 "hidden coupling 제거" 로 갱신되어 코드·문서가 일치한다.

- **[INFO/양호, 확인됨]** backlog 추적성(WARNING #2, 20_02_41) 해소 — 두 후속 작업이 canonical plan 에 등록됨
  - 위치: `plan/complete/spec-sync-edge-gaps.md` 비고 항목(§4 하단)
  - 상세: 직접 확인 결과 `task_78c80fec`(엣지 분할 드롭 시각 프리뷰)와 `task_89a0d3a2`(노드 복제 phantom-undo 전수 감사)가 모두 `plan/complete/spec-sync-edge-gaps.md` 의 "follow-up" 비고에 명시 등록되어 있다. 이전 라운드에서 `RESOLUTION.md` 한 곳에만 존재하던 backlog 참조가 이번 라운드에 canonical 위치로 소급 반영되어, 추적성 단절 위험이 해소됐다.
  - 제안: 없음(조치 완료).

- **[INFO]** `withUndoCheckpoint` 류 상위 헬퍼로 undo 경계를 중앙화하는 구조적 개선은 여전히 미착수(장기 개선, 비차단)
  - 위치: `spec/3-workflow-editor/2-edge.md` Rationale R-3 "undo 단일 체크포인트 실측 보강" 단락
  - 상세: 이번 라운드에도 이 항목은 변화 없이 이월된다. §1.2·§4.1 에서 두 차례(각각 3회차 이전) 발견된 "호출부 `pushUndo()` + 하위 함수 내부 `pushUndo()` 중복" 버그가, 지금은 개별 사례 수정(`buildAndAddNode`)으로만 닫혔을 뿐 재발을 구조적으로 막는 중앙화 헬퍼는 여전히 부재하다. `task_89a0d3a2` 로 노드 복제 경로의 동일 결함이 별도 추적되고 있어 당장 차단 사유는 아니다.
  - 제안: 조치 불요(이미 이월 합의됨, 참고로만 재확인).

- **[INFO]** 레이어 분리(R-2)·R-3 스코프 축소 등 기존 아키텍처 판단은 이번 라운드에서도 변화 없이 유효
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1, R-3
  - 상세: hit-test(canvas seam)와 순수 판정/조립(edge-utils.ts) 계층 분리, 컨테이너 경계·컨테이너형 노드를 스코프에서 제외한 R-3 결정 모두 이전 3개 라운드(19_42_07/20_02_41)의 architecture 리뷰와 동일하게 재확인되며 신규 이슈 없음.
  - 제안: 없음.

### 요약

이번 라운드(20_16_42)에서 실제 코드에 반영된 유일한 변경(`propagateContainerInMap` 의 마지막 SoT 상수 치환, commit `12ea43d7a`)은 직전 라운드 WARNING을 완전히 닫는 behavior-preserving 수정으로, 컨테이너 경계 핸들(`body`/`emit`) 하드코딩이 `editor-store.ts` 전체에서 0건임을 직접 grep 으로 확인했다. backlog 추적성(`task_78c80fec`/`task_89a0d3a2` canonical plan 등록)도 함께 해소됐다. 다만 이번 라운드 payload 자체는 실제 소스 파일(`editor-store.ts`/`edge-utils.ts`/`workflow-canvas.tsx`)을 포함하지 않고 review 메타 산출물(SUMMARY/RESOLUTION/개별 checker 리포트)과 spec 문서만 번들링했는데, 이는 직전 라운드가 명시적으로 "실제 수정 권고"까지 했던 harness diff-list 갭이 3회 연속 재발한 것이다 — 코드 아키텍처 결함은 아니지만 review 프로세스의 신뢰성을 갉아먹는 구조적 문제로 WARNING 처리한다. CRITICAL 급 아키텍처 결함은 이번에도 없다.

### 위험도

LOW
