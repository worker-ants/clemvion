# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 OpenAPI 스키마 정밀화(문서화/계약 선언) 변경으로 런타임 응답은 불변. Critical 없음, WARNING 1건(신규 e2e 케이스의 vacuous 방지 원칙 미적용)만 존재. forced 화이트리스트 8명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | e2e "I. 버전 복원" 테스트가 갱신 가지의 노드 개수를 직접 단언하지 않는다 — C 케이스는 `save.body.data.nodes).toHaveLength(5)` 로 원소 수부터 고정해 "빈 배열이면 대조가 vacuous" 를 방지하는데, I 케이스는 `edges` 만 `toHaveLength(2)` 로 고정하고 `nodes` 는 고정하지 않는다. `saved`/`restored` 양쪽이 우연히 같은(빈) 값으로 수렴해도 `idsOf` 비교만으로는 못 걸러낼 잠재 여지가 있다(다만 같은 코드 경로를 쓰는 C 케이스가 간접 방어해 실질 위험도는 낮음). | `codebase/backend/test/workflow-crud.e2e-spec.ts:624-628` | restore 호출 전 `saved.body.data.nodes).toHaveLength(5)` 를 추가해 C 와 대칭을 맞추고 테스트 격리 원칙을 지킬 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `NodeDto.config`/`EdgeDto.condition` 이 `additionalProperties: true` 무제한 객체로 OpenAPI 에 노출 — 기존 설계 연장선, 이번 PR 이 새로 만든 노출 아님 | `node-response.dto.ts:35`, `edge-response.dto.ts:34` | 조치 불요. 향후 config 스키마에 시크릿성 필드 추가 시 마스킹/분리 정책 유지 여부만 별도 확인 |
| 2 | requirement/api_contract | `NodeDto`/`EdgeDto` 의 optional+nullable "금지 조합"(§5-4) drift 가 이번 두 엔드포인트에 처음 가시화됨 — `swagger-dto-contract.spec.ts` `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 이미 사전 동결된 기존 결함, 이 PR 책임 아님 | `workflow-response.dto.ts:80-85`, `node-response.dto.ts`(`containerId`/`description`/`toolOwnerId`), `edge-response.dto.ts`(`condition`) | 조치 불요 — 기존 drift 목록 처분 범위 |
| 3 | requirement/documentation/side_effect | `ExportWorkflowDto.nodes`/`.edges` 는 같은 문제(타입 없는 배열)를 안고 있으나 의도적으로 스코프 밖 — export 포맷은 인덱스 정규화라 `NodeDto`/`EdgeDto` 재사용 불가, 후속 트래커에 이미 등재 | `workflow-response.dto.ts:162-167`; 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md:1313-1320` | 조치 불요(별도 트래커 항목으로 이미 등재됨) |
| 4 | requirement/scope/documentation | 트래커 원 항목(`spec-draft-nullable-notation-followups.md:1307`, `CanvasSaveResultDto.nodes/.edges 타입 없는 배열`)이 아직 미체크 — `canvas-save-typed.md` 자체 체크리스트에도 "트래커 항목 닫기" 가 `[ ]` 미완으로 명시돼 있어 `--impl-done` 이후 마무리 단계로 의도적으로 미룸 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1307` | `--impl-done` 전에 트래커 원 항목 체크박스가 실제로 `[x]` 로 바뀌는지 확인 |
| 5 | scope | 사전 존재하던 import 2줄 분할 패턴(같은 모듈에서 오는 import 가 두 문장)에 이번 PR 이 한 줄 추가 — 이 diff 가 만든 분리 아님 | `workflow-crud.e2e-spec.ts:13` | 이번 PR 책임 밖, 조치 불요 |
| 6 | side_effect/api_contract | OpenAPI 로 광고하는 응답 스키마가 넓어짐(무제약 object → `NodeDto`/`EdgeDto` 참조) — 외부 codegen 소비자가 있다면 생성 타입이 좁아짐(breaking 아님). in-repo 소비자는 이 DTO 를 참조하지 않음(grep 0건) | `workflow-response.dto.ts:79-85` | 외부 소비자에게 스키마 엄격화 고지(코드 조치 불요). CHANGELOG 에 이미 명시됨 |
| 7 | side_effect | 순환 import 위험 없음 확인(`workflows/dto → nodes/dto`, `workflows/dto → edges/dto` 단방향) | `workflow-response.dto.ts:2-3` | 조치 불요 |
| 8 | maintainability | 신규 클래스 내부 주석이 형제 프로퍼티 JSDoc(`/** */`)과 다른 스타일(`//`)을 사용 | `workflow-response.dto.ts:76-77` | JSDoc 블록으로 통일하거나 인접 프로퍼티 doc 에 이유를 합쳐 적을 것 |
| 9 | maintainability | 저장 응답 형태 대조 3줄이 C/I 두 e2e 테스트에 거의 반복 | `workflow-crud.e2e-spec.ts` (C, I 블록) | 현재 수준은 유지 가능. 세 번째 호출부가 생기면 공용 헬퍼 추출 고려 |
| 10 | testing | 신규 유닛 테스트는 `type`/`$ref`/`required` 만 확인하고 `nullable` 은 다루지 않음(범위 내 필요충분, 기존 drift 는 별도 트래커) | `workflow-response.dto.spec.ts:19-29` | 조치 불요 |
| 11 | testing | 뮤턴트 검증(M1~M3)은 스키마 선언 되돌리기/필드 제거만 다루고 "빈 배열 vacuous 통과" 클래스는 커버 범위 밖 — 위 WARNING 이 지적하는 형태는 이번 뮤턴트 표로 판별 안 됨 | `plan/in-progress/canvas-save-typed.md` | WARNING 1 조치 시 함께 보강 고려 |
| 12 | documentation | plan 체크리스트가 `/ai-review`·`--impl-done`·트래커 항목 닫기 세 줄을 미완으로 남긴 채 커밋됨 — 정상적인 중간 상태 | `plan/in-progress/canvas-save-typed.md` (체크리스트 섹션 67-74행) | 리뷰·수정 반영 후 `--impl-done` → 체크리스트 완료 → `plan/complete/` 이동 → 트래커 닫기를 마무리 커밋에서 처리 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 문서화 변경, 신규 취약점 없음. `config`/`condition` 비정형 필드 노출은 기존 설계 |
| requirement | NONE | 엔티티-DTO 1:1 매핑 확인, spec 최상위 키만 규정하여 충돌 없음, 캐너리 판별력 실측 확인 |
| scope | NONE | 단일 목적에 정확히 수렴, over-reach 없음 |
| side_effect | LOW | OpenAPI 계약 확장(비파괴적), 런타임 직렬화 불변, 순환 import 없음 |
| maintainability | NONE | 스코프 작고 목적 명확, 스타일 사소한 불일치 2건만 |
| testing | LOW | 유닛+e2e 양쪽 구비, 뮤턴트 3건 KILLED, 다만 I 케이스 vacuous 방지 원칙 미적용 |
| documentation | NONE | CHANGELOG/JSDoc/주석 모두 적절, plan 체크리스트 마무리만 남음 |
| api_contract | NONE | wire 불변, 하위 호환 breaking 없음, 계약 대조 테스트로 검증됨 |

## 발견 없는 에이전트

없음 (forced 8명 전원 INFO 이상 발견사항 최소 1건씩 보고).

## 권장 조치사항
1. (WARNING) `workflow-crud.e2e-spec.ts` "I. 버전 복원" 테스트에 `saved.body.data.nodes).toHaveLength(5)` 단언을 restore 호출 전에 추가해 C 케이스와 대칭을 맞추고 vacuous 통과 가능성을 차단한다.
2. 병합 완료 후 마무리 커밋에서 `--impl-done` 실행 → `plan/in-progress/canvas-save-typed.md` 체크리스트 완료 → `plan/complete/` 이동 → `spec-draft-nullable-notation-followups.md:1307` 트래커 항목(`[x]`) 닫기를 함께 처리한다.
3. (선택) `workflow-response.dto.ts:76-77` 의 `//` 주석을 인접 JSDoc 스타일로 통일한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — forced 7명 전원 결과 확보됨(누락 없음). api_contract 는 router 가 정규 선택.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(문서화 전용, 런타임 로직 불변)과 무관 |
  | architecture | router 판단상 이번 변경과 무관 |
  | dependency | router 판단상 이번 변경과 무관 |
  | database | router 판단상 이번 변경과 무관 |
  | concurrency | router 판단상 이번 변경과 무관 |
  | user_guide_sync | router 판단상 이번 변경과 무관 |