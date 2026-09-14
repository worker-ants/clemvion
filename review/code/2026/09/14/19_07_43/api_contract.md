# API 계약(API Contract) 리뷰

## 검토 범위

이번 라운드(19_07_43)는 이전 라운드(18_17_44)의 리뷰가 CRITICAL#1 로 지적한 "창 1"
(`TriggersService.update()` 의 `save(trigger)`) 도 advisory lock 안으로 옮긴 후속 수정
(`567c82edb`, `12ed21ff1`)을 포함한다. 실제 코드 변경은 여전히
`chat-channel-binder.service.ts` · `trigger-config-lock.ts`(신규) · `triggers.service.ts`
세 파일에 국한되며, **컨트롤러·DTO·라우트 정의·validation pipe 는 이번에도 일절 건드리지
않았다** (`git diff origin/main...HEAD --stat -- codebase/backend/src/modules/triggers`
로 확인, controller/dto 파일 0건). 나머지 변경 파일(테스트·가드·e2e·plan·review 산출물)은
API 표면과 무관하다.

## 발견사항

각 관점을 실제 diff(`git diff origin/main...HEAD`)와 `triggers.service.ts` 전체 컨텍스트로
직접 대조했다. CRITICAL/WARNING 급 위반은 없다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 락 안 재읽기가 `workspaceId` 로 스코프되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `m.findOne(Trigger, { where: { id: triggerId } })`
  - 상세: 이 헬퍼는 `id` 단일 조건으로만 재읽는다. 반면 이번 라운드에서 새로 락 안에 들어간 "창 1"(`triggers.service.ts` `update()`)의 자체 재읽기는 `where: { id: trigger.id, workspaceId }` 로 워크스페이스를 함께 검증한다 — 같은 PR 안에 두 가지 스코핑이 공존한다. 다만 `rewriteTriggerConfigLocked` 를 부르는 두 지점(`chat-channel-binder.service.ts`, `rotateBotToken`) 모두 이 함수를 호출하기 **전에** 이미 워크스페이스-스코프 조회(`findById(id, workspaceId)`)로 소유권을 확정한 뒤이므로, 이 재읽기가 다른 워크스페이스의 행을 노출하는 새로운 인가 우회는 아니다(이 패턴은 이번 diff 이전의 `triggerRepository.update({ id: trigger.id }, ...)` 도 동일하게 `workspaceId` 를 안 걸었다 — 회귀가 아니라 기존 관행의 연장). 다만 두 재읽기 구현이 스코핑 기준을 다르게 가져가는 것은 다음 사람이 헬퍼를 다른 엔티티/자리에 재사용할 때 "workspaceId 를 걸어야 하는가"를 실수하기 쉬운 자리다.
  - 제안: 차단 사유는 아니다. `trigger-config-lock.ts` JSDoc에 "호출부가 triggerId 소유권을 사전에 검증했다고 가정한다(워크스페이스 필터 없음)"는 전제를 한 줄 명시하면, 다음 재사용자가 재확인 없이 그대로 가져다 쓰다 인가 경계를 놓치는 것을 막을 수 있다.

- **[INFO]** PATCH 응답이 "요청자의 스냅샷" 대신 "커밋 시점의 최신 상태"를 반영하도록 바뀐다 — 계약 위반은 아니고 오히려 개선
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` — `baseConfig = this.stripInlineAuthKeys(config ?? fresh?.config ?? trigger.config ?? {})`
  - 상세: 종전엔 `PATCH /api/triggers/:id` 가 요청 시작 시점의 `trigger.config` 스냅샷 위에서만 병합했다. 이제는 (클라이언트가 `config` 를 명시적으로 통째로 보내지 않는 한) 락 안에서 재읽은 **커밋된 최신 행** 위에서 병합하므로, 동시에 커밋된 다른 요청의 변경분이 응답 바디에 함께 반영될 수 있다. 이는 REST PATCH 의 "응답은 현재 리소스 표현을 반환한다"는 일반 기대와 부합하며, 클라이언트가 `config` 를 명시적으로 전체 교체하는 경우는 그 값이 그대로 우선(재읽기 무시)돼 명시적 의도를 존중한다 — 응답 스키마 자체는 변하지 않는다.
  - 제안: 조치 불요. 문서화 관점에서 이미 `CHANGELOG.md`(Unreleased, Behavior change)가 이 변화를 명시하고 있어 충분하다.

- **[INFO]** 에러 전파 경로 변경 없음
  - 위치: `triggers.service.ts` `update()` — `.catch((err: unknown) => this.rethrowEndpointPathConflict(err))` 는 `manager.transaction()` 체인 바깥에 그대로 유지된다(`endpoint-path-conflict-wrap-guard.ts` 가 이 형태를 새로 인식하도록 확장돼 래칫도 유지됨, `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 참고). `endpointPath` UNIQUE 충돌 시 기존과 동일하게 변환돼 던져지므로 HTTP 상태 코드/에러 바디 형식에 변화가 없다.
  - 제안: 조치 불요.

## 요약

이번 라운드가 추가한 "창 1" 수정을 포함해 전체 변경은 서비스/영속성 계층의 동시성(lost-update) 버그 수정이며, 컨트롤러·DTO·라우트·validation pipe·에러 변환·페이지네이션 어디에도 손대지 않았다. `PATCH`/`POST`/`rotateBotToken` 세 엔드포인트의 응답 스키마는 동일하고, 응답 값이 이제 "커밋된 최신 상태"를 반영하도록 바뀐 것은 REST 의미상 개선이며 CHANGELOG 에 Behavior change 로 문서화돼 있다. 유일하게 짚을 만한 점은 새 헬퍼 `rewriteTriggerConfigLocked` 의 재읽기가 `workspaceId` 스코프 없이 `id` 단일 조건이라는 것인데, 호출부가 이미 워크스페이스 소유권을 사전 검증한 뒤라 실질적 인가 우회는 없고 기존 코드의 관행과도 일치한다 — 다음 재사용자를 위한 문서화 제안 수준(INFO)이다. API 계약 관점에서 차단할 사항은 없다.

## 위험도

NONE
