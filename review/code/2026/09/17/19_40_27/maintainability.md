# 유지보수성(Maintainability) 코드 리뷰 (3라운드 — `d2184dcf2` 처분 확인)

검증을 위해 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash` 대조만 수행). 뮤테이션 없음.

## 사전 확인 — 직전 두 라운드 WARNING 처분 검증

이번 diff(`origin/main...HEAD`)는 1라운드(`review/code/2026/09/17/18_45_09/maintainability.md`)와
2라운드(`review/code/2026/09/17/19_14_29/maintainability.md`)가 이미 검토한 코드에 3라운드 처분 커밋
(`d2184dcf2` — 부모 삭제 트랜잭션 잠금에 5초 상한 추가)만 더한 것이다. 실제 소스를 직접 열어 대조한 결과:

- 1라운드 WARNING 3건(지연 해석 헬퍼 중복 · binder 보상 블록 중복 · `triggerSecretPrefix` URI 하드코딩)은
  여전히 해소된 상태로 남아 있다 — `trigger-resource-release.ts:136-142`의
  `resolveTriggerResourceReleaser`, `chat-channel-binder.service.ts:249-258`의 로컬 `undoWrite`,
  `secret-ref.ts:44-49`의 `buildSecretRefPrefix` 모두 재확인.
- 2라운드 INFO 4건(회귀 테스트 provider 배열 복제 · `setupChatChannel` 클로저 3개로 소폭 증가 ·
  `trigger-resource-release(r).service).ts` 파일명 한 글자 차이 · `lockParentAndListTriggerIds`
  if/else 반복)은 이번 라운드에서 코드 변경이 없어 그대로다(재확인만, 재지적하지 않음).

## 이번 라운드 신규 변경(`d2184dcf2`) 검토

변경 파일: `trigger-config-lock.ts`(`setLocalLockTimeout` 추출) · `trigger-resource-release.ts`(JSDoc
추가) · `trigger-resource-releaser.service.ts`(`lockParentAndListTriggerIds` 첫 줄에 상한 호출 추가) ·
`workspaces.service.ts`(열거를 재검사 앞으로 재배치) · 관련 스펙 2건.

- **`setLocalLockTimeout` 추출**은 `acquireTriggerConfigLock`이 인라인으로 갖고 있던 `SET LOCAL
  lock_timeout` SQL 조립을 재사용 가능한 이름 있는 함수로 뽑은 것으로, 중복을 줄이는 방향의 리팩터다.
  `toLockTimeoutMs`의 에러 메시지를 `acquireTriggerConfigLock:` → `setLocalLockTimeout:`으로 정정한
  것도 실제 유일한 호출부가 바뀌었으므로 정확하다(`acquireTriggerConfigLock`은 이제 `setLocalLockTimeout`을
  경유해서만 `toLockTimeoutMs`에 닿는다 — `trigger-config-lock.ts:102` 확인).
- **매직 넘버 없음**: 새 상수·리터럴 없이 기존 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(이름 있는 상수)를
  재사용한다.
- **일관성**: `lockParentAndListTriggerIds`에 상한을 거는 방식이 `TriggersService.remove()`/
  `SchedulesService.remove()`가 이미 쓰던 것과 동일한 함수·같은 상수를 지나가, "같은 클래스의 문제는
  같은 프리미티브로 막는다"는 이 파일의 기존 설계 원칙과 일치한다.

- **[INFO]** `lockParentAndListTriggerIds`의 "트랜잭션의 첫 호출이어야 한다" 계약이 타입으로 강제되지 않고 JSDoc + 테스트로만 강제된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts` (`TriggerResourceReleasePort.lockParentAndListTriggerIds` JSDoc, "**트랜잭션의 첫 호출이어야 한다**" 문장), 호출부 `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`deleteWorkspace()` 트랜잭션 콜백 첫 줄), `codebase/backend/src/modules/workflows/workflows.service.ts`(`remove()` 트랜잭션 콜백 첫 줄)
  - 상세: 이번 라운드가 새로 만든 불변식("이 메서드를 트랜잭션의 첫 DB 호출로 불러야 뒤따르는 모든 잠금에 상한이 걸린다")은 시그니처만 보고는 강제할 방법이 없다 — 호출자가 그 앞에 다른 `manager.query`/`repo.find`를 끼워 넣어도 컴파일은 통과한다. 지금은 두 호출부(`workflows.service.ts`, `workspaces.service.ts`) 모두 실제로 첫 줄에 두고 있고, 두 스펙 모두 이벤트 배열로 순서를 단언해(`workflows.service.spec.ts:1004-1006`, `workspaces.service.spec.ts:657-663`) 회귀를 잡을 수 있게 돼 있어 현재는 안전하다. 다만 이 PR 자체가 "안무 순서가 관례로만 강제돼 재배치 실수가 실제로 있었다"는 사례(2라운드에서 워크스페이스 쪽 순서를 재배치)를 남긴 만큼, 세 번째 호출부가 생기면 같은 실수가 재발할 여지가 구조적으로 남는다.
  - 제안: 즉시 조치 불요 — 테스트 커버리지가 현재 두 호출부를 잡고 있다. 호출부가 늘어나면(이미 트래커 항목 1이 "세 번째 호출부가 생기면 `deleteParentWithCleanup` 류 템플릿 메서드로 승격"을 조건으로 걸어 두었다 — `RESOLUTION.md` W5) 그 승격이 이 계약도 함께 흡수하게 하는 것을 권한다.

## 재확인 — 이미 트래커에 등재된 4자리 중복(재지적 아님)

`TriggersService.remove()`(`triggers.service.ts`) · `SchedulesService.remove()`(`schedules.service.ts`) ·
`WorkflowsService.remove()` · `WorkspacesService.deleteWorkspace()` 네 곳 모두 "잠금 → 삭제 → 실패 로그 →
재던짐" 안무를 손으로 반복한다는 점을 소스로 재확인했다. 이는 2라운드 architecture 리뷰가 WARNING으로
지적했고 `RESOLUTION.md`(W5)가 "트래커 항목 1의 추출 조건(호출부 3개 이상) 충족 — 항목을 갱신한다"로
이미 처분(등재)했다 — 새 발견이 아니므로 이번 라운드에서 재지적하지 않는다.

## 요약

3라운드 변경분(`d2184dcf2`)은 범위가 좁고(부모 삭제 트랜잭션 잠금에 5초 상한 추가) 기존 프리미티브
(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`, 새로 추출한 `setLocalLockTimeout`)를 재사용해 매직 넘버·중복 없이
깔끔하게 구현됐다. 1·2라운드가 지적한 유지보수성 WARNING은 모두 소스 대조로 재확인 시 여전히 해소된
상태다. 유일한 관찰은 이번 변경이 도입한 "트랜잭션의 첫 호출이어야 한다"는 순서 불변식이 타입이 아니라
관례 + 테스트로만 강제된다는 점(INFO)이며, 현재 두 호출부 모두 테스트가 순서를 단언하고 있어 즉시 위험은
없다. 차단 사유 없음.

## 위험도

NONE
