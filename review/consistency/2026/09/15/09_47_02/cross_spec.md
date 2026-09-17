# Cross-Spec 일관성 검토 — trigger-lock-followups

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `spec/5-system/**` 델타는 0개 파일 (이 브랜치는 spec 을 바꾸지 않음). 실제 구현 diff 는
  `git diff origin/main...HEAD` 로 직접 재확인:
  - `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
  - `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts`
  - `codebase/backend/src/modules/triggers/triggers.service.ts`
  - `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
  - `codebase/backend/src/modules/schedules/schedules.service.spec.ts`
  - (+ 루트 `CHANGELOG.md`, `plan/**`)
- 변경 내용: (a) `Trigger` 행이 advisory lock 없이도 지워질 수 있는 세 번째 경로(FK
  `onDelete: 'CASCADE'`)가 있음을 확인하고 `rewriteTriggerConfigLocked` 가 `UPDATE`
  0-affected 를 `false` 로 보고하도록 수정, (b) `acquireTriggerConfigLock` 의
  `timeoutMs` 유한성 검사 + clamp, (c) private `findByIdForUpdate` →
  `findByIdForPatchValidation` 개명, (d) 테스트/목 보강. 신규 spec 요구사항 ID·엔드포인트·
  RBAC 변경은 없음.

## 발견사항

- **[WARNING]** `Trigger` 삭제의 상류 CASCADE 경로가 `spec/data-flow/11-workflow.md`
  상태 다이어그램에 없음 (기존 갭 — 이 PR 이 노출·의존)
  - target 위치: 이 PR 의 근거 서술 — `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
    의 `rewriteTriggerConfigLocked` JSDoc, `CHANGELOG.md` "락을 잡아도 못 막는 세 번째 삭제
    경로" 항목. 둘 다 "`Workflow`·`Workspace` 삭제의 FK `onDelete: 'CASCADE'` 가 `Trigger`
    행을 지운다"를 핵심 근거로 서술한다.
  - 충돌 대상: `spec/data-flow/11-workflow.md` §3.1 상태 다이어그램 —
    `Active --> [*]: workflow 삭제 (CASCADE: nodes/edges/versions/executions/assistant_sessions)`
    (177~186행). `trigger`(및 그 cascade 인 `schedule`)가 열거에서 빠져 있다.
  - 상세: `codebase/backend/src/modules/triggers/entities/trigger.entity.ts` 에서
    `workflow`·`workspace` 양쪽 `@ManyToOne`이 `onDelete: 'CASCADE'`로 선언돼 있어
    (V001 마이그레이션부터), DB 레벨 사실 자체는 코드와 정합한다. 문제는 문서 간
    비대칭이다: `spec/1-data-model.md §2.9.1`과 `spec/2-navigation/2-trigger-list.md §4.3`은
    "Trigger가 지워질 때 무엇이 cascade 되는가"(하류 방향)만 서술하고, `11-workflow.md`의
    상태 다이어그램은 "Workflow가 지워질 때 무엇이 cascade 되는가"(상류 방향)를 서술하면서
    `trigger`를 빠뜨렸다. 이 PR의 실결함(④, `rewriteTriggerConfigLocked`가 0-affected를
    `true`로 오보하던 버그)이 발견된 경위 자체가 "이 상류 경로가 문서화되지 않아 아무도
    세지 않았다"는 것이었다 — 즉 이 문서 갭은 이 PR이 고친 코드 결함과 인과관계가 있다.
  - 판정: **이미 알려진 갭이며, 이 세션이 이미 적절히 처리했다.** developer는 자기가
    작성하지 않은 문장(`11-workflow.md`)을 자기-반증형 소정정 조건 1로 고칠 권한이
    없으므로, `plan/in-progress/spec-draft-nullable-notation-followups.md`의 planner 트래커
    항목 5b로 정확히 등재해 두었다(`--impl-prep review/consistency/2026/09/15/08_58_18`
    cross_spec W1 인용 포함, 2차 파급 `schedule`도 명시). 코드 자체는 CASCADE 사실과
    일치하므로 코드-스펙 모순은 아니고, 스펙 문서 간(상류/하류 서술 분리) 갭이다.
  - 제안: 이 PR에서 추가 조치 불요 — 이미 planner 큐에 있다. 다음 planner 턴에서
    `spec/data-flow/11-workflow.md §3.1`(및 `spec/data-flow/12-workspace.md §1.10`이 워크스페이스
    삭제 cascade 를 상세히 열거하게 될 경우 동일 항목)을 갱신할 때 이 항목을 참조할 것.

- **[INFO]** `rotateBotToken` 404 의 근거가 두 갈래인데 spec 이 하나만 서술
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken`
    (1318~1354행) — `rewriteTriggerConfigLocked`가 `false`를 돌려주면
    `this.throwTriggerNotFound()`로 `RESOURCE_NOT_FOUND` 404를 던진다. 이 경로는 이번
    diff로 처음 "도달 가능"해졌다(종전엔 항상 `true`였다).
  - 충돌 대상: `spec/5-system/15-chat-channel.md` 371행 — 404/`RESOURCE_NOT_FOUND` 의
    근거를 `findById`(요청 진입 시점 존재 검사) 하나로만 표기.
  - 상세: 두 경로 모두 같은 `code: 'RESOURCE_NOT_FOUND'`, 같은 메시지를 던지므로 API
    계약(status code·error code)은 모순이 없다. 다만 "왜 404가 나는가"의 근거 목록이
    구현보다 좁다 — 요청 처리 중 레이스로 트리거가 사라진 경우(락을 잡아도 못 막는
    세 번째 삭제 경로)도 동일 404를 낸다는 사실이 spec에 없다. API 계약 위반은 아니고
    문서의 완결성 문제다.
  - 제안: 급하지 않음. `15-chat-channel.md` §5.4 표의 404 근거 열에
    `rewriteTriggerConfigLocked` 레이스 케이스를 한 줄 추가하는 정도로 다음 spec 정비 때
    동기화 권장.

- 그 외 관점(데이터 모델 필드 정의, API endpoint/method/shape, 요구사항 ID, RBAC 매트릭스,
  계층 책임 분할)에서는 충돌을 발견하지 못했다. 이 PR이 새로 참조하는 식별자
  (`findByIdForPatchValidation`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`,
  `rewriteTriggerConfigLocked`, `acquireTriggerConfigLock`)는 `spec/**` 전체에서 0건
  일치 — 애초에 어느 spec도 이 내부 헬퍼를 이름으로 언급하지 않으므로 명명 재사용 충돌도
  없다. `trigger-config-lock.ts`·`schedules.service.ts`는 `spec/5-system/1-auth.md` 등
  어느 spec 파일의 `code:` frontmatter glob 에도 매칭되지 않는 spec-unlinked 코드라는
  점은 이미 plan 에 별도 항목(W2)으로 등재돼 있다 — 이번 검토가 새로 발견한 것은 아니다.

## 요약

이 PR은 `spec/5-system/**`를 전혀 수정하지 않는 코드 전용 변경(트리거 config 락의
0-affected UPDATE 오판정 수정, timeout 값 sanitize, private 메서드 개명)이며, 새 데이터
모델·API 계약·요구사항 ID·RBAC·계층 책임을 도입하지 않아 그 축에서는 충돌이 없다. 유일하게
의미 있는 cross-spec 신호는 이 PR의 근거 서술이 노출한 기존 문서 갭 —
`spec/data-flow/11-workflow.md §3.1`의 CASCADE 다이어그램이 `trigger`(및 `schedule`)를
누락한 것 — 인데, 이는 코드-스펙 모순이 아니라 스펙 문서 간(상류/하류 서술) 비대칭이고,
이 세션이 이미 자기-반증형 소정정 권한 밖으로 판단해 planner 트래커(item 5b)에 정확히
위임해 두었다. 추가로 `spec/5-system/15-chat-channel.md`의 404 근거 서술이 이번에
새로 도달 가능해진 레이스 케이스를 아직 반영하지 못한 INFO 수준 완결성 갭이 있다.
두 항목 모두 이 PR을 막을 이유가 아니다.

## 위험도

LOW
