# Documentation Review

## 발견사항

### [INFO] e2e 테스트 케이스 H의 설명(it-string)이 ParseEnumPipe 검증 시나리오를 포함하지 않음
- 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — `it('H. POST /api/model-configs/:id/test — viewer 403, editor 가드 통과; GET :id/models 는 viewer 통과 (spec §3·R-7)')` 블록 끝 (추가된 `invalidType` 단언)
- 상세: 케이스 H는 원래 RBAC 게이트 검증만 다루는 테스트로 명명되어 있다. 이번 변경으로 `type=bogus`에 대한 ParseEnumPipe 400 응답 검증이 동일 `it` 블록에 추가되었으나, `it` 설명에는 이 시나리오가 반영되어 있지 않다. 인라인 주석(`// ParseEnumPipe — 규격 외 type ...`)이 의도를 충분히 설명하고 있어 실질적 혼란은 작지만, 테스트 목록을 훑을 때 이 시나리오의 존재를 인지하기 어렵다.
- 제안: `it` 설명을 `'H. ... (spec §3·R-7) + ParseEnumPipe type=400 검증'` 과 같이 갱신하거나, 별도의 `it` 블록으로 분리할 것을 고려한다.

---

### [INFO] `PROVIDER_PROBE_THROTTLE` 상수 주석에 spec 참조 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/codebase/backend/src/modules/llm/llm-model-config.controller.ts` — 라인 277–278 (`// 분당 10회 — provider API 호출 비용·속도제한 여유분 기준`)
- 상세: 주석이 값의 근거("비용·속도제한 여유분 기준")는 잘 설명하고 있다. 그러나 이 숫자가 스펙 문서에 명시된 것인지 아니면 구현 재량인지 주석만으로는 판별할 수 없다. CHANGELOG에서도 스로틀 값에 대한 별도 서술은 없다. 기존 코드에서도 동일 값이 인라인으로 사용되어 온 점에서 pre-existing 결정이므로 이번 변경의 책임 범위는 아니나, 향후 값 변경 시 근거 추적이 어렵다.
- 제안: 값이 구현 재량이면 현행 주석으로 충분하다. 스펙에 명시된 경우 `(spec §... 또는 ADR 참조)` 형태로 링크를 추가한다.

---

### [INFO] `@ApiBadRequestResponse` 데코레이터 위치가 관례와 미묘하게 다름
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `listModels` 핸들러, `@ApiUnauthorizedResponse`·`@ApiNotFoundResponse` 뒤에 배치
- 상세: 같은 파일의 `previewModels` 핸들러에서 `@ApiBadRequestResponse`는 `@ApiOkWrappedResponse` 바로 다음에 위치하고, `testConnection`에는 해당 데코레이터가 없다. `listModels`에서만 OK→Unauthorized→NotFound→BadRequest 순서인데, 보통 BadRequest(400)을 Unauthorized(401), NotFound(404)보다 앞에 두는 관례(HTTP 상태코드 오름차순)와 어긋난다. 기능적 영향은 없으나 Swagger UI 문서의 오류 응답 정렬 순서에 영향을 준다.
- 제안: `@ApiBadRequestResponse`를 `@ApiUnauthorizedResponse` 앞으로 이동하거나, 컨트롤러 전체의 오류 응답 데코레이터 순서를 통일한다.

---

## 긍정적 발견사항 (참고)

이하 항목은 발견된 문제가 아니라 이번 변경에서 문서화가 특히 잘 된 부분이다.

- **CHANGELOG.md**: 새 항목이 기존 패턴(`### 변경 사항` + 번호 + 굵은 엔드포인트 경로)을 일관되게 따르며, 허용값·기존 동작·영향 범위(스펙 준수 클라이언트 무영향)를 구체적으로 서술하고 `@ApiBadRequestResponse` 동반 문서화 사실을 명시하고 있다.
- **`MODEL_TYPE_ENUM` 상수 주석**: "ParseEnumPipe 인자·Swagger enum·파라미터 타입을 단일 소스에서 파생"이라는 설계 의도가 한 줄 주석으로 명확히 기재되어 있어 코드 리뷰·유지보수 시 맥락 제공이 충분하다.
- **`LlmModelConfigController` 클래스 JSDoc**: 컨트롤러가 llm 모듈에 위치하는 이유(forwardRef 제거, 단방향 의존), CRUD 분리 책임, API 계약 SoT 참조까지 완비되어 있다.
- **Swagger `@ApiQuery` 갱신**: `enum: ['chat', 'embedding']` 하드코딩을 `Object.values(MODEL_TYPE_ENUM)`으로 교체해 런타임 검증과 Swagger 문서의 단일 소스 원칙을 실현했다.
- **e2e 테스트 인라인 주석**: "단위 테스트는 pipe wiring 을 우회하므로 e2e 로 검증" 근거가 명시되어 있어 테스트 전략의 의도가 명확하다.

---

## 요약

이번 변경은 문서화 측면에서 전반적으로 양호하다. CHANGELOG가 적시에 갱신되었고, Swagger 데코레이터(`@ApiQuery`·`@ApiBadRequestResponse`)가 런타임 동작과 일치하도록 갱신되었으며, 신규 상수에 설계 의도가 명확히 주석 처리되어 있다. 발견된 사항은 e2e 케이스 H의 `it` 설명 갱신 누락(INFO), 스로틀 상수의 spec 근거 불명(INFO), Swagger 오류 응답 데코레이터의 순서 불일치(INFO) 세 건이며, 모두 기능에 영향이 없는 경미한 수준이다.

## 위험도

LOW
