STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard (16_25_35)

## 컨텍스트

이 changeset(`origin/main...HEAD`, `codebase/**` 23파일)은 `Execution.inputData` egress
마스킹 카브아웃을 폐지하고(재제출 시 마스킹하면 `'***'` 가 실제 입력이 되는 문제 때문에
예외였던 컬럼), 재제출 소비처 3곳(폼 프리필 `dynamic-form-ui.tsx`, Re-run 모달
`rerun-modal.tsx`, 에디터 히스토리 로드 `editor-toolbar.tsx`)에 마스킹 마커 감지 가드를
추가한다. 프롬프트에 포함된 `review/**` 아래 78+ 파일은 이 changeset 이 이미 거친 5라운드
code-review + 2라운드 consistency-check 의 산출물(RESOLUTION/SUMMARY/각 관점 리포트)로,
그 자체가 리뷰 대상 코드가 아니다 — 이번 라운드는 `codebase/**` 최종 상태를 직접 `Read`/`git
diff` 로 독립 재확인했다.

## 재확인한 핵심 파일 (직접 Read/diff)

- `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`
  (`ResponseExecution` 타입에 `inputData` 포함, `redactStoredDataForResponse(rest.inputData)`),
  `toExecutionDto`(목록 경로, 동일 마스킹), 노드 레벨 `maskIfPresent` 루프, `reRun`(RBAC/IDOR/
  owner-admin 게이트), `resolveTriggerParameters` 호출부
- `codebase/backend/src/shared/utils/redact-stored-error.ts` — `redactStoredDataForResponse`/
  `redactStoredErrorForResponse` (이번 diff 로 변경 없음, 호출부만 확장)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `SECRET_LEAK_PATTERNS`,
  `MAX_REDACT_DEPTH=10`, `deepRedactSecrets` (JSDoc 만 변경, 로직 무변경)
- `codebase/frontend/src/lib/utils/masked-markers.ts` — `MASKED_MARKERS`/`isMaskedMarker`
  (정확 일치)/`hasMaskedMarkerLeaf`(재귀 leaf 검사) 전문
- `codebase/frontend/src/components/executions/rerun-modal.tsx` — `splitMaskedParameters`,
  `blockedByMaskedInput`(touched ∧ ¬hasMaskedMarkerLeaf ∧ ¬coerce-실패, 3조건의 합)
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `jsonError`
  useMemo 의 `hasMaskedMarkerLeaf(parsed)` 게이트, Run 버튼 disabled 배선
- `git diff origin/main...HEAD -- codebase/` 로 하드코딩 시크릿 패턴(AKIA/`sk-`/PEM 헤더/
  `password=`/`api_key=` 리터럴) grep — 매치 0건(테스트 fixture `sk-live-abc123`/`admin:pw`
  제외, 기존 관례)

## 발견사항

- **[INFO]** `POST /executions/:id/re-run` 의 `inputOverride` 는 서버측에서 마스킹 마커
  리터럴(`'***'` 등)을 값으로 거부하지 않는다 — UI 우회 시 재현되는 것은 **자기 자신의
  재제출 오염뿐**이다 (defense-in-depth 갭, 이번 PR 범위 밖으로 트래커 기명 등재됨)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드
    (약 417~505행, `resolveTriggerParameters(schema, dto.inputOverride ?? {})` 호출부)
  - 상세: 이 PR 이 추가한 마커 가드(`splitMaskedParameters`/`blockedByMaskedInput`/
    `hasMaskedMarkerLeaf`)는 전부 프런트엔드 상태다. UI 를 거치지 않고 API 를 직접 호출하면
    `inputOverride` 에 `'***'` 를 그대로 실어 보낼 수 있고, `resolveTriggerParameters` 는
    타입·필수값만 검증하므로 그대로 통과해 새 실행의 `Execution.inputData` 에 리터럴
    `'***'` 가 저장된다. 다만 `reRun` 자체를 직접 `Read` 로 재확인한 결과 RBAC(`@Roles`
    controller 게이트)·워크스페이스 격리(존재/타 워크스페이스 동일 404, ID enumeration
    차단)·RR-PL-06 owner/admin 게이트는 이번 diff 로 손대지 않았고 그대로 유지된다 — 호출자는
    이미 그 실행에 대한 편집 권한을 갖고 있어, 이 경로로 새는 것은 타인의 데이터나 다른
    워크스페이스가 아니라 **호출자 자신의 새 실행 입력값**뿐이다. 기밀성 침해가 아니다.
  - 이 갭은 이번 PR 이 새로 만든 것이 아니라(masking 자체가 이 PR 로 처음 생긴 것이므로
    "이전에 존재하던 우회"는 아니지만, 이 PR 의 방어 계층 설계가 UI 정상 흐름 한정임을
    §R17·`plan/in-progress/eia-inputdata-marker-guard.md` 트래커가 명시적으로 인지·기록하고
    범위 밖으로 확정한 것) 5라운드에 걸쳐 security reviewer 가 반복 확인하며 매 라운드
    동일하게 INFO 로 판정해 온 사안이며, 이번 독립 재검토에서도 같은 결론이 유효함을
    `reRun`/`resolveTriggerParameters` 코드를 직접 읽어 재확인했다.
  - 제안: (선택, 이미 트래커 등재) `resolveTriggerParameters` 직후 또는 그 안에서
    `dto.inputOverride` 의 leaf 값이 `isMaskedMarker`/`hasMaskedMarkerLeaf` 와 정확히
    일치하면 `INVALID_INPUT` 으로 얕게 거부하는 방어를 defense-in-depth 로 추가할 수 있다.

## 확인했으나 재지적하지 않는 것 (선행 라운드가 이미 잡아 코드로 수정, 재발 없음 실측)

- **object/array 내부 마커 우회** — `hasMaskedMarkerLeaf` 가 중첩 구조를 재귀 순회하고
  `rerun-modal.tsx`/`editor-toolbar.tsx` 양쪽 모두 정확 일치(`isMaskedMarker`) 대신 이 함수를
  쓴다. `{"headers":{"apiKey":"***"}}` 형태가 뚫리지 않음을 코드로 재확인.
- **egress 마스킹 커버리지** — 백엔드 관문 4곳(`toResponseExecution`/`toExecutionDto`/노드
  레벨 `maskIfPresent` 루프/`background-runs.service.ts`)이 `Execution`·`NodeExecution`
  두 레벨 모두에서 `inputData`를 `redactStoredDataForResponse` 로 덮는 것을 확인 — 예전엔
  `execution.inputData ?? null` 로 원문이 그대로 나가던 자리(`toExecutionDto`)가 이번 diff 로
  마스킹 경유로 바뀌었다.
- **값-기반/touched-키 영구 해제/무효 JSON 폴백 우회** — `blockedByMaskedInput` 이
  "touched ∧ ¬hasMaskedMarkerLeaf(현재 값) ∧ ¬(구조 필드의 coerce 실패)" 세 조건의 **합**으로
  판정해, 스키마 지연 도착·재마스킹 후 되돌림·무효 JSON 폴백 세 우회 경로 모두 막힘을 코드로
  확인. 설령 프런트 방어가 없어도 backend `resolveTriggerParameters` 가 타입 불일치를
  `coerce_failed`(`INVALID_INPUT`)로 거부해 실제 오염까지 가지 않는 2차 방어도 확인.
- **재귀 깊이 / 클라이언트 DoS** — `hasMaskedMarkerLeaf`(frontend)에는 깊이 상한이 없으나,
  이 함수가 순회하는 데이터는 백엔드 `deepRedactSecrets`(`MAX_REDACT_DEPTH=10`)를 이미
  통과한 뒤라 REST/WS 도착 시점에 깊이가 상한돼 있다. 사용자가 직접 타이핑하는 에디터 JSON
  텍스트는 이 상한 밖이지만 유일한 소비자가 입력한 본인 브라우저 탭이라 self-DoS 이상의
  위험이 없다.
- **하드코딩된 시크릿** — 이번 diff 전체에서 실 자격증명 패턴 grep 결과 매치 없음(테스트
  fixture `sk-live-abc123`/`admin:pw` 는 마스킹 동작 검증용 가짜 값, 저장소 기존 관례).
- **인젝션(SQL/XSS/경로탐색)** — 신규 SQL 쿼리·`dangerouslySetInnerHTML`·파일 경로 조작
  없음. `executions.service.ts` 의 쿼리는 모두 파라미터 바인딩(`:id`, `:...ids`) 유지.
  `sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`(정규식)는 이번 diff 로 로직 변경이
  없다(JSDoc 만 갱신).
- **인증/인가** — `reRun`/`getChain`/`stop`/`findById` 의 워크스페이스 격리·IDOR 방지(404
  통일)·RR-PL-06 owner/admin 게이트는 이번 diff 가 손대지 않았고 그대로 유지.
- **암호화/평문 전송** — 이번 diff 는 전송 계층·해시·암호화 알고리즘을 건드리지 않는다.
- **에러 처리** — `RERUN_EXECUTION_NOT_FOUND`/`RERUN_PERMISSION_DENIED` 등 에러 메시지에
  민감정보(스택트레이스·내부 경로·타 사용자 식별자) 노출 없음, 기존 패턴 유지.
- **의존성 보안** — 이번 diff 는 신규 의존성을 추가하지 않는다(신규 파일
  `lib/utils/masked-markers.ts` 는 기존 constant 를 옮긴 순수 함수, 외부 패키지 없음).

## 요약

이 changeset 은 `Execution.inputData` 의 egress 마스킹 카브아웃을 닫아 마스킹 커버리지를
넓히는 보안/데이터-무결성 개선이다. 백엔드 마스킹 관문 4곳이 `Execution`·`NodeExecution` 두
레벨에서 일관되게 `inputData` 를 가리도록 바뀌었고, 프런트 세 소비처(폼 프리필·Re-run
모달·에디터 히스토리 로드)는 정확-일치(`isMaskedMarker`)와 재귀 leaf 검사
(`hasMaskedMarkerLeaf`)를 공유해 object/array 안쪽 마커도 놓치지 않는다. 이 changeset 은
이미 5라운드의 code-review 를 거치며 CRITICAL 2건(object/array leaf 우회, DTO JSDoc 계약
방치)과 다수의 우회 경로(값-기반 판정, touched-키 영구 해제, 무효 JSON 폴백)를 코드로
수정·재검증했고, 이번 독립 재확인에서 핵심 파일을 직접 읽어 그 수정들이 최종 상태에
재발 없이 반영돼 있음을 확인했다. 유일하게 남는 사안은 서버가 UI 우회 시의 `inputOverride`
마커 리터럴을 거부하지 않는 defense-in-depth 갭인데, RBAC/IDOR/ownership 게이트가 그대로
유지된 상태에서 재현되는 피해가 호출자 자기 자신의 새 실행 오염뿐이라(기밀성 침해 아님)
이번 PR 범위 밖으로 트래커에 이미 명시 등재돼 있다 — INFO 로만 남긴다. 하드코딩된 시크릿,
신규 인젝션 표면, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리 문제는
발견되지 않았다.

## 위험도

NONE
