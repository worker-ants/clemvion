# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `save()` 반환값이 `updatedAt` 을 못 주는 경우 클라이언트 응답의 `updatedAt` 이 stale 해질 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:713` (`if (written.updatedAt) target.updatedAt = written.updatedAt;`)
  - 상세: `TriggerDto.updatedAt`(`codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:93`)는 공개 응답 필드다. 정상 Postgres 경로에서는 `save` 가 항상 `updatedAt` 을 채워 돌려준다는 것을 e2e(`trigger-update-save-window.e2e-spec.ts` ②c, `written.updatedAt` 을 `toBeInstanceOf(Date)` 로 단언)로 실측했으므로 실사용 경로에서 이 분기가 거짓이 될 확률은 낮다. 다만 방어적으로 조건부 대입을 남겨 두었기 때문에, 그 조건이 언젠가 거짓이 되는 경로(드라이버 교체·mock 오용 등)가 생기면 응답의 `updatedAt` 이 PATCH 이전 값(재읽기 시점 값)으로 조용히 되돌아간다 — 에러 없이 성공 응답에 잘못된 타임스탬프가 실리는 형태라 클라이언트가 이를 감지할 방법이 없다.
  - 제안: 방어 분기가 실제로 필요한지(즉 `written.updatedAt` 이 falsy 인 실제 경로가 존재하는지) 확인하고, 없다면 non-null assertion 이나 명시적 invariant 체크로 바꿔 "값이 없으면 조용히 무시" 대신 눈에 띄게 실패하도록 하는 편이 응답 정확성 보장에 더 안전하다. Critical 은 아니다.

- **[INFO]** 재읽기 뒤 워크플로 CASCADE 삭제 경합 창은 여전히 일반 500 으로 마스킹된다 (이 PR 이 만든 회귀 아님, 기존 갭)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:716` (`.catch((err: unknown) => this.rethrowEndpointPathConflict(err))`), `codebase/backend/src/common/filters/http-exception.filter.ts` (`isPostgresUniqueViolation` 만 특별 처리, 23503/23502 는 분기 없음)
  - 상세: 이번 수정으로 락 안 재읽기 뒤 `workflow` 가 CASCADE 삭제되는 경합에서 실패 SQLSTATE 가 통째 엔티티 `save` 의 `23503`(FK violation)에서 부분 객체 `save` 의 `23502`(NOT NULL violation)로 바뀐다(`trigger-update-save-window.e2e-spec.ts` ①/①b). `rethrowEndpointPathConflict` 는 `endpoint_path` unique violation 만 특별 처리하고 그 외는 그대로 다시 던지며, `GlobalExceptionFilter` 도 `isPostgresUniqueViolation`(23505)만 409 로 분기하므로 23503 이든 23502 든 동일하게 일반 500 `INTERNAL_ERROR` 로 마스킹된다 — 즉 이 PR 이 클라이언트에 보이는 에러 응답을 바꾸지는 않는다. 다만 "부모 워크플로가 삭제된 트리거를 수정하려 했다"는, 정상적으로는 404/409 로 문서화될 법한 상황이 계속 불투명한 500 으로 노출되는 기존 갭이다. plan(`plan/in-progress/trigger-save-partial-patch.md` "이 PR 이 안 하는 것" §2, consistency SUMMARY INFO#1)도 이를 planner 후속(`15-chat-channel.md §5.4` 404 행 갱신)으로 명시적으로 미뤄 둔 상태라 이 PR 범위에서 처리를 요구하는 것은 아니다.
  - 제안: 조치 불요(이미 트래커에 planner 후속으로 등재됨). 향후 후속 PR 에서 이 경합을 404/409 로 명시적으로 매핑할지 결정할 때 참고.

## 요약

이번 변경은 `PATCH /api/triggers/:id` 의 내부 저장 방식을 "재읽은 엔티티 통째 `save`" 에서 "요청이 바꾸는 필드만 담은 부분 객체 `save`" 로 좁혀, 동시에 락 밖에서 커밋된 다른 컬럼(회전된 secret, 웹훅 `lastTriggeredAt`, 스케줄 동기화 필드 등)이 옛 값으로 되써지는 lost-update 를 막는 내부 영속성 버그 수정이다. 엔드포인트 경로·HTTP 메서드·요청 DTO(`UpdateTriggerDto`)·응답 DTO(`TriggerDto`) 스키마·인증/인가(`@Roles('editor')`)·기존 에러 코드 매핑(`RESOURCE_CONFLICT`/`VALIDATION_ERROR`/404 등)은 전혀 바뀌지 않았고, 응답에 실리는 `workflow` 관계·`config`·`updatedAt` 등 필드 구성도 최종 코드에서는 기존과 동일한 모양으로 유지된다(PR 작업 중 발생했던 "반환값을 통째로 덮어 `endpointPath` 가 `null` 이 되는" 자체 회귀는 같은 PR 안에서 e2e 로 잡혀 이미 수정됨). 따라서 기존 API 클라이언트에 영향을 주는 breaking change 는 없으며, 위 두 INFO 항목도 각각 극히 드문 방어 분기·기존에 이미 인지되고 트래커에 등재된 갭이라 이 PR 을 막을 이유는 아니다.

## 위험도
NONE
