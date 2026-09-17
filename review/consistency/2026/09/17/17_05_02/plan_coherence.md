# Plan 정합성 검토 — spec-draft-deletion-releases-trigger-resources

## 발견사항

- **[WARNING]** T2(모듈 순환)가 같은 트래커에 이미 있는 "역방향 의존 제거" 결정을 인용하지 않는다
  - target 위치: `## 트래커 반영 (같은 PR)` T2 행 — *"모듈 순환(`WorkflowsModule → TriggersModule → SchedulesModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule`)"*, 그리고 `## 이 draft 가 안 하는 것` — *"모듈 순환은 구현 설계 문제라 spec 에 적지 않는다"*
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "chat-channel 도메인 규칙이 제네릭 `TriggersService`(1855줄)에 계속 쌓인다" 항목 (약 2470~2500행) — *"`chat-channel/` 로 옮긴다"* 는 처방이 **순환을 되살린다**로 실측 반증됐고, `#676`(`e827ed2a7`)이 `chat-channel→triggers` 역방향 의존 2곳을 의도적으로 제거해 `forwardRef` 순환을 끊었으며 "되돌리면 그 작업이 무효가 된다"고 명시함
  - 상세: 코드 실측 결과 현재 `WorkflowsModule ↔ ExecutionEngineModule ↔ WebsocketModule` 은 이미 `forwardRef()` 3중 순환이고(`workflows.module.ts`·`execution-engine.module.ts`·`websocket.module.ts` 확인), `TriggersModule → SchedulesModule → ExecutionEngineModule` 은 현재 **단방향**이다. D6 구현이 `WorkflowsModule → TriggersModule` 간선을 새로 추가하면 `TriggersModule`·`SchedulesModule` 이 그 기존 3중 순환에 새로 편입되어 5-모듈 순환이 된다. 이 저장소는 바로 이 트래커 안에서 "역방향 의존을 걷어내 순환을 줄이는" 작업을 최근에 완료했고(`#676`, T1/T2 완료 처리), `workflows.module.ts` 자체에 "IntegrationsModule 을 import 하지 않아 모듈 순환이 없다"는 명시 주석까지 있어 이 저장소가 모듈 순환에 민감하다는 신호가 이미 문서화돼 있다. T2 항목은 이 선례를 인용하지 않은 채 "구현 설계 문제"로만 남겨, 다음 developer 가 손쉬운 `forwardRef()` 추가로 순환을 더 키울 위험이 있다(같은 트래커가 몇 시간/며칠 전에 "그 방향은 틀렸다"고 실측으로 뒤집은 바로 그 실수 패턴).
  - 제안: target 의 T2 행에 위 선례(`#676` / `plan/complete/impl-chat-channel-binder.md`, `impl-chat-channel-binder-t2.md`)를 교훈으로 한 줄 인용하거나, 최소한 "협력자를 어느 모듈에 둘지(예: 순수 정리 로직을 `triggers/` 밖의 공유 서비스로 뽑거나 이벤트 기반으로 디커플링)"를 T2 구현 시 우선 검토 항목으로 명시. spec 문서 자체를 고칠 필요는 없고 `spec-draft-nullable-notation-followups.md` 의 T2 신설 항목 서술을 보강하면 된다.

- **[INFO]** `deleteByPrefix()` 호출부 "한 곳" 실측이 이 draft 구현(T2) 이후 낡는다
  - target 위치: D4·D5·D6·S9·S10 — 네 삭제 경로 전부에서 `deleteByPrefix('secret://triggers/<id>/')` 호출을 신설
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` "`deleteByPrefix()` LIKE 메타문자 미이스케이프" 항목 — *"프로덕션 호출부는 `triggers.service.ts:875` 한 곳"*(실측)이라는 근거로 이스케이프 대신 입력 거부 가드를 택함
  - 상세: 그 결정 자체(포맷이 항상 `secret://triggers/<uuid>/`라 메타문자가 안 섞인다)는 T2 이후에도 그대로 유지된다(모든 신규 호출부도 트리거 UUID 기반 prefix). 다만 "호출부 한 곳"이라는 서술은 T2 구현 후 사실이 아니게 되므로, 그 항목을 다시 열 필요는 없지만 T2 구현 PR 이 호출부 전수를 다시 셀 때 이 문서의 낡은 문장도 함께 갱신하면 좋다(가드 자체의 처분 근거는 안 흔들림).
  - 제안: T2 구현 PR(developer 턴)의 체크리스트에 "새 `deleteByPrefix` 호출부도 UUID 기반 prefix 임을 재확인"을 한 줄 추가 권고. spec draft 자체를 막을 사유는 아님.

- **[INFO]** `secret-store.md`/`12-workspace.md` 는 `spec-link-integrity` 멀티라인 링크 사각지대로 이미 지목된 두 파일
  - target 위치: S7(`12-workspace.md` §1.10/§2.1)·S8~S10(`secret-store.md`/`1-data-model.md`) — 여러 개의 새 상호참조 링크(`[트리거 목록 §4.3](...)` 등) 추가
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` "미해결 항목" 첫 건 — `spec-link-integrity` 가 `[` 와 `](` 가 다른 줄에 걸친 링크의 앵커 검증을 조용히 건너뛰며, 실측된 6개 파일 중 정확히 `conventions/secret-store.md`·`data-flow/12-workspace.md` 가 포함됨
  - 상세: draft 문면상 새 링크는 모두 한 줄 문자열로 제시돼 있어 지금 형태로 반영하면 문제가 없어 보이지만, 실제 편집(줄바꿈·표 셀 개행) 과정에서 브래킷이 갈라지면 그 링크는 가드가 못 본 채로 깨진 앵커가 통과할 수 있다 — 정확히 이 두 파일이 이미 그 취약점의 실측 대상이었다.
  - 제안: S7·S9·S10 반영 시 새로 추가하는 마크다운 링크가 한 줄 안에 `[...]( ... )` 형태로 남는지 커밋 전에 육안 확인. spec 문서·plan 문서 어느 쪽도 수정할 필요는 없고 구현 시 유의사항 정도.

## 검증한 정합 지점 (문제 없음 — 참고용)

- T1(items 8·9 → D5 로 흡수)은 `spec-draft-nullable-notation-followups.md` 의 "trigger-config advisory lock 이 남긴 developer 범위 후속" 표 항목 8·9 를 정확히 가리키며, 항목 9 는 이미 "5라운드 W1(secret store 원자성)과 같은 자리"로 셀프 크로스링크돼 있어, 봉인된 `plan/complete/trigger-config-lost-update.md` 의 그 옛 항목까지 추적 가능한 체인이 끊기지 않는다.
- T3(없는 메서드 `TriggersService.delete()` 항목)의 "1·2 는 S8·S9 로 닫고 3(V063 마이그레이션 주석)은 무조치"는 그 항목의 기존 처분("Flyway 체크섬 때문에 고치면 안 된다")과 정확히 일치한다.
- `1-workflow-list.md`(이미 `partial` + 다른 `pending_plans` 2건)·`2-trigger-list.md`(이미 `pending_plans: spec-draft-nullable-notation-followups.md`)·`secret-store.md`(frontmatter 신설)에 대한 frontmatter 편집은 모두 기존 상태에 additive 하고 상태 전이 규칙과 어긋나지 않는다.
- `data-flow/10-triggers.md`·`11-workflow.md`·`12-workspace.md` 에 frontmatter 가 없다는 draft 의 전제, 그리고 S7 편집 위치(§1.10/§2.1)가 다른 in-progress plan 이 참조하는 Rationale 절(§"UUID 검증 강도 비대칭" 등)과 겹치지 않는다는 것을 확인했다.
- `WorkflowsService.remove()` 에 명시 트랜잭션·행 잠금이 없다는 D6 의 전제를 코드로 직접 확인했다(`findById` → `workflowRepository.remove` → `recordAudit`, 트랜잭션 래핑 없음).
- D2 의 "정리만 공유하고 행은 CASCADE 로" 결정은 `data-flow/1-audit.md`·`5-system/1-auth.md §4.1` 의 현재 audit 카탈로그(트리거 CASCADE 삭제에 대한 개별 `trigger.deleted` 감사를 요구하지 않음)와 충돌하지 않는다 — 이는 새 동작이 아니라 기존 동작(직접 호출 경로가 없는 cascade 삭제는 지금도 무감사)의 유지다.

## 요약

Plan 정합성 관점에서 이 draft 는 대체로 견고하다 — 1차 `--spec` BLOCK 의 두 Critical(문서 자기모순·미뤄 둔 원자성 항목 회피)을 각각 S8~S10 전수 편집과 D4~D6 인터리빙 논증으로 실제로 닫았고, 관련 트래커(`spec-draft-nullable-notation-followups.md`)의 봉인된 선행 plan(`trigger-config-lost-update.md`) 참조 체인도 끊어지지 않는다. frontmatter·pending_plans 편집도 기존 상태와 additive 하게 정합한다. 다만 T2 가 예고하는 모듈 순환은 같은 트래커가 최근에 "역방향 의존을 걷어내 순환을 줄인다"는 방향으로 이미 한 차례 뒤집은 결정과 같은 클래스의 문제인데 그 선례를 인용하지 않아, 구현 단계에서 같은 실수(순환을 늘리는 방향의 손쉬운 해법)를 반복할 위험이 WARNING 급으로 남는다. 나머지 두 INFO 는 사소한 후속 갱신 권고이며 병합을 막을 사유가 아니다.

## 위험도

LOW
