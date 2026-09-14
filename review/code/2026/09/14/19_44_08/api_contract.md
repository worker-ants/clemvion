# API 계약(API Contract) 리뷰

## 검토 범위

이번 라운드(19_44_08)는 직전 라운드(`19_07_43`)가 지적한 두 결함(W1 웹훅 hot path fail-open
재발, W2 "창 1" 재읽기의 저장 대상 누락)을 닫은 후속 커밋(`c7a9c107e`)을 포함한다. 실제
런타임 코드 변경은 다음 세 파일에 국한된다.

- `codebase/backend/src/modules/hooks/hooks.service.ts` — `save(trigger)` → `triggerRepository.update({id}, {lastTriggeredAt})` 컬럼 한정 갱신 (2곳)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의 저장 대상을 `trigger`(pre-lock 스냅샷)에서 `fresh ?? trigger`(락 안 재읽은 행)로 교체 + 그 재읽기에 `relations: ['workflow']` 추가
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` — 정적 가드가 `manager.transaction` 콜백 경계를 넘어 `.catch` 래핑을 인식하도록 확장 (런타임 아님, 빌드타임 정적 분석 유틸)

나머지 변경 파일(`trigger-transaction-mock.ts`, `*.spec.ts`, `endpoint-path-conflict-wrap.spec.ts`,
`endpoint-path-save.fixture.ts`, e2e spec, `CHANGELOG.md`, `plan/**`, `review/**`)은 테스트·문서·
리뷰 산출물이며 API 표면과 무관하다. **컨트롤러·DTO·라우트 정의·validation pipe·pagination
로직은 이번에도 일절 건드리지 않았다** — `git diff origin/main...HEAD --stat -- '**/*.controller.ts' '**/*.dto.ts'` 결과 0건.

## 발견사항

각 관점을 실제 diff와 해당 파일 전체 컨텍스트(`Read`)로 직접 대조했다. CRITICAL/WARNING 급
위반은 없다.

- **[INFO]** 웹훅 hot path(`hooks.service.ts`) 변경은 응답 스키마에 영향 없음 — 확인 완료
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:226-236`(성공 경로), `:695-704`(interaction 경로)
  - 상세: `save(trigger)` → `update({id}, {lastTriggeredAt})` 로 바뀐 두 자리 모두 `handleWebhook`/interaction 처리 흐름의 `return { executionId, ... }` / `{ executionId, status: 'pending' }` 문 **이전**에 위치하고, 두 return 문 어디에도 `lastTriggeredAt`·`config`·트리거 엔티티 자체를 실지 않는다(`grep -n "return {"` 로 전수 확인). 즉 이 변경은 순수 영속성 계층 수정이고 웹훅 응답 바디·상태 코드에 관측 가능한 차이가 없다.
  - 제안: 없음.

- **[INFO]** `PATCH /api/triggers/:id` 저장 대상 교체(`fresh ?? trigger`)가 응답의 `workflow` 필드 누락을 유발하지 않도록 이미 자체 방어됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:557-560`(`relations: ['workflow']` 추가), `:582`(`const target = fresh ?? trigger`)
  - 상세: 락 안 재읽기가 저장 대상이 되므로, 그 `findOne` 이 `workflow` relation 을 안 실었다면 `chatChannel` 을 싣지 않은 PATCH 응답에서만 `workflow` 가 사라지는 회귀가 됐을 것이다(기존 `findById()`는 항상 `relations: ['workflow']`를 실었다). 이번 diff가 같은 relation을 명시적으로 함께 추가해 그 회귀를 막았음을 확인했다. `fresh` 가 `null`인 폴백 경로(`?? trigger`)도 기존 `trigger`가 이미 `findById()`로 `workflow`를 실은 객체라 대칭이 유지된다.
  - 제안: 없음 — 이미 처리됨.

- **[INFO]** 409 충돌 응답 경로 유지 확인
  - 위치: `triggers.service.ts:586` (`.catch((err) => this.rethrowEndpointPathConflict(err))`), `:1387-1402` (`ConflictException({ code: 'RESOURCE_CONFLICT', ... })`)
  - 상세: 저장 위치가 `save(trigger)` 단독 호출에서 `manager.transaction(...)` 콜백 안의 `m.save(Trigger, target)` 로 이동했지만, `.catch` 는 여전히 트랜잭션 프라미스 전체를 감싸는 바깥 체인에 그대로 남아 있다. 이를 검증하는 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)가 콜백 경계를 넘어 래핑을 추적하도록 이번 diff에서 확장됐고, 대응하는 fixture(`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`)와 스펙 단언이 함께 추가돼 "저장이 트랜잭션 콜백 안으로 들어가도 409 변환이 깨지지 않는다"는 불변식이 회귀 캐너리로 고정됐다. `endpointPath` UNIQUE 충돌 시 HTTP 상태 코드(409)·에러 바디 형식(`code: 'RESOURCE_CONFLICT'`)에 변화가 없다.
  - 제안: 없음.

- **[INFO]** (재확인, 신규 아님) `rewriteTriggerConfigLocked` 의 락 안 재읽기는 `workspaceId` 로 스코프되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:108` (`m.findOne(Trigger, { where: { id: triggerId } })`)
  - 상세: 이번 라운드에서 변경되지 않은 부분이며 `review/code/2026/09/14/19_07_43/api_contract.md` INFO 항목과 동일하다 — 세 호출부(`chat-channel-binder.service.ts` 성공/실패 경로, `rotateBotToken`) 모두 이 함수를 부르기 **전에** `findById(id, workspaceId)`로 소유권을 이미 확정했으므로 신규 인가 우회는 아니다. 새로 조치할 것 없음, 이전 지적 유지.
  - 제안: 없음 — 조치 불요(기존 지적 유지).

## 요약

이번 라운드의 실질 변경은 두 곳이다 — (1) 웹훅 인입 hot path의 `lastTriggeredAt` 갱신을 `save()`에서 컬럼 한정 `update()`로 바꿔 인입마다 발생하던 `chatChannel.inboundSigningRef` fail-open 재발을 막았고, (2) `PATCH /api/triggers/:id`의 창 1 재읽기가 저장 "대상"까지 커밋된 최신 행으로 바꾸면서 그로 인해 생길 뻔한 `workflow` 필드 누락 회귀를 같은 diff 안에서 `relations` 명시로 막았다. 두 변경 모두 컨트롤러·DTO·라우트·validation pipe·pagination에 손대지 않았고, 웹훅/트리거 엔드포인트의 응답 스키마·HTTP 상태 코드·에러 봉투 형식에 관측 가능한 차이가 없다. 409 충돌 변환 경로는 저장이 트랜잭션 콜백 안으로 이동한 뒤에도 정적 가드+회귀 fixture로 다시 고정됐다. 유일한 지속 관찰 사항(`rewriteTriggerConfigLocked` 재읽기의 workspaceId 미스코프)은 이전 라운드에서 이미 INFO로 기록됐고 이번 diff로 변경되지 않았으며, 호출부의 사전 소유권 검증으로 실질적 위험이 없다. API 계약 관점에서 차단할 사항은 없다.

## 위험도

NONE
