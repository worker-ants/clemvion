# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `save()` 반환값이 `updatedAt` 을 못 주는 경우 응답의 `updatedAt` 이 재읽기 시점 값으로 남는다 (이전 라운드에서 이미 식별·수용됨 — 이번 라운드도 동작 변경 없음)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TriggersService.update()`, `const written = await m.save(Trigger, { id: target.id, ...patch });` 다음 `if (written.updatedAt) target.updatedAt = written.updatedAt;`
  - 상세: 이번 라운드(최신 커밋 `d60cc65aa`)는 `trigger-transaction-mock.ts` 의 JSDoc 주석만 고쳤을 뿐 `triggers.service.ts` 자체는 이전 라운드(`review/code/2026/09/17/14_11_48`)에서 근거 주석이 보강된 그대로다. `TriggerDto.updatedAt` 은 공개 응답 필드이고, `written.updatedAt` 이 falsy 인 실제 경로는 e2e(`trigger-update-save-window.e2e-spec.ts` ②c, `written.updatedAt` 을 `toBeInstanceOf(Date)` 로 단언)로 "정상 경로는 항상 채워짐"만 확인됐을 뿐, 폴백 분기가 실제로 열렸을 때의 응답을 단언하는 테스트는 여전히 없다. 그 분기가 열리면 에러 없이 성공 응답에 PATCH 이전 타임스탬프가 실린다 — 클라이언트가 감지할 방법이 없는 조용한 stale 값이다. 차단 사유는 아니다.
  - 제안: 이미 트래커에서 조치 불요로 처분됨. 여유가 있을 때 `written.updatedAt` 부재 경로를 명시적으로 단언하는 회귀 테스트 또는 invariant 화를 고려.

- **[INFO]** 재읽기 뒤 `workflow` FK CASCADE 삭제 경합의 SQLSTATE 가 23503→23502 로 바뀌었지만, 클라이언트에 보이는 에러 응답은 여전히 동일한 일반 500 이다 (기존 갭, 이번 PR 로 도입되거나 변경된 사항 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `.catch((err: unknown) => this.rethrowEndpointPathConflict(err))` (`update()` 트랜잭션 블록 직후), `codebase/backend/src/common/filters/http-exception.filter.ts` (`isPostgresUniqueViolation` 만 23505 를 409 로 분기, 23502/23503 은 미분기)
  - 상세: 부분 객체 `save` 전환으로 이 경합의 실패 SQLSTATE 가 FK violation(23503, 통째 엔티티)에서 NOT NULL violation(23502, 부분 객체)로 바뀐다(`trigger-update-save-window.e2e-spec.ts` describe `① 재읽기 뒤 workflow 삭제`). 그런데 `rethrowEndpointPathConflict` 는 `endpoint_path` unique violation(23505)만 특별 처리하고 그 외는 그대로 다시 던지며, `GlobalExceptionFilter` 도 23505 만 409 로 분기하므로 23502 든 23503 이든 동일하게 일반 500 `INTERNAL_ERROR` 로 마스킹된다 — 즉 이 PR 은 클라이언트가 관측하는 에러 응답 계약을 바꾸지 않는다. "부모 워크플로가 삭제된 트리거를 PATCH 하려 했다"는 상황이 404/409 로 문서화될 법한데 불투명한 500 으로 남는 것은 기존 갭이며, `plan/in-progress/trigger-save-partial-patch.md` "이 PR 이 안 하는 것" 절에 planner 후속(`spec/7-integrations/15-chat-channel.md §5.4` 404 사유 갱신 등)으로 이미 명시적으로 이관돼 있다.
  - 제안: 조치 불요(이미 트래커에 planner 후속으로 등재됨).

## 검증한 것

- `codebase/backend/src/modules/triggers/triggers.controller.ts`, `codebase/backend/src/modules/triggers/dto/**` 를 `origin/main` 대비 확인 — 이번 diff(46 파일)에 **포함되어 있지 않다**. 엔드포인트 경로·HTTP 메서드·요청 DTO(`UpdateTriggerDto`)·응답 DTO(`TriggerDto`) 스키마·`@Roles('editor')` 인가는 이 PR 전 구간(1~3라운드 누적)에서 손대지 않았다.
- `triggers.service.ts` `update()` 전체(551~766행)를 직접 읽고, 락 획득 → 재읽기 → 병합 → `const patch = { ...defined, config: mergedConfig }` → 부분 객체 `save`(`m.save(Trigger, { id: target.id, ...patch })`, 707행) → `Object.assign(target, patch)` → 조건부 `updatedAt` 보정(716행) → `sanitizeForResponse(result)` 흐름을 대조했다. 저장 필드 집합만 좁아졌을 뿐, 최종적으로 클라이언트에 반환되는 `target`(관계 포함 전체 엔티티) 형태는 이전과 동일하며 응답 DTO 매핑·필드 스트립(`sanitizeForResponse`) 경로는 변경되지 않았다.
- 이번 라운드(마지막 커밋 `d60cc65aa`)의 실질 변경은 `codebase/` 범위에서 `trigger-transaction-mock.ts` 의 JSDoc 주석 갱신(뮤턴트 RED 건수 표기를 숫자에서 규칙 서술로 변경)과 `CHANGELOG.md` 문구 정정뿐이다 — 런타임 동작·API 표면에 영향 없는 순수 문서 변경임을 `git show --stat`/`git diff` 로 확인했다.
- 새 e2e 스펙(`codebase/backend/test/trigger-update-save-window.e2e-spec.ts`)은 HTTP 계층이 아니라 TypeORM `DataSource` 를 직접 붙여 락 재읽기~저장 사이의 창을 재현하는 특성 테스트다 — API 요청/응답 계약을 직접 검증하는 테스트는 아니며, 그 점을 파일 자신의 JSDoc(`"이 파일이 단언하는 것은 TypeORM·Postgres 의 동작이지 우리 코드가 아니다"`)도 명시한다. 컨트롤러 경유 요청(`POST /api/workflows`, `POST /api/triggers`)은 트리거·워크플로를 준비하는 fixture 용도로만 쓰였고, 그 응답 스키마 자체를 검증 대상으로 삼지는 않는다.
- 저장소를 뮤테이션하는 검증은 수행하지 않았다 — 코드 대조와 diff 대조만으로 판단이 충분했고, 프롬프트에 첨부된 이전 두 라운드 리뷰(`review/code/2026/09/17/13_44_39/api_contract.md`, `review/code/2026/09/17/14_11_48/api_contract.md`)가 같은 결론(NONE)에 도달해 있어 교차 확인했다. `git status --short` 재확인 결과 저장소에 아무 변경도 남기지 않았다.

## 요약

이 PR 은 `PATCH /api/triggers/:id` 의 **내부 저장 방식**을 "락 안 재읽은 엔티티 통째 `save`"에서 "이 요청이 바꾸는 필드 + `config` 만 담은 부분 객체 `save`"로 좁혀, 재읽기 뒤 락 밖에서 커밋된 컬럼(회전된 secret, 웹훅 `lastTriggeredAt`, cron 의 토큰 null-write, 스케줄 동기화 `name`/`isActive`)이 옛 값으로 되써지는 lost-update 를 근본적으로 차단하는 영속성 버그 수정이다. 3라운드 누적 diff 전체에 걸쳐 엔드포인트 경로·HTTP 메서드·요청/응답 DTO 스키마·인증/인가·기존 에러 코드 매핑·페이지네이션(해당 없음, 단일 리소스 PATCH) 중 어느 것도 변경되지 않았으며(`triggers.controller.ts`·`dto/**` 는 diff 에 아예 등장하지 않는다), PR 진행 중 자체적으로 낸 회귀("반환값을 통째로 덮어 `endpointPath` 가 사라지는" 문제)도 e2e 로 잡혀 같은 PR 안에서 수정되었다. 마지막 커밋(`d60cc65aa`)은 테스트 유틸 JSDoc 과 CHANGELOG 문구만 고친 순수 문서 커밋으로, API 계약 관점에서 이번 라운드가 새로 검토할 코드 변경은 없다. 위 두 INFO(응답 `updatedAt` 폴백의 무신호 stale 가능성, CASCADE 경합의 SQLSTATE 변화가 500 마스킹 뒤에 가려짐)는 이전 라운드에서 이미 식별되어 트래커에 등재된 비차단 사항으로, 이번 diff 가 새로 만든 문제가 아니다. 기존 API 클라이언트에 영향을 주는 breaking change 는 없다.

## 위험도
NONE
