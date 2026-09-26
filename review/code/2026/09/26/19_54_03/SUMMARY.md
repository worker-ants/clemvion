# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(신규 테스트 1개의 자기참조 커버리지 갭, 실측으로 확인됨). 전체 14개 reviewer(강제 7명 포함) 결과 모두 확보됐고, forced 화이트리스트 미이행 없음.

> **공유 워크트리 동시 뮤테이션 관측 (참고, 조치 불요)**: 리뷰 도중 `testing` reviewer 가 `UNVALIDATED_METATYPES` 뮤턴트(`Number` 원소 제거)를 저장소 파일에 직접 적용해 검증했고, 그 사이 다른 reviewer(`requirement`, `dependency`, `concurrency`, `api_contract`, `user_guide_sync`) 5명이 `git status --short` 로 이 미커밋 상태를 관측·보고했다. `testing` reviewer 가 `git show HEAD:<path>` 로 원문을 확인 후 `Write` 로 복원했고, 통합 시점 `git status --short` 재확인 결과 저장소는 깨끗하다(이 리뷰 세션 자신의 출력 디렉터리만 untracked). 각 발견사항 판정은 모두 committed HEAD(`64f0e937b`) 기준으로 이뤄졌다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `validation.pipe.spec.ts` 의 신규 테스트가 `UNVALIDATED_METATYPES` 를 **자기참조 루프**(`for (const metatype of UNVALIDATED_METATYPES)`)로 순회해, 배열에서 원소가 하나 빠져도 이 파일 단독으로는 탐지하지 못한다. `Number` 원소 제거 뮤턴트를 직접 적용해 실측한 결과 이 spec 파일만 실행하면 7/7 전부 GREEN(freeze 단언도 이 루프 단언도 걸리지 않음). 실제 방어는 `request-body-advertised.spec.ts` 의 대조군 라우트(`numberBody`)가 대신하고 있어(뮤턴트 적용 시 2건 RED) 실질 위험은 낮으나, 테스트 이름이 암시하는 "목록 보호"가 이 파일 단독으로는 거짓이다. | `codebase/backend/src/common/pipes/validation.pipe.spec.ts:123-131` | `for (const metatype of UNVALIDATED_METATYPES)` 대신 고정 기대 배열(`[String, Boolean, Number, Array, Object]`)을 순회하거나, `expect(UNVALIDATED_METATYPES).toStrictEqual([...])` 단언을 추가해 이 파일 하나로도 원소 축소를 탐지하게 한다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / api_contract | 신설 가드는 "본문 스키마 광고의 존재"만 강제하고 "입력 검증 자체"는 강제하지 않는다 — `@ApiBody({schema:{}})` 로 면제된 라우트(웹훅 수신 등)는 광고 이후에도 원시 본문이 검증 없이 통과한다. spec Rationale(`swagger.md:750-766`)이 명시적으로 채택한 기존 트레이드오프이며 이번 PR 이 새로 연 구멍이 아니다. | `validation.pipe.ts:34-40,18-24`, `swagger.md:750-766` | 조치 불요(스코프 밖). 면제 라우트의 다운스트림 처리 안전성은 별도 후속 감사 대상으로 남을 만함. |
| 2 | performance / dependency | 신설 가드·헬퍼(`request-body-advertised*`, `bodyArgIndexes`)는 Jest 전용 정적 검사이며 `tsconfig.build.json` exclude 로 프로덕션 번들에서 이미 제외됨 — 런타임/번들 크기 영향 없음 | `repo-guards/__tests__/request-body-advertised-guard.ts`, `shared/testing/swagger-probe.ts` | 조치 불요. |
| 3 | security / maintainability / side_effect / concurrency / performance | `UNVALIDATED_METATYPES` 를 지역 배열 → `Object.freeze` 된 export 상수로 승격 — 1R WARNING(전역 가변 상태) 해소 확인. 부수적으로 요청당 배열 재할당이 사라져 성능상 소폭 긍정적, singleton 파이프의 동시 요청 간 공유도 freeze + read-only 소비로 안전 | `validation.pipe.ts:18-24,92-94`, `validation.pipe.spec.ts`(`isFrozen` 단언) | 조치 불요(이미 해결됨). |
| 4 | requirement / api_contract | 다중 키 지정 `@Body('a')`/`@Body('b')` 는 핸들러당 `@ApiBody` 하나만 있어도 전부 "광고됨"으로 통과 — OpenAPI `requestBody` 가 오퍼레이션당 하나라는 모델과 정합적인 의도된 스코프. 저장소에 다중 키 라우트 0곳(실측) | `request-body-advertised-guard.ts` `advertisesBody`(~59-64행) | 조치 불요. 다중 키 라우트 발생 시 전용 대조군 추가 검토. |
| 5 | requirement | `isExcluded()` 는 메타데이터 **존재 여부**만 보므로 `@ApiExcludeEndpoint(false)`/`@ApiExcludeController(false)` 처럼 명시적 "제외 안 함"도 "제외됨"으로 오판 가능 — 형제 가드와 동일한 기존 패턴, 저장소에 `disable:false` 사용 0건(실측) | `request-body-advertised-guard.ts` `isExcluded`(~49-57행) | 이번 PR 범위 밖. 실사용 사례 발생 시 재검토. |
| 6 | architecture / maintainability / dependency | Swagger 리플렉션 메타데이터 키 상수(`SWAGGER_EXCLUDE_ENDPOINT`/`SWAGGER_EXCLUDE_CONTROLLER`)가 형제 가드(`forbidden-response-codes-guard.ts`)와 문자 그대로 중복 — 2번째 발생, 프로젝트 채택 "3번째부터 추출" 문턱 미달. `@nestjs/swagger` 가 `dist/constants` 를 공식 export 하지 않아(`exports` 필드 확인) 손으로 옮겨 적은 값이며, caret 범위(`^11.4.5`)로 마이너/패치 업그레이드 시 조용히 갈릴 이론적 여지 있음(fail-closed 설계라 조용한 오탐 통과는 아님) | `request-body-advertised-guard.ts:16-18` vs `forbidden-response-codes-guard.ts:27-28` | 조치 불요. 3번째 가드 발생 또는 `@nestjs/swagger` 메이저 업그레이드 시 공유 모듈 추출 검토. |
| 7 | maintainability | `'design:paramtypes'` 리플렉션 키 문자열이 3곳에서 반복 | `request-body-advertised-guard.ts:83`, `swagger-probe.ts:158`, 기존 소비처 | 조치 불요. 4번째 소비처 발생 시 공유 상수 검토. |
| 8 | architecture | `shared/testing/swagger-probe.ts` 가 "OpenAPI 문서 조회"와 "라우트 인자 reflection" 두 관심사를 한 파일에 계속 누적 중 — 아직 분리를 요구할 단계 아님 | `swagger-probe.ts` 전체 | 조치 불요. 3번째 관심사 축 추가 시 파일 분리 검토. |
| 9 | scope | `swagger-probe.ts` JSDoc 문구 정정(곁가지)이 가드 신설 커밋에 섞여 있으나 plan 에 사전 추적·승인됨, 1R 에서도 이미 INFO 로 식별 | `swagger-probe.ts` `bodyParamDesignType` JSDoc | 조치 불요. |
| 10 | testing | `swagger-probe.spec.ts` 의 `bodyArgIndexes` 오름차순 정렬 단언은 정적으로 타당하나 이번 라운드에서 별도 뮤테이션 검증은 하지 않음(plan 표 R6 KILLED 주장 신뢰) | `swagger-probe.spec.ts:100-106` | 조치 불요, 참고 기록. |
| 11 | requirement | `plan/in-progress/request-body-guard.md` 체크리스트의 `/ai-review`·`--impl-done` 항목 미체크 — 마무리 커밋에서 일괄 반영 예정인 정상 진행 중 상태(스테일 아님) | `plan/in-progress/request-body-guard.md` | 2R 이 Critical/Warning 0 으로 수렴 시 마무리 커밋에서 체크·`complete/` 이동 처리. |
| 12 | documentation / user_guide_sync / database | 문서화·유저가이드 동반 갱신·DB 관점 모두 해당 없음/발견 없음 (전 22개 doc-sync-matrix trigger 대조 완료, spec-major-change 행은 이미 consistency-check 2회로 커버) | — | 해당 없음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 검증 스킵은 기존 설계, 신규 취약점 없음 |
| performance | NONE | 배열 리터럴 제거로 오히려 개선, 가드는 CI 전용 |
| architecture | NONE | 형제 가드와 일관된 구조, 순환 의존 없음 |
| requirement | LOW | spec fidelity 완전 일치, 스코프 경계 항목들은 기존 수용분 |
| scope | NONE | 39개 파일 전수 대조, 곁가지 1건은 plan 승인됨 |
| side_effect | NONE | 신규 가드/헬퍼 전부 순수 함수, 전역 상태 freeze 로 방어 |
| maintainability | NONE | 1R Warning 2건 해소 확인, 잔여는 전부 기존 INFO 재확인 |
| testing | LOW | 신규 테스트 1개 자기참조 커버리지 갭(WARNING, 실측) |
| documentation | NONE | 발견 없음 |
| dependency | NONE | 신규 패키지 없음, 신설 코드 build exclude 확인 |
| database | NONE | 해당 없음 |
| concurrency | NONE | freeze + stateless 설계로 경쟁 조건 없음 |
| api_contract | LOW | 런타임 계약 변경 없음, 잔여 갭은 문서화된 기존 트레이드오프 |
| user_guide_sync | NONE | doc-sync-matrix 22개 trigger 전수 무매칭 |

## 발견 없는 에이전트

documentation, database, user_guide_sync (해당 없음/발견 없음 명시)

## 권장 조치사항

1. `validation.pipe.spec.ts:123-131` 의 `UNVALIDATED_METATYPES` 순회 테스트를 고정 기대 배열 비교(`toStrictEqual`) 또는 fixed literal 순회로 바꿔 자기참조 커버리지 갭을 해소한다(WARNING #1).
2. (선택, 저위험) 마무리 커밋 시 `plan/in-progress/request-body-guard.md` 체크리스트 완료 처리 및 `plan/complete/` 이동을 잊지 말 것.
3. push 전 `git status --short` 로 워크트리가 committed 상태와 완전히 일치하는지 최종 확인(이번 통합 시점 확인 완료 — 깨끗함).

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행(그중 7명은 router_safety 강제 목록: documentation, maintainability, requirement, scope, security, side_effect, testing). forced 7명 전원 결과 확보됨. 제외된 reviewer 없음.
