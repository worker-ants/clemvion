# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `save()` 반환값이 `updatedAt` 을 못 주는 경우 응답의 `updatedAt` 이 재읽기 시점 값으로 남는다 (1라운드 INFO#1 — 이번 라운드에 근거 주석만 보강, 동작은 그대로 유지됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TriggersService.update()`, `const written = await m.save(Trigger, { id: target.id, ...patch });` 다음 `if (written.updatedAt) target.updatedAt = written.updatedAt;`
  - 상세: 이번 라운드는 이 분기의 로직 자체를 바꾸지 않았고, "실제 TypeORM 은 `@UpdateDateColumn` 이라 늘 채워 돌려준다. 가드는 단위 대역이 넘긴 객체를 그대로 돌려줄 때 재읽은 값을 `undefined` 로 지우지 않으려는 것" 이라는 근거 주석을 추가했다(1라운드 RESOLUTION INFO#1 처분). `TriggerDto.updatedAt` 은 공개 응답 필드이고, `written.updatedAt` 이 falsy 인 실제 경로는 e2e/mock 어느 쪽도 여전히 단언하지 않는다 — 그 경로가 언젠가 열리면 성공 응답에 에러 없이 stale 타임스탬프가 실린다. 차단 사유는 아니다(실사용 경로는 e2e ②c 로 항상 채워짐을 실측).
  - 제안: 조치 불요(이미 1라운드에서 근거 보강으로 수용됨). 여유 있을 때 invariant 화 또는 방어 분기 생존 회귀 고려.

- **[INFO]** 재읽기 뒤 `workflow` CASCADE 삭제 경합의 SQLSTATE 가 23503→23502 로 바뀌었지만, 클라이언트에 보이는 에러 응답은 여전히 동일한 일반 500 이다 (1라운드 INFO#2, 이번 라운드에서도 변경 없음)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `.catch((err: unknown) => this.rethrowEndpointPathConflict(err))` (update() 트랜잭션 블록 직후), `codebase/backend/src/common/filters/http-exception.filter.ts` (`isPostgresUniqueViolation` 만 23505 를 409 로 분기, 23502/23503 은 미분기)
  - 상세: 부분 객체 `save` 전환으로 이 경합의 실패 SQLSTATE 가 NOT NULL violation(23502)으로 바뀌지만(`trigger-update-save-window.e2e-spec.ts` ①b), `rethrowEndpointPathConflict` 는 `endpoint_path` unique violation 만 특별 처리하므로 두 경우 모두 동일하게 일반 500 `INTERNAL_ERROR` 로 마스킹된다 — 이 PR 은 클라이언트가 보는 에러 계약을 바꾸지 않는다. "부모 워크플로가 삭제된 트리거를 수정하려 했다" 는 404/409 로 문서화될 법한 상황이 불투명한 500 으로 남는 기존 갭이며, plan `## 이 PR 이 안 하는 것`·consistency SUMMARY 에 planner 후속(`15-chat-channel.md §5.4` 404 사유 갱신)으로 명시적으로 이관돼 있다.
  - 제안: 조치 불요(이미 트래커에 planner 후속으로 등재됨).

## 검증한 것

- `codebase/backend/src/modules/triggers/dto/**`, `triggers.controller.ts` 를 `origin/main` 대비 diff 로 확인 — **변경 없음**. 엔드포인트 경로·HTTP 메서드·요청 DTO(`UpdateTriggerDto`)·응답 DTO(`TriggerDto`) 스키마·`@Roles('editor')` 인가는 이번 라운드에서도 손대지 않았다.
- `triggers.service.ts` 의 이번 라운드 diff(1라운드 RESOLUTION W5 처분)는 `{...defined, config: mergedConfig}` 를 `save` 호출과 `Object.assign` 두 곳에 리터럴로 중복 작성하던 것을 `const patch` 하나로 합친 것뿐이다 — 저장 payload·응답 조립 로직은 동작상 동일하고, 응답에 실리는 필드 구성(`workflow`·`config`·`updatedAt` 등)도 그대로다.
- `trigger-transaction-mock.ts` 의 `save` mock 이 동기→비동기로 바뀌고 `undefined` 대신 `target` 폴백을 추가한 것은 **테스트 유틸리티**로, 프로덕션 API 응답 계약과 무관하다(운영 코드가 새로 `await`·`.updatedAt` 을 읽게 된 것에 대역을 맞춘 것).
- CHANGELOG·plan·이전 라운드 리뷰 산출물(`review/code/.../13_44_39/*`, `review/consistency/.../13_04_39/*`)은 이번 라운드에서 신규로 git 에 커밋된 문서/기록 파일이며 런타임 API 표면에 영향이 없다.

## 요약

이번 라운드는 1라운드(`review/code/2026/09/17/13_44_39`, api_contract NONE)가 이미 breaking-change 없음으로 판정한 `PATCH /api/triggers/:id` 부분 객체 `save` 수정에 대한 **후속 처분 커밋**이다 — payload 조립 중복 제거(`const patch`), 낡은 머리말 주석 정정, mock 재측정치 갱신, 뮤턴트 표 정정이 전부이며 엔드포인트 경로·요청/응답 DTO·에러 코드 매핑·인가·페이지네이션 어느 것도 diff 에 없다(controller·dto 디렉터리는 `origin/main` 대비 무변경 확인). 이전에 발견된 두 INFO(응답 `updatedAt` 폴백의 무신호 stale 가능성, CASCADE 경합 SQLSTATE 변화가 500 마스킹 뒤에 가려짐)는 이번 라운드에서도 근거 주석 보강 외 실질 변경이 없어 그대로 비차단으로 유지된다. 신규 API 계약 위반이나 하위 호환성 이슈는 발견되지 않았다.

## 위험도
NONE
