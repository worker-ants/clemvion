# 의존성(Dependency) 리뷰 — trigger-config-lost-update (5차 라운드, 20_49_15)

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수를 확인했다. `package.json`/`pnpm-lock.yaml` 등
매니페스트·락파일 변경은 이번 라운드도 **0건**이다 (`git diff origin/main...HEAD --stat -- '*.json' 'pnpm-lock.yaml'` 은
`review/**` 산출물 JSON 만 나열한다).

코드 변경 파일:

- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts` (수정 — `touchLastTriggeredAt` 추출)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (수정 — `extractInboundSigningRef`, `rewriteTriggerConfigLocked` 배선)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` / `.spec.ts` (수정 — `extractInboundSigningRef` 신설)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` / `.spec.ts` (기존 라운드에 이미 신설·검토됨, 이번엔 삭제 락 추가)
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts` (수정)
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` (수정 — 공용 mock 배선)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규, 테스트 전용 유틸)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` / `.spec.ts` / fixture (수정 — 정적 가드 확장)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (기존 라운드에 이미 신설·검토됨)
- `CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`, `review/**` (문서·산출물, 의존성 무관)

이 세트는 4차 라운드(`review/code/2026/09/14/18_17_44`, `19_07_43`, `19_44_08`, `20_17_16`)가 이미
"신규 외부 의존성 없음 / package.json·lockfile 변경 0건" 으로 위험도 NONE 판정한 것과 **같은 몸통**의
연속 수정이다. 이번 라운드에서 실제로 새로 추가된 것은 (a) 인입 hot path 의 `save`→컬럼 한정
`update` 리팩터(`touchLastTriggeredAt`), (b) `extractInboundSigningRef` 헬퍼 추출, (c) 삭제 경로도 같은
advisory lock 을 잡도록 한 확장, (d) 그 전체를 검증하는 테스트 유틸/가드 확장이다. 아래 발견사항은
이번 라운드에 새로 등장한 표면만 확인한 결과다.

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전량 기존 의존성·내부 모듈 재사용
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` 신설), `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`import { ... extractInboundSigningRef } from './chat-channel-input-rules'`), `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`extractInboundSigningRef` 함수), `codebase/backend/src/modules/triggers/triggers.service.ts` (`import { acquireTriggerConfigLock, rewriteTriggerConfigLocked } from './trigger-config-lock'` 및 `extractInboundSigningRef`)
  - 상세: 이번 라운드에서 새로 추가된 import 는 전부 프로젝트 내부 모듈(`./trigger-config-lock`, `./chat-channel-input-rules`)이다. 신규 테스트 유틸 `trigger-transaction-mock.ts` 는 `jest`(devDependency, 이미 선언됨) 외에 어떤 것도 import 하지 않는다 — 순수 in-repo 헬퍼다. 신규 유닛 테스트(`chat-channel-input-rules.spec.ts` 의 `extractInboundSigningRef` describe 블록)도 대상 함수 자체를 import 할 뿐 외부 패키지 추가가 없다. 버전 고정·라이선스·취약점·번들 크기·호환성 항목은 모두 **해당 없음**(새 외부 의존성이 없으므로).
  - 제안: 없음.

- **[INFO]** 정적 가드(`repo-guards`) 확장도 기존 devDependency(`typescript`)만 사용
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:35` (`TRIGGER_ENTITY` 상수), `:108-121` (`isWrappedByConflictCatch` 콜백 경계 확장), `:156-171` (`findTriggerRepositorySaves` 의 `EntityManager.save(Trigger, …)` 형태 인식)
  - 상세: `manager.transaction(async (m) => …)` 콜백 안에서 일어나는 `EntityManager.save(Trigger, …)` 를 인식하도록 TypeScript Compiler API(`ts.isFunctionLike`, `ts.isCallExpression`) 사용을 확장했다. `import * as ts from 'typescript'` 는 이 파일에 이미 있던 기존 import 이고(`package.json` 의 `"typescript": "^5.7.3"` devDependency, 변경 없음), 이번 diff 는 그 API 위에서 로직만 추가했다 — 신규 의존성이나 새 서브패스 import 는 없다.
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 그래프 — 이번 라운드도 단방향, 순환 없음
  - 위치: `chat-channel-input-rules.ts` (`extractInboundSigningRef` export) ← `chat-channel-binder.service.ts`, `triggers.service.ts` 가 import. `trigger-config-lock.ts` (`rewriteTriggerConfigLocked`, `acquireTriggerConfigLock` export) ← 위 두 서비스가 import.
  - 상세: `chat-channel-input-rules.ts` 와 `trigger-config-lock.ts` 는 이미 이전 라운드에서 신설·검토된 리프 모듈이고, 이번 라운드는 그 리프에 함수를 하나 더 추가(`extractInboundSigningRef`)했을 뿐 상위→하위 방향(서비스 → 규칙/락 유틸 → 엔티티)은 그대로다. `hooks.service.ts` 의 `touchLastTriggeredAt` 은 같은 클래스의 `private` 메서드로, 모듈 경계를 넘는 새 의존이 아니다. 역방향 참조나 새 순환 경로는 관측되지 않는다.
  - 제안: 없음.

- **[INFO]** `trigger-transaction-mock.ts` 는 6개 스펙 파일 중 2개(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`)에만 배선됨 — 의존성 관점 위험은 아니나 추적 필요
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` JSDoc(파일 상단), `triggers.web-chat.spec.ts:9,82-85`
  - 상세: 파일 자체 JSDoc 이 명시하듯, `TriggersService` 의 트랜잭션 경로(`update`/`rotateBotToken`/`remove`)를 호출하지 않는 나머지 4개 스펙 파일(`auth-configs`·`external-interaction`·`hooks`·`schedules` 도메인의 Trigger repo mock)은 지금은 안전하지만, 그 도메인이 향후 같은 트랜잭션 경로를 타게 되면 `Cannot read properties of undefined (reading 'transaction')` 로 깨진다. 이는 외부 패키지 의존성이 아니라 **내부 테스트 인프라의 부분 이관**이며, dependency 관점의 조치 항목이 아니라 이미 plan/JSDoc 에 남겨진 후속 사항이다. 참고로만 기록한다.
  - 제안: 없음(이미 문서화됨, 이번 PR 범위 밖).

- **[INFO]** (스코프 외 관측) 리뷰 대상과 무관한 워킹트리 dirty 변경 발견 — 커밋에는 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (커밋되지 않은 로컬 수정)
  - 상세: 의존성 diff 확인 중 `git status --short` 로 `M codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (untracked 변경, 미스테이지)를 관측했다. 내용은 `if (wrote) { this.channelListenerRegistry.register(...); }` 가드를 무조건 실행 + `void wrote;` 로 되돌리는 형태 — `review/code/2026/09/14/20_17_16` side_effect INFO#4 에서 추가된 가드를 제거하는 뮤테이션으로 보인다(아마 병렬로 도는 다른 reviewer 의 진행 중인 mutation 검증 잔여물). 이 변경은 `git diff origin/main...HEAD`(커밋 기준) 에는 포함되지 않으므로 이번 리포트의 발견사항 채점 대상은 아니며, 본 리뷰어는 저장소 파일을 건드리지 않았다(원복 시도 없음 — `git checkout`/`restore` 는 계약상 금지이고, 이 변경은 본 리뷰어가 만든 것이 아니다). 통합 SUMMARY/orchestrator 가 push 전 `git status --short` 로 이 dirty 상태가 해소됐는지 확인할 필요가 있다.
  - 제안: push/커밋 전 이 파일의 워킹트리 상태를 재확인. 의도된 것이 아니라면 다른 reviewer 세션에 정리를 요청.

## 요약

이번 라운드(3개 신규 커밋: `567c82edb`~`889c93cd9`)도 `package.json`/lockfile 변경이 0건이며, 새로 등장하는
import 는 전부 프로젝트에 이미 선언된 의존성(`typescript`, `jest` — devDependency)이거나 이번 작업에서
신설된 내부 모듈(`trigger-config-lock.ts`, `chat-channel-input-rules.ts` 의 `extractInboundSigningRef`,
신규 테스트 유틸 `trigger-transaction-mock.ts`)이다. 내부 모듈 의존 방향은 여전히 단방향(서비스 →
규칙/락 유틸 → 엔티티)이라 순환 참조 위험이 없다. 4차 연속 라운드(`18_17_44`→`19_07_43`→`19_44_08`→
`20_17_16`)와 마찬가지로 의존성 관점에서 조치가 필요한 항목은 없다. 다만 리뷰 도중 리뷰 대상과
무관한 워킹트리 dirty 변경(`chat-channel-binder.service.ts` 의 미커밋 수정, 아마 병렬 reviewer 의
mutation 잔여물)을 관측했으므로 push 전 정리 여부 확인이 필요하다.

## 위험도

NONE
