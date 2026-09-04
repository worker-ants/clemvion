# 문서화(Documentation) 리뷰

## 리뷰 범위

- `CHANGELOG.md` — `GET /api/executions/workflow/:workflowId` 의 `workflowId` 쿼리 파라미터 제거 항목 신설
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 죽은 `workflowId?: string | null` 필드 제거 + 클래스 JSDoc 신설
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` 예외 rationale JSDoc 갱신(실사례 0건 반영)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 해당 항목 체크박스 종결 + 선행조건 트래커 표 동기화

## 발견사항

- **[INFO]** JSDoc/plan/CHANGELOG 세 곳이 서로 다른 실측 시점 문구를 쓰지만 수치는 일치함(교차검증 완료)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:109`(게이트), `CHANGELOG.md:31`(게이트), `plan/in-progress/spec-draft-nullable-notation-followups.md:321`(게이트)
  - 상세: 세 위치 모두 "`Api*` 필드 1,095개 중 `@Transform` 동반 17개, null 축 불일치 0개"를 동일하게 서술한다. `plan/.../spec-draft-nullable-notation-followups.md:173` 부근에 남아 있는 "1,096개" 스냅샷은 이번 diff 대상이 아니고, 그 문서 자신이 "이 표는 계약 거짓 9곳 수정 적용 *전* 스냅샷이다" · "정량 기록은 잰 시점의 값" 이라고 명시적으로 캐비엇을 달아 두고 있어 stale 이 아니라 의도된 시점 고정이다. 실제 저장소 grep 결과 "1,096"/"18개" 잔존 참조가 이 파일 한 곳(캐비엇 포함)뿐임을 확인했다.
  - 제안: 조치 불요 — 기록용으로 남겨 둔 것으로 판단.

- **[INFO]** 신규 JSDoc·CHANGELOG 가 스펙 문서를 줄 번호로 고정 인용한다(`2-navigation/14-execution-history.md:345`)
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:11`(게이트), `CHANGELOG.md:25`(게이트)
  - 상세: 두 곳 모두 실측 근거로 `spec/2-navigation/14-execution-history.md:345` 를 인용한다. 현재 실측(grep)으로는 정확히 그 줄에 "페이지네이션, 상태 필터, 정렬" 문구가 존재해 인용이 맞다. 다만 그 spec 문서가 향후 편집되면 줄 번호가 드리프트할 수 있다 — 이 저장소는 CHANGELOG 전반에 걸쳐 이런 줄번호 인용을 광범위하게 이미 채택하고 있어(기존 관례), 이 diff 만의 신규 결함은 아니다.
  - 제안: 조치 불요(기존 관례를 따름). 향후 별도 컨벤션으로 "안정적 앵커 vs 줄 번호" 방침이 결정되면 일괄 정리 대상.

## 점검 관점별 평가

1. **독스트링/JSDoc** — `QueryExecutionDto` 클래스에 제거 사유·근거(경로가 이미 워크플로우 한정 → 쿼리 필터 개념적 성립 불가, `@IsUUID()` 로 인한 400, spec 미약속)를 담은 JSDoc 을 신설했다. `swagger-dto-contract-guard.ts` 의 `@Transform` 예외 rationale 도 "실사례가 있다"에서 "실사례 0건이지만 원리는 유지"로 정확히 갱신됐다. 둘 다 공개 API/가드 로직 변경에 상응하는 양질의 문서다.
2. **README 업데이트** — 신규 기능·설정이 아니라 죽은 쿼리 파라미터 제거이므로 README 갱신 대상 없음. 해당 없음.
3. **API 문서** — OpenAPI 는 NestJS `SwaggerModule` 런타임 생성이고 저장소에 정적 openapi.json/yaml 산출물이 커밋돼 있지 않아, 데코레이터 제거만으로 문서가 자동 반영된다. `spec/2-navigation/14-execution-history.md:345` 는 애초에 `workflowId` 쿼리를 약속한 적이 없어(실측 확인) 정정 불요라는 CHANGELOG 의 주장도 grep 으로 재확인했다. 프런트 `ExecutionListParams`(`codebase/frontend/src/lib/api/executions.ts:87-93`)에도 해당 필드가 없음을 확인 — CHANGELOG 의 소비자 현황 서술이 정확하다.
4. **주석 정확성** — 가드 파일의 `@Transform` 예외 JSDoc 이 옛 예시(`QueryExecutionDto.workflowId`)를 참조하던 것을 필드 제거에 맞춰 정확히 갱신했다. 다른 위치(예: `swagger.md`, `2-api-convention.md`)에 이 필드를 여전히 언급하는 stale 주석/문서는 없음을 grep 으로 확인했다.
5. **인라인 주석** — 이번 diff 의 로직(필드 제거)은 단순 삭제라 복잡한 인라인 주석이 필요한 지점은 없다. 기존 클래스 JSDoc 이 오히려 삭제 사유를 상세히 남겨 향후 "왜 이 필드가 없는가"를 묻는 사람에게 충분한 컨텍스트를 준다.
6. **변경 이력** — CHANGELOG 항목이 영향(consumer 현황 실측, breaking 여부, 가드 예외 부수효과)까지 포함해 매우 상세하다. 저장소의 기존 CHANGELOG 항목들과 형식·톤이 일관된다.
7. **설정 문서** — 신규 env/설정 없음. 해당 없음.
8. **예제 코드** — 별도 사용 예제 필요 없음(쿼리 파라미터 삭제이며, 클라이언트 사용법 예제가 아니라 "더 이상 보내지 말라"는 안내가 전부). CHANGELOG 의 영향 섹션이 그 역할을 충분히 수행한다.

## Plan 문서 위생 점검

`plan/in-progress/spec-draft-nullable-notation-followups.md` 는 항목을 닫으면서 본문 체크박스(`## 후속` 섹션)와 하단 트래커 표(`## 종결 조건`)를 **함께** 갱신했다 — 과거 세션에서 반복됐던 "체크박스만 닫고 트래커 표는 stale 로 남기는" 패턴이 이번엔 재발하지 않았다. `spec-sync-external-interaction-api-gaps.md` 류의 다른 트래커로의 교차 참조는 이 diff 범위 밖이라 확인하지 않았다.

## 요약

이번 변경은 죽은 쿼리 파라미터(`QueryExecutionDto.workflowId`) 제거를 CHANGELOG·클래스 JSDoc·가드 rationale JSDoc·plan 트래커 네 곳에서 일관되게 문서화했다. 네 문서 모두 같은 실측 수치(`Api*` 필드 1,095개, `@Transform` 17개, null 축 불일치 0개)를 정확히 공유하고, 실제 소비자 부재(백엔드 미소비·프런트 타입 부재·spec 미약속)를 grep 으로 재확인해도 CHANGELOG 의 주장과 일치했다. README·API 문서·설정 문서·예제 코드는 이 변경 성격상 해당 사항이 없고, 유일하게 남는 것은 줄 번호 기반 spec 인용의 드리프트 위험뿐인데 이는 저장소 전반의 기존 관례이지 이 diff 가 새로 만든 문제가 아니다. CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
