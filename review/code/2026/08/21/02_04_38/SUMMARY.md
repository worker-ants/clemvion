# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 실제 취약점이 아니라 이번 라운드(5라운드째)가 새로 추가한 아키텍처 가드(`masked-reject-callers-guard.ts`) 자체의 **품질 결함 3건**(정규식 오탐, 런타임 freeze 플라시보, 탐지 능력 미검증)이 WARNING 으로 남아 있다. 핵심 기능(`resolveTriggerParametersRejectingMasked`, 두 호출부, 에러 응답 봉투)은 4라운드에 걸쳐 CRITICAL 0 / WARNING 0 으로 수렴한 상태가 실코드 재검증으로 재확인됐다. forced reviewer 7명 전원 결과 확보됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 신규 repo-guard(`masked-reject-callers-guard.ts`)의 import 탐지 정규식(`import\s*\{[\s\S]*?\}\s*from`)이 AST 가 아니라 텍스트 스캔이라, 주석·문자열 리터럴 안에 적힌 "완전한 import 구문 예시 텍스트"도 실제 import 로 오판한다. 이미 가드 자신과 형제 spec 파일에 발생 중이며(`node -e` 로 실측 재현), 두 파일을 허용목록에 수동으로 얹어 은폐된 상태 — "죽은 허용목록 항목 캐너리"가 무력화되고, 향후 무관한 파일이 예시로 같은 구문을 인용하면 엉뚱한 CI 실패를 유발 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` `importsBaseFn`(72~82행, 특히 79행), 73행 JSDoc 예시 주석; `masked-reject-callers.spec.ts` 58~63행 픽스처 문자열 | 매칭 전 라인/블록 주석·문자열·템플릿 리터럴을 제거·마스킹하거나, `typescript` 컴파일러 API(`ts.createSourceFile` + `ImportDeclaration` 순회)로 교체. 고친 뒤 `ALLOWED_DIRECT_CALLERS` 에서 이 두 파일 항목 제거 |
| 2 | testing | 신규 repo-guard 의 핵심 능력("실제 위반을 탐지해 RED 를 낸다")을 검증하는 테스트가 없다 — `findUnexpectedCallers` 의 제외 필터를 `.filter(() => false)` 로 무력화하는 뮤테이션 후 3개 테스트 전부 GREEN 으로 남는 것을 직접 실측. 형제 가드(`eslint-unicorn-peer.spec.ts`)가 갖춘 "vacuity 방지용 합성 위반 fixture" 패턴이 이 신규 가드엔 없음 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` `findUnexpectedCallers`(89~94행, 92행 제외 필터); `masked-reject-callers.spec.ts` 26~64행 | 임시 디렉터리(`fs.mkdtempSync`)에 `resolveTriggerParameters` 를 직접 import 하는 가짜 fixture 파일을 만들어 `findUnexpectedCallers` 가 그 파일을 정확히 지목하는지 확인하는 positive-detection 캐너리 테스트 추가 |
| 3 | maintainability | `Object.freeze(new Set(...))` 는 `Set` 의 데이터가 own property 가 아니라 내부 슬롯에 저장되므로 `.add()`/`.delete()` 를 전혀 막지 못하는 플라시보다(직접 실행해 재현: freeze 후에도 `.add('c')` 성공, size 증가). 이전 라운드(`01_15_47`) RESOLUTION 이 "런타임에서도 막았다"고 명시적으로 서술한 것과 실제 동작이 다르다 — 코드 자체의 즉시 악용 경로는 없으나 문서가 존재하지 않는 보장을 서술 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150-152` (`MASKED_MARKERS`) | `Set` 대신 `readonly string[]`(`Object.freeze([...])`, `includes()` 로 조회)로 교체해 실제 불변성을 확보하거나, 안 되면 주석/문서를 "컴파일 타임 `ReadonlySet` 표시일 뿐, 타입 단언 우회는 막지 않는다"로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 신규 가드 파일이 자기 자신을 허용목록에 넣은 이유를 "이름을 상수/픽스처로 들고 있다"고 설명하지만, 실제 매칭 원인은 `importsBaseFn` 바로 위 예시 주석(73행)이 우연히 import 블록 정규식 형태와 일치하기 때문(WARNING #1 과 동일 메커니즘의 문서 측면) | `masked-reject-callers-guard.ts:35` | 실제 메커니즘을 가리키도록 주석 정정, 또는 예시 주석을 정규식이 매칭하지 않는 산문 형태로 변경 |
| 2 | testing | `MASKED_MARKERS`/`isMaskedMarker` freeze 하드닝을 직접 겨냥한 캐너리, `findMaskedResubmissions` 의 `rawSource` 가 배열 자체인 경우를 겨냥한 케이스 부재 — `01_38_26` 라운드가 이미 등재 후 "필수 아님"으로 의도적 미조치, 이번 라운드도 유효성 재확인만 | `sanitize-error-message.spec.ts`, `reject-masked-resubmission.spec.ts` (313~316행 인근) | 조치 불요(기존 처분 유지), 다음 파일 편집 기회에 추가 고려 |
| 3 | testing | webhook/schedule 카브아웃 경계("마커 리터럴이 정상 값으로 통과")를 직접 겨냥하는 런타임 행위 테스트가 없다 — 정적 repo-guard(import 위치)만 이 경계를 고정 | `hooks.service.spec.ts`, `schedule-runner.service.spec.ts` | 필수 아님. 다음 편집 기회에 캐너리 1건씩 추가 시 정적+행위 양쪽 고정 |
| 4 | api_contract | 두 Manual 실행 진입점의 최상위 `error.code` 가 여전히 다름(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`) — 선존 drift, spec(`3-error-handling.md` §1.7 인근)에 명문화됨. `details[].code`(`MASKED_VALUE_RESUBMITTED`) 는 완전히 수렴 | `executions.service.ts`(reRun catch), `workflows.controller.ts`(execute catch) | 조치 불요 — 이 PR 범위 밖 별도 breaking 결정 |
| 5 | api_contract | `ReRunRequestDto.inputOverride` 의 Swagger description 이 옛 함수명(`resolveTriggerParameters`)만 언급, 새 마스킹 예약어 제약 미언급 | `re-run.dto.ts` (`inputOverride` 필드) | 조치 불요(유예 유지). 다음 DTO 편집 기회에 한 줄 보강 |
| 6 | requirement | `POST /:id/nodes/:nodeId/execute`(단일 노드 실행)는 트리거 파라미터 스키마를 resolve 하지 않아 이번 거부 가드 적용 대상 밖 — spec(`14-external-interaction-api.md:1546`)에 근거 명시된 의도된 설계 | `workflows.controller.ts` `executeNode` | 조치 불요. `NodeExecution.inputData` 가 향후 재제출 소비처를 얻으면 재평가 |
| 7 | requirement | `findMaskedResubmissions` 는 `rawSource`/`values` 가 non-record(배열·스칼라)면 조용히 빈 배열 반환(fail-open) — 기존 `resolveTriggerParameters` 의 선존 계약을 그대로 상속, 이번 PR 이 새로 연 표면 아님 | `reject-masked-resubmission.ts` `findMaskedResubmissions`(121행) | 조치 불요. DTO `@IsObject()` 가 1차 방어선, 향후 body 스키마 강화 시 자연 해소 |
| 8 | side_effect | 신규 repo-guard 가 테스트 시점에 `src/` 트리 전체를 재귀적으로 읽기(fs.readdirSync/readFileSync) — 쓰기·삭제 없음, 기존 형제 가드(`eslint-unicorn-peer-guard.ts`)와 동일 패턴 | `masked-reject-callers-guard.ts` `listSourceFiles`(41~56행) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 코드(repo-guard)는 방어 심층화, 신규 취약점 없음. 인가 체크 순서·값 미노출 에러 응답·마커 정확일치·깊이 상한 전부 재확인 |
| architecture | LOW | 신규 가드 정규식이 주석/문자열 안 완전한 import 구문도 오판(WARNING #1) |
| requirement | NONE | 4라운드 CRITICAL/WARNING 전량 해소 재확인. INFO 2건(executeNode 스코프 밖, non-record fail-open 상속) |
| scope | NONE | 실질 코드 변경 8파일 전부 단일 의도 부합, 무관 파일 확장 없음 |
| side_effect | NONE | 신규 코드는 읽기 전용 순수 스캔, 기존 자매 가드 패턴과 동일 |
| maintainability | LOW | `Object.freeze(Set)` 가 실제로는 불변성을 강제하지 못하는 플라시보(WARNING #3) |
| testing | MEDIUM | 신규 가드의 핵심 탐지 능력을 검증하는 테스트 부재, 뮤테이션으로 실증(WARNING #2) |
| documentation | NONE | 가드 자기참조 주석이 실제 매칭 메커니즘을 부정확하게 서술(INFO #1) |
| api_contract | LOW | 최상위 error.code 선존 drift, Swagger description stale (둘 다 INFO, 유예 유지) |
| user_guide_sync | NONE | frontend 변경 0건, UI 는 이미 제출 전 클라이언트측에서 마스킹 마커 차단 — 동반 갱신 누락 0건 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 1건 이상 INFO/WARNING 을 등재했으나, 6개 에이전트는 위험도 NONE으로 실질 결함 없음).

## 권장 조치사항

1. **[WARNING #2, testing]** 신규 repo-guard 에 positive-detection 캐너리(임시 fixture 로 실제 위반을 탐지하는지 확인) 추가 — 이 가드가 지키려는 핵심 보안 불변식(Manual 경로의 base 함수 우회 방지)이 현재 회귀 시 무음으로 깨질 수 있음.
2. **[WARNING #1, architecture]** `importsBaseFn` 의 텍스트 정규식을 주석/문자열 제거 전처리 또는 TS AST 파싱으로 교체하고, 그 결과로 불필요해진 자기참조 허용목록 항목 2개 제거.
3. **[WARNING #3, maintainability]** `MASKED_MARKERS` 를 `readonly string[]` 로 바꿔 실제 런타임 불변성을 확보하거나, 최소한 관련 주석/RESOLUTION 문구에서 "런타임에서도 막았다"는 과장된 서술을 제거.
4. 나머지 INFO 8건은 전부 조치 불요/유예 처분이 이미 확정된 항목 — 다음 관련 파일 편집 기회에 자연스럽게 함께 처리 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨, 누락 없음
  - **제외**: 표 (reviewer · 이유, 4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 는 성능 특성과 무관한 서버측 검증 로직 추가 |
  | dependency | 라우터 판단 — 신규 외부 의존성 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성/레이스 조건과 무관한 순수 검증 로직 |