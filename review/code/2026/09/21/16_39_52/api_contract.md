# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 시 진 쪽의 응답이 `204`→`404`로 바뀐다 (기존 API 계약과의 정합성 관점에서 참고)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` 메서드 (게이트 422~425, `if (affected === 0) { throw this.notFound(); }`)
  - 상세: 종전 `this.repo.remove(config)` 는 이미 삭제된 행에 대해서도 예외를 던지지 않아, 동시에 들어온 두 DELETE 요청이 둘 다 `204 No Content` 를 받았다(그리고 감사 로그가 중복 기록됐다). 이번 변경으로 원자적 `DELETE` 의 `affected` 를 판별자로 써서, 레이스에서 진 쪽은 이제 `404 MODEL_CONFIG_NOT_FOUND` 를 받는다. 이는 새 에러 코드나 새 응답 스키마를 도입한 것이 아니라 — `findEntity` 가 이미 사용하던 동일한 `notFound()` 헬퍼(`{code: 'MODEL_CONFIG_NOT_FOUND', message: ...}`, 전역 `http-exception.filter.ts` 가 `{error:{code,message}}` 봉투로 감싸는 기존 포맷)를 재사용한 것이라, 에러 응답 형식·HTTP 상태 코드 체계 자체는 기존 계약과 완전히 일치한다. 실질적으로는 "이미 없는 리소스를 지우려 하면 404" 라는 REST 관례에 더 부합하게 된 버그 수정이며, 형제 7건(#1369~#1374)과 동일 패턴이다.
  - 제안: 별도 조치 불요. 다만 재시도(retry) 로직을 가진 기존 클라이언트가 "DELETE 재전송 시 204 를 기대"하는 방식으로 구현돼 있었다면(멱등 재시도 관례), 레이스 상황에서만 404 를 받게 되는 점을 변경 로그에 명시하는 편이 좋다. `HttpCode(HttpStatus.NO_CONTENT)`·`@ApiNotFoundResponse` 데코레이터를 가진 컨트롤러 자체는 이번 diff 에서 변경되지 않았으므로 Swagger 문서상 새 계약을 추가할 필요는 없다(404 는 이미 문서화돼 있었다).

- **[INFO]** 컨트롤러 계층은 변경되지 않아 URL·메서드·인증/인가·요청 검증은 그대로 유지된다
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts:162-176` (`@Delete(':id')`, `@Roles('editor')`, `@HttpCode(HttpStatus.NO_CONTENT)`, `ParseUUIDPipe`) — 이번 diff 에 포함되지 않은 파일이라 직접 열어 대조 확인함.
  - 상세: 변경은 `ModelConfigService.remove()` 내부 구현(ORM `remove(entity)` → `delete(criteria)`)에 국한된다. 라우트 경로·HTTP 메서드·`editor` 이상 역할 요구·UUID 파라미터 검증·워크스페이스 스코프(`{id, workspaceId}` 조건)는 모두 그대로다. `ModelConfig` 엔티티에 `cascade`·`@OneToMany`·remove 계열 라이프사이클 훅이 없음을 직접 확인했고(`grep` 결과 `@Entity('model_config')` 외 해당 데코레이터 0건), FK 참조 두 곳(`knowledge_base.rerank_config_id`, KB embedding)은 `ON DELETE SET NULL` 이라 `remove`/`delete` 방식 차이가 DB 레벨 부수효과를 바꾸지 않는다는 plan 의 주장과 일치한다.
  - 제안: 해당 없음(확인 목적의 기재).

- **[INFO]** e2e 테스트의 에러 응답 단언이 기존 에러 봉투 관례를 정확히 반영한다
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (게이트 80, `code: res.body?.error?.code`) / (게이트 110, `expect(results[1].code).toBe('MODEL_CONFIG_NOT_FOUND')`)
  - 상세: `{error: {code, message}}` 중첩 봉투는 `http-exception.filter.ts` 가 실제로 생성하는 형태와 일치함을 확인했다(같은 파일의 spec 에 동일 패턴의 테스트가 있음). 진 쪽 코드가 형제들의 공용 `RESOURCE_NOT_FOUND` 가 아니라 도메인 고유의 `MODEL_CONFIG_NOT_FOUND` 를 쓰는 이유(=`findEntity` 실패와 동일 코드로 통일해, 클라이언트가 "존재하지 않아서 404" 와 "레이스에서 져서 404" 를 구분하지 못하게 함)도 기존 도메인별 distinctive 코드 원칙(spec 언급, `plan/in-progress/modelconfig-dup-delete.md` §C)과 부합한다.
  - 제안: 해당 없음.

## 요약

이번 변경은 `ModelConfigService.remove()` 의 내부 삭제 방식을 TypeORM `repo.remove(entity)` 에서 원자적 `repo.delete({id, workspaceId})` + `affected` 판정으로 바꿔, 동시 DELETE 두 건이 감사 로그(`model_config.delete`)를 중복 기록하던 결함을 수정한 것이다. 컨트롤러의 URL·HTTP 메서드·인증/인가(`Roles('editor')`)·요청 검증(`ParseUUIDPipe`)·성공 응답(`204 No Content`)·에러 응답 봉투(`{error:{code,message}}`)는 이번 diff 에서 전혀 손대지 않았고, 새로 도입된 유일한 관측 가능 차이는 "동시 삭제 레이스에서 진 쪽이 204 대신 기존에 이미 쓰이던 `404 MODEL_CONFIG_NOT_FOUND` 를 받는다"는 것뿐이다. 이는 새 에러 코드·새 스키마·URL 변경이 아니라 기존 코드/헬퍼(`notFound()`)의 재사용이며, 형제 PR 7건(#1369~#1374)과 동일한 패턴을 따른 버그 수정이다. `affected === 0` 명시 비교로 드라이버 미보고(`undefined`/`null`)와 실제 미삭제(`0`)를 구분해 정상 삭제가 오탐 404 로 뒤집히는 것을 방지한 점도 확인했다. API 계약 관점에서 breaking change·버전 관리 이슈·요청 검증 공백·페이지네이션 영향은 없다.

## 위험도
NONE
