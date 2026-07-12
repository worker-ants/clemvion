# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 직전 라운드(20_08_27) WARNING — plan 완료 노트 stale — 이번 diff 에서 정정 확인
  - 위치: `plan/in-progress/eia-context-schema-followups.md` L33 (완료 노트)
  - 상세: 직전 documentation 리뷰(`review/code/2026/07/12/20_08_27/documentation.md`)는 완료 노트가 상수명(`EXECUTION_STATUS_VALUES`, `EIA_` 접두 누락)·spread 참조·테스트 건수(15)를 최종 코드 이전 스냅샷 그대로 남겨 stale 하다고 지적했다(WARNING). 현재 파일(`plan/in-progress/eia-context-schema-followups.md` L33)을 직접 읽어 대조한 결과, 완료 노트가 `EIA_EXECUTION_STATUS_VALUES`(정확한 최종 심볼명) · "swagger `enum` 은 SoT 직접 참조(spread 없음)" · "DTO/SoT 스키마 회귀 21건" 으로 갱신돼 실제 코드(`execution-status.literal.ts` export 명, `execution-status-response.dto.ts`/`interact-ack-response.dto.ts` 의 `enum: EIA_EXECUTION_STATUS_VALUES` 직접 참조)와 정확히 일치함을 확인했다. 이 WARNING 은 해소된 것으로 판정한다.
  - 제안: 없음 (이미 반영 확인됨).

- **[INFO]** 직전 라운드 INFO — swagger.md §5-1 `*.literal.ts` 패턴 후속 미추적 — 이번 diff 에서 등재 확인
  - 위치: `plan/in-progress/eia-context-schema-followups.md` L35 "> **잔여 (별 slice)**" 안내문
  - 상세: 직전 리뷰는 "RESOLUTION.md I5 가 약속한 swagger.md §5-1 후속 문서화가 plan 백로그 어디에도 추적되지 않는다"고 지적했다(INFO). 현재 L35 에 "swagger.md §5-1 에 `*.literal.ts` 형제 DTO enum 공유 SoT 패턴 명문화(planner, ai-review I5→20_08_27 I1)" 항목이 추가되어 후속이 이제 추적 가능하다. `spec/conventions/swagger.md` §1-4/§5-1 을 직접 확인한 결과 이 패턴(형제 DTO 간 enum 공유 시 로컬 `*.literal.ts` + `as const` + 엔티티 비파생) 자체는 아직 spec 본문에 반영되지 않았으나, planner 트랙 후속으로 명시적으로 남겨진 상태이므로 비차단이다.
  - 제안: 없음 (planner 트랙 후속으로 이미 적절히 스코프됨).

- **[INFO]** 신규 회귀 테스트 파일의 자기설명·상호 참조 정확성 검증
  - 위치: `execution-status.literal.spec.ts`(신규), `interact-ack-response.dto.spec.ts`(신규)
  - 상세: 두 파일 모두 모듈/describe 레벨 주석이 "이 파일은 무엇을 검증하고, 무엇은 다른 파일에 위임하는지"를 명시한다 — `execution-status.literal.spec.ts` JSDoc 은 "소비 DTO spec 은 'enum 이 SoT 를 반영하는지'만 검증하고, SoT 배열 자체의 순서·집합 불변식은 여기서 고정한다"고 책임 분리를 서술하고, 실제로 두 DTO spec(`execution-status-response.dto.spec.ts`/`interact-ack-response.dto.spec.ts`)의 신규 `it()` 설명도 "SoT 순서·집합 불변식은 execution-status.literal.spec" 이라고 상호 참조한다. 실제 코드 대조 결과 이 책임 분리 서술과 구현이 정확히 일치한다(순서 pin·엔티티 집합 동등성은 `execution-status.literal.spec.ts` 에만 있고, DTO spec 은 "DTO↔SoT" 참조 assertion 만 가짐). `interact-ack-response.dto.spec.ts` 헤더의 상대링크(`../../../../../../../spec/conventions/swagger.md`, `.../spec/5-system/14-external-interaction-api.md`)도 실제 파일 위치 기준으로 정확히 resolve 되고, 인용한 `§1-4`(enum 선언 규약 포함)·`§5.1`/`§5.4`(EIA 인터랙션 명령/취소) 섹션이 각 문서에 실재함을 확인했다.
  - 제안: 없음.

- **[INFO]** `execution-status.literal.ts` JSDoc 의 사실 주장 재검증 (엔티티/동명 상수 순서 차이)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` 상단 모듈 JSDoc
  - 상세: JSDoc 은 (a) `workflow-assistant/tools/explore-tools.service.ts` 의 동명 `EXECUTION_STATUS_VALUES` 가 "값 순서가 다른 별개 도메인 상수"라고 주장하고, (b) 엔티티 `ExecutionStatus` 순서가 wire enum 순서와 다르다고 주장한다. 코드로 직접 대조한 결과 둘 다 정확하다 — 엔티티(`execution.entity.ts` L14-21) 순서는 `pending,running,completed,failed,cancelled,waiting_for_input`, `explore-tools.service.ts` 의 동명 상수 순서도 `pending,running,completed,failed,cancelled,waiting_for_input` 로 wire 순서(`pending,running,waiting_for_input,completed,failed,cancelled`)와 다르다. 근거를 지어내지 않고 실측 가능한 사실만 서술한 사례.
  - 제안: 없음.

## 검증한 사항 (문제 없음)

- CHANGELOG.md 미기재는 프로젝트 관례와 일치한다 — 리포지토리 최근 항목(웹채팅 i18n·truncation·reaper 등)은 모두 wire/사용자-가시 변경만 기록하며, 과거 유사한 순수 내부 리팩터(예: `spec-links.ts` 중복 정리)도 CHANGELOG 항목이 없다. 이번 변경은 plan 문서·RESOLUTION.md 모두에 "런타임·OpenAPI wire 무변경(값·순서 동일)" 으로 명시된 behavior-preserving 리팩터이므로 CHANGELOG 갱신 불요.
- README/API 문서 갱신 불요 — 엔드포인트 계약(`POST /api/external/executions/:id/interact`·`/cancel`·`GET .../status`)의 요청/응답 wire, enum 값·순서 자체는 무변경이며 `@ApiProperty({ enum: ... })` 데코레이터가 OpenAPI 문서를 자동 생성하므로 별도 수기 API 문서를 갱신할 필요가 없다.
- 신규 환경변수·설정 옵션 없음 — 순수 TS 타입/상수 리팩터라 설정 문서화 대상이 아니다.
- `execution-status-response.dto.ts` / `interact-ack-response.dto.ts` 의 기존 클래스·필드 JSDoc(예: `waiting_for_input 상태에서만 실값`, `currentStatus` 의 `description` 문구, EIA §5.1/§5.4 참조)은 이번 diff 로 stale 해지지 않았다 — 변경은 `status`/`currentStatus` 필드의 타입·enum 소스만 로컬 SoT 로 치환했을 뿐 wire 의미·설명 문구는 그대로다.
- `review/code/2026/07/12/{19_49_01,20_08_27}/` 하위 파일(SUMMARY·RESOLUTION·subagent 리포트·`_retry_state.json`·`meta.json`)이 그대로 커밋된 것은 저장소 관례(`review/` 는 gitignore 대상 아님, 리뷰 산출물도 커밋)와 일치한다.
- `plan/in-progress/eia-context-schema-followups.md` 의 `worktree` frontmatter(`eia-context-dev-cleanups-109831`)는 현재 작업 worktree 와 일치한다.

## 요약

이번 diff 는 직전 두 라운드(19_49_01, 20_08_27)의 ai-review WARNING/INFO 가 모두 반영된 이후의 최종 상태로, 문서화 관점에서 남은 실질 결함이 없다. 직전 라운드가 지적한 "plan 완료 노트가 상수명(`EIA_` 접두 누락)·테스트 건수 기준 stale" WARNING 은 현재 plan 파일을 직접 대조해 정확히 정정됐음을 확인했고, "swagger.md §5-1 후속이 plan 에 미등재" INFO 도 "잔여 (별 slice)" 목록에 명시적으로 추가되어 유실 위험이 해소됐다. 신규 회귀 테스트 파일(`execution-status.literal.spec.ts`, `interact-ack-response.dto.spec.ts`)은 책임 분리를 서술한 주석·자기설명적 테스트명·정확한 상대링크를 갖추고 있으며, `execution-status.literal.ts` JSDoc 이 주장하는 엔티티/동명 상수와의 순서 차이도 코드 대조로 재검증해 정확함을 확인했다. CHANGELOG·README·API 문서·설정 문서 어느 것도 이번 순수 내부 리팩터에 대해 갱신이 필요하지 않으며, 유일하게 남은 항목(swagger.md §5-1 본문에 `*.literal.ts` 공유 SoT 패턴 명문화)은 이미 planner 트랙 후속으로 적절히 스코프되어 비차단이다.

## 위험도

NONE
