# 정식 규약 준수 검토 — reserved `__` variable-name enforcement

대상: `git diff origin/main...HEAD` (`--impl-done` 직전), 39 files changed.
검토 기준: `spec/conventions/**` + `PROJECT.md`.

## 발견사항

### [Warning] 신규 shared util 파일이 관련 spec frontmatter `code:` 에 미등재

- target 위치:
  - `spec/conventions/execution-context.md` frontmatter (파일 1-8행) — `code:` 목록에 3개 파일만 존재 (`node-handler.interface.ts` / `execution-context.service.ts` / `resume-call-stack.types.ts`).
  - `spec/4-nodes/1-logic/4-variable-declaration.md` frontmatter (파일 1-7행) — `code:` glob 이 `variable-declaration/variable-declaration.*.ts` 와 `coerce-type.ts` 뿐.
  - `spec/4-nodes/1-logic/5-variable-modification.md` frontmatter (파일 1-6행) — `code:` 에 `variable-modification/variable-modification.*.ts` + `_shared/value-masking.util.ts` 만 있고 신규 파일은 없음.
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로") + §Rationale R-1 취지.
- 상세: 이번 PR 이 신설한 `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` 는 세 문서 모두에서 본문 산문으로 명시적으로 인용된다 — 특히 `execution-context.md` 원칙 5 본문(diff L206)은 이 파일을 "코드 SoT" 라고 직접 지칭한다. 그런데 세 문서의 frontmatter `code:` 목록 어디에도 이 경로가 없다. `variable-modification.md` 는 바로 인접한 `_shared/value-masking.util.ts` 를 이미 `code:` 에 등재해 둔 선례가 있어("이 노드가 소비하는 `_shared/*.util.ts` 는 등재한다"는 국소 관행이 이미 존재), 신규 shared util 을 빠뜨린 것이 더 두드러진다. `status: implemented` 라 build 가드(`spec-code-paths.test.ts`, ≥1 매치)는 기존 glob 만으로도 통과하므로 CI 는 막지 않지만, "spec 본문이 SoT 라 부르는 코드 vs frontmatter 증거"의 불일치는 spec-impl-evidence 컨벤션이 막으려는 바로 그 갭(문서 약속 vs 등재 안 된 구현) 이다.
- 제안: 세 문서의 `code:` 에 `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` 를 추가한다 (glob 이 아닌 명시 파일 1개라 부담 작음).

### [Warning] 신규 에러코드가 §1.3(유효성 검증 에러, HTTP 컬럼 보유 테이블)에 단일 `400` 으로 등재돼 L2(엔진 실행-레벨) 발생 시점의 실제 표면을 오도할 소지

- target 위치: `spec/5-system/3-error-handling.md:85` (§1.3 테이블 행) 및 대응하는 `spec/4-nodes/1-logic/4-variable-declaration.md:151` / `5-variable-modification.md:159` §6 표.
- 위반 규약: `spec/5-system/3-error-handling.md` 자체의 §1.3 vs §1.4 구조 관행(§1.3 은 실제 HTTP 응답용 "코드\|설명\|HTTP" 3컬럼 테이블, §1.4 "워크플로우 실행 에러" 는 HTTP 컬럼이 아예 없는 "코드\|설명" 2컬럼 테이블 — 엔진 레벨 실패는 HTTP 응답이 아니라 `execution.status='failed'`/EIA `execution.failed.error.code` 로만 관측되기 때문). 같은 문서의 `WORKER_HEARTBEAT_TIMEOUT`(§3, `error-codes.md`)·`MAX_ITERATIONS_EXCEEDED`(§1.4) 는 정확히 이 구분을 지킨다.
- 상세: `RESERVED_VARIABLE_NAME` 은 두 개의 서로 다른 표면을 가진다 — **L0**(`WorkflowsService.saveCanvas`/`importWorkflow` 의 실제 `BadRequestException` → 진짜 HTTP 400 응답, §1.3 에 정확히 맞음)와 **L2**(`handler.execute` 런타임 throw → 엔진이 노드 실패로 분류, HTTP 응답이 전혀 아님 — `MAX_ITERATIONS_EXCEEDED` 와 동일 계열). 그런데 §1.3 표는 두 표면을 한 행에 합쳐 HTTP 컬럼에 단일 `400` 을 적었다. 산문 설명(같은 행 텍스트)은 이 차이를 정확히 서술하고 있으나, 테이블만 훑는 독자(혹은 이 표를 근거로 클라이언트 에러 분기표를 만드는 사람)는 L2 케이스도 HTTP 400 바디로 온다고 오해할 수 있다 — 이는 `EXECUTION_TIMEOUT`/`CODE_TIMEOUT` 항목이 "두 레이어 구분 SoT" 를 별도로 명시해 해결한 것과 같은 클래스의 문제다.
- 제안: (a) §1.3 행의 HTTP 컬럼을 `400 (L0만; L2는 HTTP 무관 — 엔진 실행 실패)` 형태로 명확화하거나, (b) `WORKER_HEARTBEAT_TIMEOUT` 선례처럼 L2 케이스를 §1.4(엔진 레벨, HTTP 컬럼 없음) 에도 교차 등재/각주를 단다. 규약 자체를 갱신해도 되는 항목(예: "dual-surface 코드는 §1.3 에 두되 HTTP 컬럼에 '해당 레이어 한정' 각주를 명시한다"는 규칙을 error-codes.md 나 error-handling.md §1 서문에 추가) — 새 패턴이라 향후 유사 dual-surface 코드가 또 나올 수 있음.

### [Info] CHANGELOG `### 범위 밖 (잔여 리스크)` 섹션 헤더는 신규 표현

- target 위치: `CHANGELOG.md:10-14`.
- 위반 규약: 없음 — CHANGELOG 형식을 규정하는 정식 `spec/conventions/*.md` 문서가 存在하지 않는다(리포에 CHANGELOG 전용 convention 문서 없음, grep 결과 0건). 따라서 CRITICAL/WARNING 대상은 아니다.
- 상세: 기존 엔트리들은 `### Breaking changes` / `### Migrations` / `### Replay / View Policy (new)` / `### Internal / Infrastructure` 등 자유 서술적 헤더를 이미 써 왔고(정해진 vocabulary 없음), 이번 PR 의 `### 범위 밖 (잔여 리스크)` 도 그 연장선이라 실질적 이탈은 아니다. 다만 "SoT:" 마무리 줄, 번호 매긴 항목, 굵게 제목 등 나머지 형식은 기존 precedent(`## Unreleased — ...` 다건)와 정확히 일치한다.
- 제안: 조치 불필요(정보성). 향후 CHANGELOG 형식을 정식 규약화하고 싶다면 `spec/conventions/changelog.md` 신설을 고려.

### [Info] Swagger `@ApiBadRequestResponse` 설명 문구가 신규 조건을 특정하지 않음

- target 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:440-442` (`saveCanvas`) 및 `:517` (`importWorkflow`).
- 위반 규약: 없음 — `spec/conventions/swagger.md` §2-4 는 "400 검증 실패 → `@ApiBadRequestResponse`" 라는 일반 패턴만 규정하며 조건별 exhaustive description 을 의무화하지 않는다(기존 `DUPLICATE_NODE_LABEL` 도 별도 `@ApiConflictResponse` 문구로 갈음, 조건별 세분 없음).
- 상세: `saveCanvas` 의 description 은 `'Manual Trigger 누락/중복 또는 입력값 검증 실패'` 로, 신규 `RESERVED_VARIABLE_NAME` 사유가 명시되지 않는다. Manual Trigger 는 과거 유사 PR 에서 명시적으로 언급을 추가한 선례가 있어(동일 패턴), 대칭성 차원의 제안.
- 제안: (선택) `'Manual Trigger 누락/중복, 예약 변수 이름(__) 사용 또는 입력값 검증 실패'` 로 보강하면 일관성이 좋아지나, 규약 위반은 아니므로 필수 아님.

## 검토 통과 확인 (위반 없음 — 근거 요약)

- **에러 코드 명명** (`error-codes.md`): `RESERVED_VARIABLE_NAME` 은 UPPER_SNAKE_CASE, 조건의 의미를 정확히 기술(§1), historical-artifact 아니므로 §3 등재 불요, `error-codes.ts` 의 `ErrorCode` enum(node-handler `output.error.code` 전용, §4 범위)에 넣지 않은 것도 `DUPLICATE_NODE_LABEL`/`WORKSPACE_ID_REQUIRED` 등 동일 계열 서비스-레벨 코드 선례와 일치.
- **§1.3 카탈로그 SoT 등재**: `spec/5-system/3-error-handling.md:85` 에 코드\|설명\|HTTP 3컬럼 포맷으로 정확히 등재(위 Warning 은 컬럼 *내용*의 정확도 이슈이지 등재 누락이 아님).
- **User-guide KO/EN parity**: `logic.mdx`/`logic.en.mdx` 양쪽에 동일 위치(§ Variable Declaration·Modification config 표 직후, `### 예시`/`### Example` 앞)에 동일 분량(각 +2행 서술) 삽입, frontmatter 무변경. `i18n-userguide.md` Principle 7(페이지 stale 방지 — 필드 의미 변경 시 동일 PR 갱신 의무) 충족.
- **글로서리/문체** (`i18n-userguide.md` Principle 6, `_glossary.md`): 해요체 유지("~에러가 나요"), 금지어 없음, 내부 SoT(spec 경로·plan 경로·에러코드 문자열) 미노출(Principle 6-B) — KO/EN 신규 문장 모두 사용자-가시 표현만 사용.
- **i18n WARNING_KO 스코프**: `validateVariableDeclarationConfig`/`validateVariableModificationConfig` 의 신규 `__` 거부 메시지는 imperative `validateConfig` 반환 문자열이라 `i18n-userguide.md` §Principle 3 자동가드(P1-B, `warningRules[].message` 정적 파싱 전용)가 명시적으로 미커버 범위로 규정한 항목과 동일 클래스 — 기존 `variables[i].name is required...` 등 sibling 메시지와 동일하게 `WARNING_KO` 매핑 의무 밖. diff 에도 `backend-labels.ts`/`dict/**` 변경 없음 — 정합.
- **spec 문서 구조**: §6 에러 표 컬럼(발생 조건\|메시지\|시점) 기존 포맷 유지, `⚠` 블록쿼트 관행(§6 하단의 기존 "silent fallback" 각주와 동일 스타일) 재사용, Rationale 은 execution-context.md 기존 "**왜 X 인가** — " 굵은 문단 포맷을 그대로 따름(신규 `###` 서브헤딩 임의 도입 없음).
- **spec-impl-evidence status/lifecycle**: 관련 3개 spec(execution-context/variable-declaration/variable-modification) 모두 `status: implemented` 유지, `pending_plans` 불필요(전량 이번 PR 로 구현 완료), plan 파일(`node-output-redesign/*.md`)은 subfolder cluster 라 top-level frontmatter 의무 면제 대상.
- **응답 envelope 포맷** (`node-output.md` §3.2, `error-handling.md` §2.1): L0 `BadRequestException({code, message, details:{offenders}})` 형태는 동일 파일(`workflows.service.ts`) 내 기존 `details:{errors}` 패턴과 동형 — 커스텀 object-shape `details` 를 이미 쓰는 로컬 선례와 일치.

## 요약

핵심 계약(에러 코드 명명·카탈로그 등재, KO/EN 사용자 가이드 동시 갱신, i18n 매핑 스코프, spec §6 표/Rationale 포맷)은 모두 기존 정식 규약과 잘 정합한다. 유일하게 실질적으로 짚을 문제는 (1) 신규 shared util 파일이 관련 spec 3곳의 frontmatter `code:` 증거에 빠져 있어 spec-impl-evidence 컨벤션의 "약속 vs 구현 등재" 취지를 완전히 만족하지 못하는 점, (2) dual-surface(L0 HTTP vs L2 엔진 실행) 에러 코드를 §1.3 HTTP 표에 단일 `400` 으로 뭉뚱그려 등재해 이 문서가 다른 dual-layer 코드(`EXECUTION_TIMEOUT`/`CODE_TIMEOUT`, `WORKER_HEARTBEAT_TIMEOUT`)에 적용해 온 "레이어 구분 명시" 관행과 어긋나는 점이다. 둘 다 build 가드를 깨뜨리지 않고 산문 설명으로는 이미 정확히 서술돼 있어 CRITICAL 은 아니지만, 문서만 보는 소비자에게 혼선을 줄 수 있어 WARNING 으로 분류했다.

## 위험도

LOW

STATUS: DONE
