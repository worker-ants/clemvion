# 아키텍처 리뷰 — 동시 중복 DELETE 감사 후속 (dup-delete-audit, 20_43_03)

## 컨텍스트

이번 diff 는 origin/main 대비 누적분으로, (a) 원 결함 수정(`LockedParentTriggers` 도입 +
`WorkflowsService.remove()` 404 분기 + e2e), (b) 그 직전 리뷰 세션(`review/code/2026/09/20/20_06_26`)이
지적한 WARNING#1(워크스페이스 삭제 경로가 워크플로와 대칭적으로 닫히지 않아 403 오응답 + 거짓
ERROR 로그가 남을 수 있다)에 대한 **후속 조치 커밋**(`27f488d09`)까지 함께 포함한다. 코드 현재
상태(`Read` 로 직접 확인)를 기준으로 재평가한다.

## 발견사항

- **[INFO]** 이전 세션이 지적한 워크플로↔워크스페이스 삭제 경로 간 비대칭(WARNING, MEDIUM 위험도)은
  이번 diff 에 포함된 후속 커밋으로 **해소를 확인**했다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:530`(`if (locked.parentPresence === 'absent') throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND', ... })`), `:553`(`if (err instanceof NotFoundException) throw err;`) — 대칭 대상은 `codebase/backend/src/modules/workflows/workflows.service.ts:280`, `:293`.
  - 상세: 워크스페이스 삭제도 이제 `assertWorkspaceDeletable` 재검사(멤버십 → 존재 순서)에 판정을
    떠넘기지 않고, `locked.parentPresence === 'absent'` 를 그보다 먼저 검사해 404
    (`WORKSPACE_NOT_FOUND`)로 단락한다. `.catch` 도 `NotFoundException` 을 구분해 거짓 "수동 정리
    필요" 로그를 남기지 않는다. 워크플로 경로와 라인 단위로 동일한 형태(가드 위치·순서·주석 구조)를
    갖췄다 — 두 "쌍둥이" 메서드의 계약 일관성이 이제 실제로 대칭이다.
  - 이 자체는 발견사항이 아니라 이전 리뷰가 제기한 CRITICAL 급 아키텍처 우려(계약 불일치)가 실제로
    반영됐는지 재확인한 결과다. 조치 불요.

- **[INFO]** 동일한 "잠금 → 헬퍼 호출 → `absent` 검사 → `NotFoundException` → `.catch` 에서
  `instanceof` 로 구분해 로그 억제" 패턴이 이제 `WorkflowsService.remove()`·
  `WorkspacesService.deleteWorkspace()` 두 곳에 **완전히 동일한 모양으로 복제**돼 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-312`,
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-567`. `TriggersService.remove()`
    (`codebase/backend/src/modules/triggers/triggers.service.ts:1060-1107`)·`SchedulesService` 도 "잠금
    → 트랜잭션 → `.catch` 로그" 골격은 공유하지만 `absent` 분기는 아직 없다 — plan
    (`plan/in-progress/dup-delete-audit.md` §"`--impl-prep` 이 요구한 것" W2)이 인용하는
    `spec-draft-nullable-notation-followups.md` 의 "네 자리 공용 형태" 미착수 설계 항목이 정확히 이
    네 자리(트리거·스케줄·워크플로·워크스페이스)를 가리킨다.
  - 상세: 이 중복 자체는 새로 만든 게 아니라 기존 구조를 두 자리 모두에 맞춰 넓힌 것이고, 이미
    별도 트래커 항목으로 추적되며 이번 plan 이 교차 참조를 약속했다(다만 plan 체크리스트의 "트래커
    항목 해소"는 이 스냅샷에서 아직 `- [ ]`). 다만 아키텍처 관점에서 짚을 점은, **이 정확한 복제
    형태가 이번 PR 안에서 실제로 한 번 어긋났다가(워크스페이스 경로에 처음엔 `absent` 분기가
    빠짐) 리뷰로 잡혀 사후 패치됐다**는 사실이다 — 즉 "두 사이트가 나란히 유지된다"는 불변식은
    사람이 매 수정마다 손으로 지켜야 하는 상태이고, 이미 한 번 깨졌다. Template Method 나 공용
    가드 함수(`guardAgainstConcurrentDelete(locked, notFoundError)` 류)로 추출하면 이 클래스의
    결함이 세 번째·네 번째 사이트(스케줄·트리거)로 번지는 것을 원천적으로 막을 수 있다.
  - 제안: 조치 불요(이미 추적 중, 이번 PR 스코프 아님) — 다만 "네 자리 공용 형태" 설계가 착수될
    때, 이번 PR 이 이미 겪은 "복제가 대칭을 깨뜨렸다가 리뷰로 잡힌" 사례를 설계 근거로 명시해 두면
    다음 사람이 우선순위를 낮게 잡지 않을 것이다.

- **[INFO]** (설계 양호, 재확인) `LockedParentTriggers { parentPresence: 'present' | 'absent'; triggerIds: string[] }` 는
  "부재"와 "0개"를 이름 있는 값으로 분리한 정석적 판별 설계이며, 유일한 구현체·유일한 두 호출자·세
  spec 파일이 같은 커밋들 안에서 함께 갱신되어 있다(`grep` 으로 재확인, 놓친 호출부 없음). 이전
  리뷰의 WARNING(파라미터 `parent` 와 반환 필드 `parent` 이름 충돌)도 `parentPresence` 로 리네임되어
  전 호출부에 전파돼 있다 — 재확인 결과 잔여 `parent:` 필드 사용처 없음.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:117-129`(인터페이스),
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109`(구현).
  - 제안: 없음.

- **[INFO]** 포트/구현/`ModuleRef.get(..., { strict: false })` 지연 해석을 통한 순환 의존 회피(선례
  `#676`)는 이번 diff 로 훼손되지 않았다 — `resolveTriggerResourceReleaser` 호출부·시그니처 변경
  없음. 레이어 책임(도메인 서비스가 트랜잭션·잠금 순서를 알고, 포트가 영속성 세부(EntityManager·락
  모드)를 캡슐화하는 구조)도 그대로 유지된다.

## 요약

이전 세션(20_06_26)이 이 diff 계열에서 유일하게 지적한 아키텍처 CRITICAL 급 우려 — 워크플로와
워크스페이스 삭제 경로가 "부모 부재" 판정을 비대칭으로 처리해 진 쪽 요청이 403 + 거짓 ERROR 로그로
새는 문제 — 는 후속 커밋(`27f488d09`)으로 실제 코드에서 대칭 처리됨을 직접 `Read` 로 재확인했다.
`LockedParentTriggers` 판별 유니온·포트/구현 분리·`ModuleRef` 지연 해석 등 핵심 설계는 SOLID·의존성
역전 관점에서 견고하다. 남은 유일한 관찰은, 이번 PR 이 대칭을 맞추기 위해 "잠금 → absent 검사 →
NotFoundException → catch 구분" 패턴을 두 서비스에 글자 그대로 복제했고, 그 복제가 이번 PR 안에서
실제로 한 번 어긋났다가(워크스페이스 쪽 최초 누락) 리뷰로 잡힌 전례가 이제 막 생겼다는 점이다 —
이미 트래커로 추적되는 "네 자리 공용 형태" 설계의 우선순위를 뒷받침하는 실측 근거로 기록해 둘
가치가 있으나, 이번 PR 자체를 막을 사유는 아니다. 그 외 레이어 책임·모듈 경계·순환 의존 문제는
없다.

## 위험도

LOW
