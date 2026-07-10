# 신규 식별자 충돌 검토 — `spec/conventions/execution-context.md`

## 검증 방법

프롬프트 페이로드 대신 실제 diff(`git diff main -- spec/conventions/execution-context.md`)를
직접 확인했다. target 이 main 대비 새로 추가하는 내용은 "원칙 5 — `variables.__*` 시스템 예약
네임스페이스" 섹션 하나뿐이며, 도입하는 표면 식별자는 다음 2개다.

- `__workspaceId`
- `__workspaceTimezone`

(그 외 원칙 1~4, `_callStack`, `_contextKey`, `ParallelBranchContext` 등은 이번 diff 범위 밖의
기존 내용 — 이전 커밋에서 이미 도입·검토됨.)

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음 (컨벤션 문서, ID 네임스페이스 무관).
2. **엔티티/타입명 충돌** — 신규 타입/인터페이스 없음. "원칙 5" 는 문서 내 원칙 1~4 에 이어지는
   순차 번호로 기존 번호와 겹치지 않는다.
3. **API endpoint 충돌** — 해당 없음.
4. **이벤트/메시지명 충돌** — 해당 없음.
5. **환경변수·설정키 충돌** — `__workspaceId`/`__workspaceTimezone` 는 **신규 도입이 아니라 기존
   식별자의 소급 문서화**다. `git grep` 로 전수 확인한 결과 두 키 모두 이미 다음 위치에서 **동일한
   의미**로 확립되어 있다:
   - `codebase/backend/src/nodes/core/node-handler.interface.ts:66,71` — `ExecutionContext.variables`
     JSDoc 이 `__workspaceId: string`(워크스페이스 식별자), `__workspaceTimezone?: string`
     (`Workspace.settings.timezone`, System Context Prefix timezone SoT) 로 이미 정의.
   - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1267,1270,4097,4100`
     등 — `createContext`/`rehydrateContext` 가 실행 시작 시 두 키를 주입하는 실제 구현.
   - `spec/5-system/4-execution-engine.md:678,725,1248` — `variables.__workspaceId` 를 이미 표·본문에서
     "실행 시작 시 주입, Integration 조회·AI LLM 설정 조회 등 워크스페이스 단위 리소스 해소" 로 기술
     — target 의 선례 설명과 문구까지 일치.
   - `spec/data-flow/3-execution.md:85` — `createContext` sequence note 에 `__workspaceId/__workspaceTimezone/__dryRun`
     세 키를 함께 명시.
   - `spec/4-nodes/4-integration/{0-common,3-send-email,4-cafe24,5-makeshop}.md`,
     `spec/4-nodes/2-flow/1-workflow.md`, `spec/5-system/13-replay-rerun.md` — 각 노드 spec 이
     `__workspaceId` 를 동일 의미(워크스페이스 컨텍스트 해소, 없으면 오류)로 참조.
   - 다수 backend `*.spec.ts` fixture(`ai-agent`, `text-classifier`, `information-extractor`,
     `system-context-prefix`, `execution-engine.service.spec.ts` 등)가 `variables: { __workspaceId, __workspaceTimezone }`
     로 동일 의미 재사용.

   즉 target 이 "선례" 로 인용한 두 식별자는 문서화 대상일 뿐 **네이밍이 새로 생기는 것이 아니며**,
   의미·주입 시점·소비처 설명이 기존 SoT(execution-engine.md §6.1 / node-handler.interface.ts)와
   불일치 없이 정합한다. 다른 의미로 이미 쓰이는 사례는 발견되지 않았다 — 충돌 없음.

6. **파일 경로 충돌** — target 은 기존 파일(`spec/conventions/execution-context.md`)의 섹션 추가이며
   신규 파일 생성이 없다. 파일 경로 충돌 해당 없음.

## 참고 (충돌 아님, 완결성 메모)

`node-handler.interface.ts:69` 에는 target 의 "선례" 목록에 없는 `__workspaceName?: string`
(`Workspace.name` 복제, System Context Prefix `workspace` 섹션 이름 표시용) 도 동일 `__`-prefix
계열로 이미 존재한다. 이는 target 이 다른 의미로 쓰는 것이 아니라 단순히 예시 목록에서 생략된
것으로, **식별자 충돌이 아니라 완결성(열거 누락)** 사안이라 본 리뷰(naming_collision)의 등급 대상은
아니다 — 필요 시 convention_compliance/cross_spec 리뷰 관점에서 다룰 사안으로 남긴다.

## 발견사항

없음.

## 요약

target 문서가 main 대비 실제로 추가하는 내용은 "원칙 5 — `variables.__*` 예약 네임스페이스" 섹션
하나이며, 여기서 인용하는 `__workspaceId`/`__workspaceTimezone` 은 신규 식별자가 아니라
`node-handler.interface.ts`·`execution-engine.service.ts`·`spec/5-system/4-execution-engine.md`
등에 이미 확립된 기존 식별자를 정확히 같은 의미로 소급 문서화한 것이다. `git grep` 전수 검색으로
다른 의미의 경쟁 사용처가 없음을 확인했고, 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV
key·spec 파일 경로 어느 것도 새로 생성되지 않는다. 신규 식별자 충돌 관점의 위험 요소는 발견되지
않았다.

## 위험도

NONE
