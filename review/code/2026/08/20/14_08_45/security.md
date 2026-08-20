# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 범위

`Execution.inputData` egress 마스킹 카브아웃 폐지(backend 6개 파일) + 프런트 마스킹 마커
왕복 차단 가드(Re-run 모달·에디터 히스토리 로드·`dynamic-form-ui` 리팩터, frontend 11개
파일) + spec/plan/review 산출물(문서 전용, 코드 아님). 코드 변경분(`codebase/**`)을
중심으로 실제 소스를 `Read`/`Grep` 으로 대조해 검증했다.

## 발견사항

- **[INFO]** 마스킹 마커 왕복 차단은 클라이언트 전용 방어이며 서버측 강제가 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:317-347` (`blockedByMaskedInput`
    → `handleSubmit`), `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:103-119`
    (`jsonError`) + `:869-871` (`disabled={isRunning || jsonError != null}`)
  - 상세: `Execution.inputData` 는 egress 마스킹돼 REST 응답에 `'***'`/`[REDACTED]`/`[REDACTED_DEPTH]`
    가 실려 오고, 이 값이 Re-run 모달/에디터 히스토리 로드에서 그대로 재제출되면 리터럴
    마커가 새 실행의 실제 입력이 되는 문제를 이번 변경이 막는다. 그런데 이 차단은 React
    state(`blockedByMaskedInput`, `jsonError`)로 버튼을 `disabled` 시키는 **UI 레벨 가드**이고,
    `handleSubmit`/`handleRunWithInput` 자체에는 재검증이 없다(브라우저 개발자 도구로 `disabled`
    를 해제하거나, 브라우저를 거치지 않고 `POST /executions/:id/rerun` · `POST
    /workflows/:id/execute` 를 직접 호출하면 마커 리터럴이 그대로 `inputOverride`/`input` 으로
    전달된다). backend 쪽에 "값이 알려진 마스킹 마커 문자열과 정확히 일치하면 거부"하는 서버측
    검증은 확인되지 않았다.
  - 영향 평가(왜 CRITICAL/WARNING 이 아닌가): 이 값을 재제출하는 주체는 그 실행에 대한 권한을
    이미 가진 동일 사용자/워크스페이스 구성원이고, 결과는 **자기 자신의 새 실행에 잘못된
    literal 자격증명이 들어가는 조용한 기능 오염**(cross-spec CRITICAL 이 지적해 온 그 클래스)
    이지 타 사용자·타 워크스페이스로의 자격증명 노출이 아니다. 즉 기밀성 침해가 아니라 무결성/
    가용성(자기 워크플로 오작동) 리스크이며, 이는 이번 PR 이 이미 알고 있는 "안내가 아니라
    강제"라는 요구를 UI 레이어에서만 충족한 상태다.
  - 제안: 서버측(예: `resolveTriggerParameters`/`workflowsApi.execute` 처리 경로)에 "값이
    `MASKED_MARKERS`(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`) 와 정확히 일치하면 400 으로
    거부" 하는 defense-in-depth 검증을 추가하는 것을 고려한다. UI 가드만으로 충분하다고
    의도적으로 결정했다면 그 근거(비-브라우저 클라이언트 위험을 수용 가능하다고 본 이유)를
    §R17 "닫는 조건" 문단에 명시해 두면 다음 리뷰에서 같은 질문이 재발하지 않는다.

- **[INFO]** 마커 감지는 정확 일치(exact match)만 잡고 부분 치환(partial substitution)은
  놓친다 — 문서화된 의도적 트레이드오프, 새 취약점 아님
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:47-50`(`isMaskedMarker`), `:63-73`
    (`hasMaskedMarkerLeaf`)
  - 상세: backend `SECRET_LEAK_PATTERNS`(`codebase/backend/src/shared/utils/sanitize-error-message.ts:33-57`)
    는 `scheme://user:pass@host` 같은 값을 `scheme://***@host` 로 **부분 마스킹**한다. 이런
    값은 `MASKED_MARKERS.has(v)` 정확 일치 검사를 통과하지 못해 프리필/재실행 차단 대상에서
    빠진다. 다만 이 경로로 재제출돼도 **자격증명 자체는 이미 지워진 뒤**이므로 기밀성 노출은
    없고, 남는 것은 "왕복 오염" 성질(부분 마스킹된 문자열이 실제 입력이 되는 것)뿐이다. 코드
    주석과 캐너리 테스트(`[캐너리] 마커를 포함만 하는 값은 막지 않는다`)가 이 경계를 의도적
    설계로 명시하고 있어 결함이라기보다 알려진 잔여 범위다.
  - 제안: 조치 불요. 향후 부분 마스킹 값까지 닫을 필요가 생기면 정규식 기반 substring 검사로
    확장하되, 이미 문서화된 "정상 값(`a***b`, 마크다운 `***bold***`) 오탐" 트레이드오프를
    재검토해야 한다.

- **[INFO]** `MASKED_INPUT_DATA_REASON` 앵커 및 그 방향("Execution 레벨은 예외")을 전제한
  서술이 코드베이스 전역에서 정합적으로 제거·반전됐음을 확인 (긍정 확인, 조치 불요)
  - 위치: 6개 소비처 전수(`codebase/backend/src/modules/executions/executions.service.ts`,
    `executions.service.spec.ts`, `dto/responses/execution-response.dto.ts`,
    `background-runs/background-runs.service.ts`, `background-runs.service.spec.ts`,
    `background-runs/dto/background-run-response.dto.ts`)
  - 상세: `grep -rn "MASKED_INPUT_DATA_REASON" codebase/` 0건. 이전 라운드 consistency
    checker(`review/consistency/2026/08/20/12_08_46/naming_collision.md`)가 CRITICAL 로 지적한
    "반전 시 6개 참조처 동시 갱신 누락" 우려가 최종 코드에서는 해소돼 있다 — 상수 자체가
    삭제됐고, `background-runs.service.ts` 의 "Execution 레벨만 예외" 대비 문장도 "두 레벨이
    같은 규칙이다" 로 갱신돼 있다. 보안 관점에서 stale 코멘트가 마스킹 정책을 오도할 위험은
    남아 있지 않다.

## 검증한 항목(문제 없음 확인)

- `redactStoredDataForResponse`(`codebase/backend/src/shared/utils/redact-stored-error.ts:66-71`)
  가 `deepRedactSecrets` 를 재사용해 `Execution.inputData` 에도 기존 `error`/`outputData` 와
  동일한 원칙(값-패턴 마스킹, 앞선 ingestion 마스킹 마커는 재마스킹하지 않는 멱등성, DB
  at-rest 원문 보존)을 일관 적용한다. `toResponseExecution`(단일 관문, 611/728/881행 호출)과
  목록 경로(1005-1009행), `findByWorkflow` 계열(1067-1077행) 전부 이 관문을 통과하도록
  배선돼 있어 "표면 하나만 놓침" 류의 부분 하드닝은 발견되지 않았다.
- Re-run 모달의 `useOriginalInput=true` 경로(`executions.service.ts:479-483`)는 서버가
  DB 엔티티를 직접 읽어 재실행하며 클라이언트 왕복을 거치지 않으므로 마스킹 마커 문제와
  무관 — 의도대로 캐너리 테스트(`[캐너리] 원본 입력 그대로 사용 을 켜면 차단이 풀린다`)로
  고정돼 있다.
- 신규 문자열(`i18n/dict/{en,ko}/{editor,history}.ts`)은 정적 텍스트이고 `dangerouslySetInnerHTML`
  없이 `{t(key)}` 로만 렌더 — XSS 벡터 없음.
- 새 유틸(`masked-markers.ts`)·수정된 컴포넌트에 하드코딩된 자격증명·API 키·토큰 없음.
  테스트의 `"real-key"` 는 명백한 placeholder.
- SQL/커맨드/경로 탐색 인젝션 표면 신규 도입 없음(순수 값 비교·문자열 매칭 로직).
- 인증/인가 로직 변경 없음(RBAC·세션 관련 코드 미변경).

## 요약

이번 변경은 순수한 보안 강화 커밋이다 — 이전까지 "재제출 카브아웃"으로 egress 마스킹에서
제외돼 있던 `Execution.inputData` 를 REST 응답 전 표면(단일 실행 조회·목록·정지·Re-run
DTO·background-run 노드 조회)에서 마스킹 대상으로 전환하고, 그 값을 재사용(프리필/재제출)
하는 세 소비처(폼 기본값, Re-run 모달, 에디터 "히스토리에서 불러오기")에 정확 일치 기반
마스킹-마커 감지 가드를 신설해 "마스킹된 값이 실제 입력으로 왕복 오염되는" 클래스의 결함을
막는다. 새로 도입된 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 문제는 발견되지
않았다. 유일한 잔여 사항은 프런트 마커 가드가 UI 레벨(버튼 `disabled`)에서만 강제되고
서버측 재검증이 없다는 점인데, 영향 범위가 "자기 자신의 새 실행에 대한 데이터 무결성"에
그치고(타 사용자로의 기밀 노출 아님) 팀이 이미 인지·문서화한 설계이므로 INFO 로 기록한다.

## 위험도

LOW
