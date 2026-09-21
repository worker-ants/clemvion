# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 동시 두 번째 DELETE 요청의 관측 가능한 응답이 `204`→`404` 로 바뀐다 (의도된 동작 변경, 문서 반영 자리 없음)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` (게이트 800-809행)
  - 상세: 이번 변경으로 경합에서 진 두 번째 DELETE 요청은 이전엔 `204`(중복 성공)를 받았지만 이제는 `404 RESOURCE_NOT_FOUND` 를 받는다. 컨트롤러 시그니처(`remove(id, workspaceId, userId): Promise<void>`, `integrations.controller.ts:579`)는 그대로이므로 TS 타입 레벨 인터페이스 파괴는 없지만, **와이어 레벨 행동 계약**은 바뀐다. 클라이언트가 "DELETE 재시도는 항상 204(멱등)" 로 가정하고 있었다면 이 변화로 에러 처리 분기가 새로 필요해질 수 있다. 단, 이 계열 수정은 이미 workflow/trigger/schedule 세 자리(#1369-#1371)에 동일 패턴으로 적용되어 병합됐고, 이번 PR 이 새로 만드는 리스크 등급이 아니라 기존 관례를 통합 자리에도 넓히는 것이다. `spec/2-navigation/4-integration.md` §9 에 이 계약을 반영할 자리가 없다는 점은 이미 동봉된 consistency-check SUMMARY(WARNING #3)가 별도로 지적·등재했다.
  - 제안: 별도 조치 불요 — 문서 반영은 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` L4813)에 이미 등재되어 있다. 다만 FE/외부 SDK 소비자가 "DELETE 재시도 = 항상 204" 를 가정하는 코드가 있는지 별도 트랙에서 확인할 가치는 있다.

- **[INFO]** `remove(entity)` → `delete(criteria)` 전환이 TypeORM 엔티티 라이프사이클 훅을 우회하는지 확인 — 실측 결과 영향 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:800` (`this.integrationRepository.delete({ id, workspaceId })`)
  - 상세: `Repository.remove()` 는 엔티티 매니저를 통해 `@BeforeRemove`/`@AfterRemove`/subscriber 훅과 `cascade` 관계를 태우지만, `Repository.delete(criteria)` 는 원시 `DELETE` SQL 을 날려 그런 훅을 우회한다. 코드 내 주석은 "cascade:true 관계도 @OneToMany 도 없다" 만 근거로 들었는데, 라이프사이클 훅(subscriber) 우회 가능성은 언급하지 않았다. 직접 저장소 전체를 `grep -rn "EventSubscriber|@BeforeRemove|@AfterRemove|@BeforeSoftRemove|@AfterSoftRemove" codebase/backend/src`로 확인한 결과 **0건**이라, 이번 저장소에는 우회로 영향받는 훅이 실제로 없다. 부작용 없음으로 판정하되, 이 근거가 코드 주석/plan 어디에도 없어 다음 사람이 같은 전환을 다른 엔티티에 적용할 때 재검증 없이 "선례가 있으니 안전" 이라고 오판할 여지가 남는다.
  - 제안: 조치 불요(이번 PR 한정). 다만 이 패턴(entity `remove()` → criteria `delete()`)이 다른 엔티티에도 반복 적용될 계획이라면, 그 판단 기준("cascade/@OneToMany 없음" + "subscriber/lifecycle hook 없음")을 plan 이나 코드 주석에 명시적으로 남기는 편이 재현성이 좋다.

- **[INFO]** 승자 경로에서 `broadcastCredentialChange`(내부 캐시 버스 publish) 중복 호출이 함께 제거됨 — 의도된 부수 효과
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:823` (`await this.broadcastCredentialChange(id)`)
  - 상세: 이전엔 경합에서 진 쪽도 `remove(entity)` 가 성공해 `integrationCacheBus.publish(id)` 를 한 번 더 호출했다. 이제 진 쪽은 `affected === 0` 분기에서 조기 `throw` 하므로 `broadcastCredentialChange` 가 아예 불리지 않는다. `IntegrationCacheBus` 는 프로세스 내부 pub/sub(네트워크 호출 아님)로 확인되며, 이 변경은 plan(§ "이 PR 이 하지 않는 것" 마지막 항목)에서 명시적으로 의도한 부수 효과다. 새로운 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 테스트의 `finally` 블록이 COMMIT 이후에도 `ROLLBACK` 을 시도
  - 위치: `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` 게이트 99-107행
  - 상세: 정상 경로에서 `locker.query('COMMIT')` 이 이미 실행된 뒤에도 `finally` 블록이 `locker.query('ROLLBACK').catch(() => undefined)` 를 시도한다. PostgreSQL 은 트랜잭션이 없는 상태에서의 `ROLLBACK` 을 경고만 내고 에러 없이 처리하므로(또는 드라이버 레벨에서 무해한 예외가 나더라도 `.catch(() => undefined)` 로 흡수), 테스트 실행이나 DB 상태에 실질적 부작용은 없다. 형제 e2e 파일들(`workflow-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`)도 같은 패턴을 쓰는지는 미확인이나, 이 파일 자체만 보면 침묵 실패이지 관측 가능한 부작용은 아니다.
  - 제안: 조치 불요 — 원한다면 `finally` 진입 전 커밋 완료 플래그로 조건부 롤백을 걸어 노이즈를 줄일 수 있으나 side-effect 관점의 결함은 아니다.

## 검증 메모

- 저장소 mutation 없음 — 이번 리뷰는 `Read`/`Bash grep` 만 사용했고 어떤 파일도 쓰거나 고치지 않았다. `git status --short` 는 리뷰 세션이 시작하기 전부터 있던 `review/code/2026/09/21/10_54_47/`(오케스트레이터가 만든 이 리뷰 자신의 산출물 디렉터리) 외 변경 없음을 확인했다.
- `IntegrationsService.remove()` 의 유일한 호출자(`integrations.controller.ts:579`)를 확인해 시그니처(`remove(id, workspaceId, userId): Promise<void>`)가 그대로임을 검증했다.
- `Integration` 엔티티(`integration.entity.ts`)에 `cascade: true` 관계·`@OneToMany` 가 없음을 직접 읽어 확인 — 코드 주석의 근거가 사실과 일치한다.
- 저장소 전체에 TypeORM `EventSubscriber`/라이프사이클 데코레이터가 0건임을 grep 으로 확인 — `remove()`→`delete()` 전환이 우회할 훅 자체가 없다.
- `queryUsageNodes` 는 순수 조회이며 부작용 없음을 확인.
- `broadcastCredentialChange` → `integrationCacheBus.publish` 는 프로세스 내부 캐시 무효화 pub/sub 이며 네트워크 호출이 아님을 확인.

## 요약

핵심 변경(`remove(entity)` → 원자적 `delete(criteria)` + `affected === 0` 404 판정)은 범위가 좁고 의도가 명확하며, 코드 주석이 든 근거(엔티티 cascade/관계 부재)를 직접 검증한 결과 사실과 일치했고, 추가로 확인한 TypeORM 라이프사이클 훅 부재까지 더하면 이 전환이 숨은 부작용을 유발할 표면은 없다. 유일한 실질적 변화는 경합에서 진 두 번째 DELETE 요청의 응답이 `204`→`404` 로 바뀌는 와이어 레벨 행동 변경인데, 이는 plan 이 명시적으로 의도했고 이미 병합된 형제 3건(workflow/trigger/schedule)과 같은 패턴이며 동봉된 consistency-check 가 문서 반영 갭을 별도로 잡아 트래커에 등재해 두었다. 전역 상태·환경 변수·파일시스템·외부 네트워크 호출 관련 부작용은 발견되지 않았다.

## 위험도

NONE
