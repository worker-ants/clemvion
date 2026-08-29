# 요구사항(Requirement) 리뷰 — ws-event-types-followups

## 대상
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
- `codebase/backend/src/modules/websocket/websocket-events.types.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `plan/in-progress/ws-event-types-extract.md`

## 변경 요약
plan `ws-event-types-extract.md` 의 두 잔여 후속 항목을 닫는 followup:
1. `NotificationEventType` → `InAppNotificationEventType` 개명 (`triggers/dto/notification-config.dto.ts` 의 동명 타입과 충돌 해소, 6곳).
2. `export default` 캐너리가 `export { X as default }` 별칭 형태를 못 잡던 갭을 `hasDefaultExport()` 헬퍼로 3형태 전수 소진 + `ts.getModifiers(st as ts.HasModifiers)` 캐스트를 `ts.canHaveModifiers()` 가드로 교체.

## 독립 검증 수행 내역
- `grep -rln "NotificationEventType\b" .` (repo 전수) — 개명 후 잔존 참조는 disambiguation JSDoc 1곳과 무관한 `triggers/dto/notification-config.dto.ts` 2곳뿐. 개명이 빠짐없이 반영됨을 확인.
- `npx jest websocket-events.types.spec.ts` — 6/6 PASS.
- 뮤테이션 재현 (repo 파일을 `cp` 로 scratch 에 백업 후 수정 → 테스트 → `cp` 로 원복, `git status --short` 로 클린 확인): types 모듈 끝에 `export { NodeEventType as default };` 추가 → 세 번째 테스트 RED (`hasDefault: true` vs 기대 `false`). plan 이 주장하는 "새 캐너리가 별칭 형태를 잡는다" 를 실측으로 확인. 원복 후 `git status --short` 무출력 확인 — 잔여물 없음.
- `spec/5-system/6-websocket-protocol.md` §4.4: `notification.new` payload shape `{ id, type, title, message, resourceType, resourceId }` — `NotificationNewPayload` 인터페이스·`emitNotificationEvent` 조립과 필드 단위로 일치. spec 은 enum/타입 이름(`NotificationEventType`/`InAppNotificationEventType`)을 전혀 인용하지 않음(`grep -rn NotificationEventType spec/` 0건) — 개명이 spec 변경을 요구하지 않는다는 plan 의 주장과 일치.
- `spec/5-system/14-external-interaction-api.md` EIA-NX-02 확인 — disambiguation JSDoc 이 "저쪽은 EIA §3.1 의 외부 계약(구독 화이트리스트)" 이라 적은 근거가 실제 spec 표 행과 일치.
- `git blame -L 89,89 spec/conventions/egress-masking.md` → `bdcfdc514` (`docs(conventions)`, #1194) — plan 이 "이 문장은 developer 가 쓴 게 아니라 planner 턴 산출" 이라 판단해 자기-반증형 소정정 조건 1 불충족으로 self-fix 하지 않고 planner 턴으로 넘긴 판단이 사실과 일치.
- `npx tsc --noEmit` 로 나온 3건의 타입 에러(`websocket.gateway.spec.ts`, `websocket.service.spec.ts`)는 이번 diff 가 건드리지 않은 파일이며 `git log` 상 최근 변경 이력도 이 PR 과 무관 — 이 변경이 유발한 회귀 아님(pre-existing).

## 발견사항

- **[INFO]** `plan/in-progress/ws-event-types-extract.md` 의 `plan/complete/` 이동 항목이 이번 PR 로도 여전히 미체크(`- [ ]`)로 남아 있음.
  - 위치: `plan/in-progress/ws-event-types-extract.md:294` (게이트 294, "**`plan/complete/` 이동 시 `spec_impact` 갱신**" 항목)
  - 상세: 원인은 `spec/conventions/egress-masking.md:89` 의 DEAD 링크 캐비엇이며, 그 문장은 developer 가 아니라 planner 턴(`bdcfdc514`)이 쓴 것이라 `CLAUDE.md` §자기-반증형 소정정의 조건 1(문장을 developer 자신이 썼을 것)을 충족하지 못해 developer 가 직접 고칠 수 없다는 판단 — git blame 으로 대조한 결과 이 판단은 정확하다. 코드 결함이 아니라 프로세스 상 다음 턴(planner)으로 정확히 위임된 상태이며, 이번 PR 이 처리할 수 있는 항목의 정확한 범위 밖이다.
  - 제안: 조치 불필요(이 리뷰 대상 코드와 무관). 후속 planner 턴에서 `egress-masking.md:89` 캐비엇을 걷거나 링크를 갱신하고 plan 을 `complete/` 로 이동하며 7개 파일의 `spec_impact` 를 기재해야 함 — plan 문서에 이미 정확한 목록이 준비돼 있음.

- **[INFO]** `hasDefaultExport()` / rename 변경 영역은 순수 내부 회귀 가드(테스트) + 명명 규약이라 이를 규정하는 제품 spec 본문이 없음(정상) — spec fidelity 점검은 "관련 spec 없음" 범주로, 결함 아님.

발견된 CRITICAL/WARNING 없음.

## 요약
`NotificationEventType` → `InAppNotificationEventType` 개명은 6개 참조 지점(enum 선언·JSDoc `{@link}`·`websocket.service.ts` import/re-export/사용·캐너리 `EXPECTED_EXPORTS`) 전부에 반영되었고, repo 전수 grep 으로 누락 참조가 없음을 확인했다. spec(`6-websocket-protocol.md` §4.4)은 타입/enum 이름을 인용하지 않아 개명이 spec 변경을 요구하지 않는다는 plan 의 판단도 실측과 일치한다. `hasDefaultExport()` 헬퍼는 `ExportAssignment`(`export default X`/`export = X`) · modifier 기반 default(`export default function/class`) · `NamedExports` 의 `as default` 별칭(re-export 포함) 세 AST 형태를 전수 소진하며, 독립 뮤테이션으로 별칭 형태를 실제로 RED 로 잡는 것을 확인했다 — JSDoc 이 주장하는 개선(종전엔 별칭 형태를 놓쳤다)이 사실이다. `ts.canHaveModifiers` 가드 교체도 타입 안전성을 실제로 개선한다(임의 노드로의 부당한 캐스트 제거). TODO/FIXME/HACK 류 미완성 표식 없음, 모든 경로에서 boolean 반환 보장, 엣지 케이스(두 파일 모두 순회, 세 AST 분기 소진)도 충분히 다뤄졌다. plan 문서의 상태 서술(개명 완료·캐너리 완료·plan-complete 이동 차단 사유)은 git blame·grep·jest 실행으로 전수 대조한 결과 모두 사실과 일치한다. 유일한 잔여 사항은 이 PR 범위 밖의 planner 턴 위임(egress-masking.md DEAD 링크)이며, 이는 코드 결함이 아니라 정확히 문서화된 프로세스 대기 상태다.

## 위험도
NONE
