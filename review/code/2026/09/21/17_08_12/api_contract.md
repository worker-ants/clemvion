# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 레이스 패자의 응답이 `204` → `404`로 바뀐다 (기존 계약 재사용, breaking change 아님)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` (게이트 426~429, `const { affected } = await this.repo.delete({ id, workspaceId }); if (affected === 0) { throw this.notFound(); }`)
  - 상세: 종전 `this.repo.remove(config)` 는 대상 행이 이미 삭제돼 있어도 예외를 던지지 않아, 동시에 들어온 두 DELETE 요청이 둘 다 `204 No Content` 를 받고 `model_config.delete` 감사 행이 중복 기록됐다. 이번 변경은 원자적 `DELETE ... WHERE id = $1 AND workspace_id = $2` 의 `affected` 를 판별자로 써서 레이스 패자에게 `404 MODEL_CONFIG_NOT_FOUND` 를 반환한다. 저장소를 직접 확인한 결과 이 코드는 새 에러 코드·새 응답 스키마가 아니라 `findEntity()`(:138, :143)가 이미 쓰던 동일한 `private notFound()` 헬퍼(:148, `code: 'MODEL_CONFIG_NOT_FOUND'`)를 그대로 재사용한다 — 전역 `{error:{code,message}}` 봉투도 불변이다. 형제 7건(#1369~#1374)과 동일 패턴의 버그 수정이며, "이미 없는 리소스에 대한 DELETE → 404" 라는 REST 관례에 더 부합하게 된 것이라 하위 호환성 문제로 보지 않는다.
  - 제안: 별도 조치 불요. 다만 DELETE 를 멱등 재시도(재전송 시 204 기대)로 구현한 외부 클라이언트가 있다면, 순수 레이스 상황에서만 404 로 관측될 수 있다는 점을 CHANGELOG(이미 이번 diff 가 8번째 항목으로 기록함)로 충분히 알린 것으로 판단한다.

- **[INFO]** 컨트롤러 계층(URL·HTTP 메서드·인증/인가·요청 검증)은 이번 diff 에 포함되지 않았고, 저장소를 직접 열어 실제로 미변경임을 확인했다
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts:162-171` (`@Delete(':id')`, `@HttpCode(HttpStatus.NO_CONTENT)`, `@Roles('editor')`, `@Param('id', ParseUUIDPipe) id: string`)
  - 상세: `grep` 으로 대조한 결과 라우트 경로, 성공 상태 코드(204), 역할 가드(`editor` 이상), UUID 파라미터 검증 파이프 모두 그대로다. 변경은 서비스 내부 구현(`repo.remove(entity)` → `repo.delete(criteria)`)에 국한되어 있어 API 표면(surface) 자체에는 변화가 없다.
  - 제안: 해당 없음(확인 목적의 기재).

- **[INFO]** e2e 신규 테스트의 에러 응답 단언이 기존 에러 봉투·도메인별 코드 원칙을 그대로 반영한다
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (게이트 81, `code: res.body?.error?.code`) / (게이트 111, `expect(results[1].code).toBe('MODEL_CONFIG_NOT_FOUND')`)
  - 상세: 레이스 패자가 형제들의 공용 `RESOURCE_NOT_FOUND` 대신 도메인 고유 `MODEL_CONFIG_NOT_FOUND` 를 받도록 단언한 것은, `findEntity` 실패("애초에 없어서 404")와 레이스 패배("있었는데 방금 지워져서 404")를 클라이언트 관점에서 같은 코드로 통일해 구분 불가능하게 만드는 이 모듈의 기존 설계와 일치한다.
  - 제안: 해당 없음.

- **[INFO]** 이번 라운드(17_08_12)에서 추가된 변경분(CHANGELOG 8번째 항목·직전 항목 취소선 정정, 죽은 `mockRepo.remove` fixture 제거, e2e 주석 정정, JSDoc 추가, plan 결정 고정)은 모두 문서·테스트 정리이며 API 표면에 영향을 주지 않는다
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/model-config/model-config.service.spec.ts`, `plan/in-progress/*.md`
  - 상세: 직전 라운드(`review/code/2026/09/21/16_39_52`)의 api_contract 리뷰(NONE)가 다룬 핵심 코드(`model-config.service.ts` `remove()`)는 이번 라운드에서 추가 수정되지 않았다 — diff 는 동일한 최종 상태를 보여준다. `RESOLUTION.md`/`_resolution_state.json` 대조 결과 WARNING 1·2 는 CHANGELOG 문서 수정으로, WARNING 3(e2e 헬퍼 추출 유예)은 plan 문구 재작성으로 해소됐으며 셋 다 API 계약과 무관하다.
  - 제안: 해당 없음.

## 요약
이번 diff 의 핵심은 `ModelConfigService.remove()` 를 TypeORM `repo.remove(entity)` 에서 원자적 `repo.delete({id, workspaceId})` + `affected === 0` 판정으로 바꿔, 동시 DELETE 두 건이 감사 로그를 중복 기록하던 결함(형제 8번째 자리, #1369~#1374 와 동일 클래스)을 고친 것이다. 컨트롤러의 URL·HTTP 메서드·인증/인가(`Roles('editor')`)·요청 검증(`ParseUUIDPipe`)·성공 응답(204)·에러 응답 봉투(`{error:{code,message}}`)는 저장소 직접 대조로 미변경임을 확인했다. 유일하게 관측 가능한 외부 동작 차이는 "동시 삭제 레이스 패자가 204 대신 기존에 이미 쓰이던 `MODEL_CONFIG_NOT_FOUND`(404)를 받는다"는 것이며, 이는 새 에러 코드·새 스키마·URL 변경이 아니라 `findEntity()` 가 이미 쓰던 `notFound()` 헬퍼의 재사용이다. 이번 라운드에서 추가된 변경분(CHANGELOG 정정, 죽은 fixture 제거, plan 문구 재작성)은 전부 문서·테스트 정리로 API 표면에 영향이 없다. breaking change·버전 관리 이슈·응답 스키마 불일치·요청 검증 공백·페이지네이션 영향·인증/인가 변경 어느 것도 발견되지 않았다.

## 위험도
NONE
