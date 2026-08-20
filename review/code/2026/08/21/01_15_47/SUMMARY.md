# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 신규 발견 없음. 9개 reviewer(전원 forced whitelist 포함) 전원이 결과를 확보했고, 이전 두 라운드(`00_03_57`, `00_39_27`)가 잡은 CRITICAL 1건(`boolean` 마커 완전 우회)·WARNING 다수(호출부 중복, `isPlainRecord` 재구현, `errors`→`details` 봉투 유실, spec 서술 3곳 stale 프레이밍)가 실코드로 재검증돼 전부 해소 확인됨. 잔여는 전부 INFO 수준의 방어적 보강 제안뿐.

**Forced whitelist 이행 상태**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원이 `ran` 목록에 `success` 로 존재하며 인라인 전문도 전부 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `errors`→`details` 봉투 회귀 방지가 실제 Nest 파이프라인(컨트롤러→`GlobalExceptionFilter`→HTTP 직렬화)을 한 번에 태우는 e2e 없이, 서로 다른 두 unit 스펙 조합에만 의존한다 | `executions-rerun.service.spec.ts`(`[회귀]` 테스트), `http-exception.filter.spec.ts`, `test/re-run.e2e-spec.ts`(미보유) | `re-run.e2e-spec.ts`/`manual-trigger-default-param.e2e-spec.ts` 에 `'***'` 재제출 시 실제 HTTP 400 `error.details[0].code === 'MASKED_VALUE_RESUBMITTED'` 캐너리 1건 추가 고려 |
| 2 | testing | 깊이 경계 테스트(`nestObj`/`nestArr`)가 동종 중첩만 다루고 object↔array 혼합 중첩은 다루지 않음(로직상 위험은 낮음) | `reject-masked-resubmission.spec.ts` (`[경계]` 테스트 3건) | 혼합 중첩(`p: { a: [{ b: [MARKER] }] }`) 캐너리 1건 추가 고려 |
| 3 | testing | phase-1(raw)은 통과했지만 `resolveTriggerParameters` 가 무관 필드의 진짜 타입 오류로 `coerce_failed` 를 던지면 phase-2(resolve 후 JSON-string 마커) 검사가 아예 실행되지 않는 조합이 미테스트(보안 우회 아님, UX 안내 누락 엣지케이스) | `reject-masked-resubmission.ts` `resolveTriggerParametersRejectingMasked` (raw→resolve 경계) | 알려진 트레이드오프로 `throwIfAny` 상단 docstring 에 한 줄 기록 고려 |
| 4 | side_effect | `MASKED_MARKERS` 가 `export const` 로 승격됐지만 런타임 freeze 없는 `Set` — 타입 우회 시 egress 마스킹·재제출 거부 판정 양쪽이 동시에 조용히 바뀔 수 있음(현재 직접 소비처 없음) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` | `Object.freeze(new Set([...]))` 로 감싸기 고려 |
| 5 | api_contract | Swagger/OpenAPI 표면(`re-run.dto.ts`, `executions.controller.ts`, `workflows.controller.ts`)이 마스킹 마커(`***` 등) 리터럴 예약어화 제약을 문구로 노출하지 않음(기존 문서화 관행과 일치, 외부 소비자 부재 확인됨) | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-25` 등 | 다음 편집 기회에 `inputOverride`/`parameterValues` description 에 한 줄 추가 고려 |
| 6 | maintainability / documentation | 신규 한국어 인라인 주석과 기존 영어 인라인 주석이 같은 `try/catch` 블록에 공존(직전 라운드부터 미해결 INFO, 이번 diff 가 만든 문제 아님) | `codebase/backend/src/modules/workflows/workflows.controller.ts:314-322` | 다음 편집 시 한국어로 통일 검토 |
| 7 | maintainability | `ExecutionsService.reRun` 이 137줄, 6가지 책임(권한/dry-run/chain depth/입력 해석/트리거/audit)을 순차 배치 — 이번 변경으로 조건 분기 1개 추가 | `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`, 420~556행) | 다음에 손댈 기회에 입력 해석 블록을 `resolveRerunInput` 류 헬퍼로 추출 고려 |
| 8 | scope | 공유 tracker 문서에서 이번 작업과 무관한 별도 항목(W5, `Execution.inputData` 응답 의미 반전)이 같은 커밋에 함께 종결됨(근거 명시, 코드 변경 없음, 기존 관례와 일치) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요 — 참고 기록 |
| 9 | requirement | `plan/in-progress/spec-update-masked-reject-framing.md` 의 frontmatter `status: in-progress` 가 이미 spec 실물에 반영된 정정 내용과 어긋남(stale) | `plan/in-progress/spec-update-masked-reject-framing.md` | 별도 plan 정리 턴에서 `complete/` 이동 여부 판단 |
| 10 | user_guide_sync | 신규 field-level 코드 `MASKED_VALUE_RESUBMITTED` 가 frontend 에 ko 매핑이 없음 — 기존 3개 형제 코드(`MISSING_REQUIRED_FIELD` 등)도 동일해 이번 diff 가 새로 만든 이탈 아님. `genericError` 폴백이라 영문 코드 그대로 노출되지는 않음(CRITICAL 기준 미충족) | `trigger-parameter.types.ts`, `codebase/frontend/.../rerun-modal.tsx` | doc-sync 관점 조치 불요. UX 개선 원하면 별도 티켓 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. `isPlainRecord`→`isRecord` 치환·`rawHits` 분리는 순수 리팩터로 판정 경계 불변. 신규 테스트가 이전 CRITICAL(boolean 우회) 재발 방지를 캐너리로 고정 |
| requirement | NONE | 이전 3라운드 누적 CRITICAL 1건 + WARNING 다수 전부 실코드/spec 재검증 완료. webhook/schedule 미적용은 spec 원칙과 일치(SPEC-DRIFT 아님) |
| scope | NONE | 실질 코드 변경 8파일·681줄로 단일 의도 유지. W5 항목 동반 종결(#8)만 참고사항 |
| side_effect | LOW | drop-in 교체·순수 함수 확인. `MASKED_MARKERS` freeze 부재(#4)만 잔여 |
| maintainability | NONE | WARNING(호출부 중복, `isPlainRecord`) 해소 재확인. 주석 언어 혼재(#6)·`reRun` 길이(#7)는 기존 이월 INFO |
| testing | LOW | 20/20 + 47/47 GREEN 직접 실행 확인. e2e 경계 캐너리 부재(#1)·혼합 중첩(#2)·phase 경계 조합(#3) 3건 INFO |
| documentation | NONE | JSDoc·spec 7곳·CHANGELOG 정합 확인. 주석 혼재(#6)·spec §6 표 함수명 미병기는 기존 스타일 연장 |
| api_contract | LOW | 이전 CRITICAL/WARNING 해소 재확인, spec 6곳 정합. Swagger 문구 미노출(#5)만 잔여 |
| user_guide_sync | NONE | frontend 파일 변경 0건, 매트릭스 19/20 미매칭. ko 매핑 갭(#10)은 기존 패턴 이탈 아님 |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상의 INFO 를 보고했으나 CRITICAL/WARNING 은 전원 0건.

## 권장 조치사항

1. (선택, 필수 아님) `re-run.e2e-spec.ts` 또는 `manual-trigger-default-param.e2e-spec.ts` 에 마스킹 마커 재제출 → HTTP 400 `MASKED_VALUE_RESUBMITTED` 캐너리 1건 추가해 컨트롤러↔필터 배선 경계를 e2e 레벨에서도 고정 (#1).
2. (선택) `MASKED_MARKERS` 를 `Object.freeze(new Set([...]))` 로 감싸 런타임 변형 표면을 닫음 (#4).
3. (선택) Swagger description 에 마스킹 마커 예약어화 제약 한 줄 추가 — 다음 DTO/컨트롤러 편집 기회에 (#5).
4. 나머지(#2, #3, #6~#10)는 전부 강제 아님/조치 불요로 처분된 참고 기록 — 별도 실행 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 5명 (아래 표)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 가 이번 diff 범위(서버측 마커 재제출 거부 검증 로직)를 성능 관점 저관련으로 판단 |
  | architecture | 신규 아키텍처 변경 없음(기존 유틸/컨트롤러 배선 재사용) |
  | dependency | 의존성 추가/변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 신규 표면 없음 |