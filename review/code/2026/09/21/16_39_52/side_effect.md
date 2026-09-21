# 부작용(Side Effect) 리뷰 — `modelconfig-dup-delete`

## 발견사항

- **[INFO]** HTTP DELETE 응답 계약이 동시 요청 조건에서 바뀐다 (의도된 변경)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:399-438` (`remove`)
  - 상세: 종전에는 `this.repo.remove(config)` 가 0행을 지워도 예외를 던지지 않아, 동시 DELETE 두 건이 겹치면 **둘 다** 204 를 받고 `notifyInvalidated`·`recordAudit` 이 각각 두 번 발화했다(중복 감사 행이 결함). 이번 변경은 `this.repo.delete({ id, workspaceId })` 의 `affected === 0` 을 판별자로 써서, 진 쪽은 `MODEL_CONFIG_NOT_FOUND` 404 를 받고 `notifyInvalidated`/`recordAudit` 을 모두 건너뛴다. 즉 "동시 삭제 시 승자 아닌 요청도 성공(204)" 이라는 이전 관측 가능한 API 동작이 "패자는 404" 로 바뀐다.
  - 확인: 컨트롤러(`model-config.controller.ts:161-176`)의 `@Delete(':id')` 핸들러는 이미 `@ApiNotFoundResponse` 를 문서화하고 있고 `findEntity` 실패 시에도 같은 코드로 404 를 반환해 왔으므로, 이번 변경이 **새로운 응답 코드 종류를 도입하는 것은 아니다** — 기존에 문서화된 404 경로가 새로운 타이밍(동시 삭제 레이스)에서도 발생하게 될 뿐이다. 형제 수정 7건(#1369~#1374)과 동일한 패턴이며 e2e(`model-config-delete-concurrency.e2e-spec.ts`)로 재현·검증됨.
  - 제안: 조치 불요 — 의도된 수정이자 기존에 문서화된 응답 코드 재사용. 다만 이 API 를 폴링/재시도하는 프론트엔드나 외부 통합이 "두 번째 DELETE 도 204" 를 가정하고 있었다면(관측된 코드 상 없음) 그 가정이 깨진다는 점만 인지할 것.

- **[INFO]** `notifyInvalidated` 호출 횟수 감소 (제어 흐름 변경, 의도됨)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:427-430`
  - 상세: 진 쪽 요청은 `delete()` 이전에 404 로 throw 되므로 `notifyInvalidated(id)` 콜백(구독자: `LlmService.clearClientCache`, `llm.service.ts:81`)이 더 이상 호출되지 않는다. 코드 주석과 plan(`plan/in-progress/modelconfig-dup-delete.md` §B)이 "캐시 축출은 멱등이라 원래도 해가 없었고, 이번 변경은 그 중복 호출을 없애는 부수 효과일 뿐 별도로 고친 결함이 아니다" 라고 명시적으로 정정해 두었다 — 실제로 리스너 집합(`invalidationListeners`)이나 구독 등록 로직 자체는 변경되지 않았다.
  - 제안: 조치 불요. 근거가 코드(리스너 단일 구독, 멱등 캐시 삭제)와 문서 양쪽에서 확인됨.

- **[INFO]** 테스트가 실제 소스 오퍼레이션을 정확히 뒤쫓아 이동했다 (부작용 없음, 확인 목적 기재)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:359-368`, `:400-404`
  - 상세: `mockRepo.remove` 를 겨냥하던 두 단언이 `mockRepo.delete` 로 옮겨졌고, TypeORM `remove()` 의 엔티티 파괴를 흉내 내던 `mockRepo.remove.mockImplementation(() => { delete entity.id; delete entity.kind })` 블록(구 테스트 "remove 는 삭제 **전에** 읽은 kind 를 남긴다")이 제거됐다. `delete(criteria)` 는 엔티티 객체를 건드리지 않으므로 이 흉내는 더 이상 유효하지 않은 시뮬레이션이며, 제거 사유가 diff 주석에 명시돼 있다. 새 테스트("remove 는 조회한 엔티티의 kind 를 감사에 남긴다")는 여전히 참인 계약만 단언한다 — 실제 프로덕션 코드의 사이드이펙트를 변경하지 않는 테스트 전용 정리.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 테스트의 DB 연결·트랜잭션 정리 경로 확인
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (전체, 특히 82-114행)
  - 상세: `locker` 커넥션으로 `BEGIN` + `SELECT … FOR UPDATE` 를 걸어 실제 DB 행을 잠그고, 두 HTTP DELETE 요청을 그 잠금 뒤에서 겹치게 만든 뒤 `COMMIT`(또는 예외 시 `finally` 의 `ROLLBACK`)으로 푼다. `fireDelete()` 가 항상 `{status, code}` 로 resolve 하도록 짜여 있어(reject 없음) `Promise.all` 이 unhandled rejection 을 만들 위험은 없고, `finally` 에서 `pending?.catch(() => undefined)` 로 남은 in-flight 요청을 반드시 흡수한다. `afterAll` 에서 `locker.end()`/`db.end()` 로 커넥션을 정리한다. 테스트가 만든 workspace·model-config 행은 명시적으로 삭제되지 않고 남지만, 이는 형제 동시성 e2e 7건과 동일한 기존 패턴이라 신규 부작용이 아니다.
  - 제안: 조치 불요 — 기존 컨벤션과 일치.

- **[INFO]** `review/consistency/2026/09/21/16_16_35/**` 및 `plan/in-progress/modelconfig-dup-delete.md` 신규 생성은 워크플로 산출물
  - 위치: `review/consistency/2026/09/21/16_16_35/*.md`, `_retry_state.json`, `meta.json`; `plan/in-progress/modelconfig-dup-delete.md`
  - 상세: 이 파일들은 프로젝트 규약(`CLAUDE.md` "정보 저장 위치" 표, `--impl-prep` 의무)에 따라 `developer` 워크플로가 착수 전 의무적으로 실행하는 `/consistency-check` 의 정식 산출 경로에 생성된 것이다. 예상치 못한 파일시스템 부작용이 아니라 규약이 요구하는 표준 산출물이다.
  - 제안: 조치 불요.

## 요약

핵심 변경(`ModelConfigService.remove()` 의 `repo.remove(entity)` → `repo.delete(criteria)` + `affected===0` 판별)은 형제 수정 7건과 동일한, 이미 검증된 패턴을 그대로 반복한 것이며 시그니처·공개 인터페이스 자체는 바뀌지 않았다. 유일하게 관측 가능한 동작 변화 — 동시 삭제 레이스의 패자가 204 대신 404(`MODEL_CONFIG_NOT_FOUND`)를 받고 캐시 무효화 통지·감사 기록을 건너뛴다 — 는 컨트롤러가 이미 `@ApiNotFoundResponse` 로 문서화해 둔 기존 응답 코드를 재사용하는 것이고, 버그(중복 감사 행)를 없애는 것이 이번 변경의 목적 그 자체다. `remove()` 의 유일한 내부 호출자(컨트롤러)를 확인했고, 다른 서비스들은 `ModelConfigService` 를 주입만 받을 뿐 `remove()` 를 호출하지 않는다. 테스트·e2e 변경도 실제 동작을 그대로 뒤쫓아 갱신됐을 뿐 별도의 부작용을 만들지 않는다. 전역 상태·환경 변수·네트워크 호출 패턴에 새로운 변경은 없다. 종합적으로 부작용 관점에서 이 변경은 안전하다.

## 위험도

NONE
