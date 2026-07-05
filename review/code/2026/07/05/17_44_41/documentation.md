# 문서화(Documentation) Review

## 발견사항

- **[INFO]** JSDoc 정정 정확성 확인 — swagger 자동 반영 대상
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:382-392` (`cronExpression`/`timezone`/`nextRunAt` 3개 필드 JSDoc)
  - 상세: `codebase/backend/nest-cli.json` 에 `"introspectComments": true` 가 설정되어 있어, `@nestjs/swagger` 플러그인이 이 JSDoc 주석(`/** ... */`)을 빌드 시점에 Swagger `description` 으로 그대로 끌어올린다. 즉 이번 JSDoc 수정("단건 조회 시에만" → "목록·단건 모두")은 내부 코드 주석에 그치지 않고 실제 공개 API 문서(Swagger UI)에 반영되는 **user-facing 변경**이다. `codebase/backend/src/modules/triggers/triggers.service.ts:824-856` 의 `findAll()` 구현(schedule 타입 트리거 id 를 모아 `scheduleRepository.find({ where: { triggerId: In(...), workspaceId } })` 배치 1회 조회 후 `Object.assign` 으로 enrichment)과 JSDoc 문구가 정확히 일치한다. `spec/2-navigation/2-trigger-list.md §2.1` (목록 행에 Schedule 태그 + Cron + 다음 실행 시각 표시 요구, 라인 58) 도 이 동작을 이미 요구하고 있었으므로 코드·주석·spec 3자가 이번 변경으로 정합화됐다.
  - 제안: 없음 (정정이 정확함을 확인).

- **[INFO]** CHANGELOG 항목 기술적 정확성 확인
  - 위치: `CHANGELOG.md:34-38` ("V-10" 항목)
  - 상세: 항목이 서술하는 구현 세부(단건 `findOneDetail` 에만 있던 enrichment, N+1 회피 배치 조회, `workflow-list §2.4`/`schedules.findAll` 선례, SoT 스펙 경로)가 실제 diff(`triggers.service.ts`, `triggers.service.spec.ts`)와 부합한다. "spec 변경 불요" 판단도 위 확인대로 타당 — `2-trigger-list.md §2.1` 이 이미 이 표시를 요구했고 코드가 그 요구를 뒤늦게 충족한 사례이므로 spec 문구 변경은 필요 없다.
  - 제안: 없음.

- **[INFO]** 관련 spec/API 문서 추가 갱신 불요 확인
  - 위치: `spec/2-navigation/2-trigger-list.md §3` (API 표), `spec/data-flow/10-triggers.md`
  - 상세: `GET /api/triggers` API 표(§3, 라인 151)는 응답 필드 목록을 나열하지 않고 쿼리 파라미터·페이지네이션 형식만 규정하므로 이번 필드 enrichment 변경으로 갱신할 내용이 없다. `data-flow/10-triggers.md` 에도 목록-레벨 스케줄 enrichment 부재를 전제로 한 stale 서술이 없음을 확인했다(grep 결과 관련 텍스트 없음).
  - 제안: 없음.

- **[INFO]** 인라인 주석 품질
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:824-828` (`findAll` 내 신규 블록 주석)
  - 상세: `[V-10 / spec 2-trigger-list §2.1]` 태그로 근거 spec 위치를 명시하고, N+1 회피 이유·선례(workflow-list §2.4, schedules.findAll)까지 기술해 향후 유지보수자가 "왜 이렇게 짰는지" 를 코드만 보고 이해할 수 있다. 프로젝트 관례(SoT 주석 태깅)와 일치.
  - 제안: 없음.

- **[INFO]** 테스트 코드가 문서 역할 겸함
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:459-607`
  - 상세: 3개 테스트 케이스(배치 enrichment, schedule 행 없음 시 skip, 매칭 schedule row 부재 시 필드 미설정)가 새 동작의 경계 조건을 명세 수준으로 문서화하고 있어 별도 사용 예제 문서는 불필요.
  - 제안: 없음.

## 요약

`TriggerDto` 의 `cronExpression`/`timezone`/`nextRunAt` JSDoc 정정("단건 조회 시에만" → "목록·단건 모두")은 실제 `findAll()` 구현 변경과 정확히 일치하며, 이 JSDoc 은 `introspectComments: true` 설정으로 Swagger 응답 스키마 description 에도 그대로 반영되는 공개 API 문서이므로 이번 수정은 실질적인 API 문서 정확성 개선이다. `CHANGELOG.md` 신규 항목은 구현 세부·N+1 회피 근거·SoT 스펙 경로를 정확히 서술하고 있고, `spec/2-navigation/2-trigger-list.md §2.1` 이 이미 목록 행의 Cron·다음 실행 시각 표시를 요구하고 있었으므로 "spec 변경 불요" 판단도 타당하다. 관련 spec·data-flow 문서에 정합화가 필요한 stale 서술은 발견되지 않았고, 신규 테스트 3건이 동작 경계를 문서 수준으로 커버한다. 문서화 관점에서 추가 조치가 필요한 항목은 없다.

## 위험도

NONE
