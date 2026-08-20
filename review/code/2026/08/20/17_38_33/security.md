STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD --stat -- codebase/` (23파일, +953/-162)로 실제 코드 변경 범위를
확정하고, 프롬프트가 생략한 파일들(`executions.service.ts`, `executions.service.spec.ts`,
`rerun-modal.tsx`, `masked-markers.ts` 등)은 `git diff`/`Read` 로 직접 열어 전문을 대조했다.
`review/code/2026/08/20/{14_08_45,14_44_08,15_10_25,15_32_34,15_59_17,16_25_35}/**` 는 이
브랜치의 선행 리뷰 라운드 산출물(비-기능 파일)이라 보안 스코프에서 제외했다.

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃(재제출 소비처가 읽어 그대로
재실행하므로 마스킹을 걸지 않던 유일한 예외)을 닫고, 재제출 소비처 3곳(폼 프리필 ·
Re-run 모달 · 에디터 히스토리 로드)에 마스킹-마커 감지 가드를 추가하는 보안 하드닝
성격의 PR이다.

## 발견사항

- **[INFO]** 마스킹-마커 재제출 차단이 **클라이언트 측 UI 가드에만** 있고, 서버는 `inputOverride` 에
  마스킹 마커 리터럴(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)이 실려 와도 이를 거부하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:493`
    (`parameters = resolveTriggerParameters(schema, dto.inputOverride ?? {});`) — 이 경로는
    타입/필수값만 검증하고 마커 값 여부는 보지 않는다. 차단은 오직
    `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput`
    (Submit 버튼 `disabled`)와 `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
    의 `jsonError`(Run 버튼 `disabled`) 에서만 이뤄진다.
  - 상세: UI 를 거치지 않고 REST API 를 직접 호출(스크립트/curl/수정된 클라이언트)하면
    `POST .../rerun` 의 `inputOverride` 에 리터럴 `'***'` 문자열을 그대로 넣어 제출할 수 있다.
    이 경로가 뚫려도 **자격증명이 노출되는 것은 아니다**(반대 방향 — 이미 마스킹된 값을 그대로
    쓰는 것) — 위험 성격은 기밀성이 아니라 이 PR 이 원래 막으려던 **데이터 무결성**(리터럴
    `'***'` 가 새 실행의 실제 입력이 되는 조용한 오염)이 서버 강제 없이 UI 우회로 되살아날 수
    있다는 것이다.
  - 이 저장소의 선행 리뷰 체인(`review/code/2026/08/20/14_44_08/RESOLUTION.md` "트래커 등재 #6")도
    이미 동일 지점을 확인해 **"이 PR 이 만든 결함이 아니고, §R17 이 가드 범위를 UI 정상 흐름으로
    명시했다"** 며 INFO 로 트래커에 등재하고 이번 PR 의 차단 사유로 삼지 않았다. 독립적으로 코드를
    확인한 결과 이 판단에 동의한다 — 다만 방어 심층화(defense-in-depth) 관점에서 서버측
    `resolveTriggerParameters` 또는 rerun 핸들러에 `hasMaskedMarkerLeaf` 동형 검사를 추가해
    비-UI 클라이언트도 같은 보호를 받게 하는 편이 더 안전하다.
  - 제안: (트래커 항목 유지, 이번 PR 차단 사유 아님) `resolveTriggerParameters` 또는 그 호출부에서
    `inputOverride` 값에 `isMaskedMarker`/`hasMaskedMarkerLeaf` 동형 검사를 적용해 `useOriginalInput`
    이 아닌 경로에서 마커 리터럴을 서버가 거부(예: 기존 `coerce_failed` 류 에러 코드 재사용)하도록
    한다.

## 점검한 항목 (net-new 이슈 없음)

- **egress 마스킹 게이트 일관성**: `ExecutionsService.toResponseExecution`(상세) ·
  `toExecutionDto`(목록) · `BackgroundRunsService.toBackgroundRunResponse`(node 레벨) 세 표면 모두
  `redactStoredDataForResponse(...inputData)` 를 새로 적용해 `Execution` 레벨과
  `NodeExecution` 레벨이 동일 규칙으로 통일됐다(`codebase/backend/src/modules/executions/executions.service.ts`
  의 `MASKED_INPUT_DATA_REASON` 앵커 전수 삭제 후 실제 마스킹 호출로 대체 — grep 으로 잔존
  앵커 참조 없음을 확인).
- **정확 일치 vs 부분 포함 경계**: `isMaskedMarker`(정확 일치)와 `hasMaskedMarkerLeaf`(구조체
  leaf 스캔) 가 raw 문자열 substring 매칭을 쓰지 않아 마크다운 `***bold***` 등 정상 입력을
  오탐 차단하지 않는다 — `codebase/frontend/src/lib/utils/masked-markers.ts:58-60` 주석이 이
  경계를 명시하고 과거 라운드(`12_08_46` W2)에서 substring 매칭 시도가 기각된 이력이 남아있다.
- **깊이 상한 정합성**: 프런트 `MAX_MARKER_SCAN_DEPTH = 10`(`masked-markers.ts:96`)이 백엔드
  `MAX_REDACT_DEPTH = 10`(`sanitize-error-message.ts:112`)와 정확히 일치 — 어긋나면 백엔드가
  치환한 마커를 프런트 가드가 못 보고 통과시킬 수 있는 자리라 값을 직접 대조했다. 값 검사가
  깊이 검사보다 먼저 수행돼(`scanForMarker` 의 `isMaskedMarker` 우선 순서) 상한 지점에 놓인
  치환 마커를 놓치지 않는다.
- **차단 판정의 3-조건 합**: `rerun-modal.tsx` 의 `blockedByMaskedInput` 이 (a) 사용자가 그
  키를 건드렸는가, (b) 현재 값에 마커 leaf 가 없는가, (c) 구조 필드면 JSON 파싱에 성공했는가
  세 조건 전부를 요구한다(`maskedKeys.some(...)` 부정 조합 = 논리적 `every`). 세 조건 각각이
  단독으로는 서로 다른 경로로 뚫리는 것을 선행 3라운드 리뷰가 실제로 재현·수정한 이력이
  코드 주석(`14_08_45`/`14_44_08`/`15_32_34`)에 남아 있고, 이번 diff 시점 코드는 세 조건이 모두
  살아있음을 직접 확인했다.
- **useOriginalInput 우회 경로는 의도된 안전 경로**: 토글 ON 시 서버가 `original.inputData` 를
  엔티티에서 직접 읽으므로(`executions.service.ts:481` `useOriginal = dto.useOriginalInput ?? true`)
  클라이언트 프리필/마스킹과 무관하게 원문으로 재실행된다 — 이는 자격증명 유출이 아니라 정상
  "동일 사용자가 자기 워크스페이스의 원본 값으로 재실행" 경로이고, 권한 검증(워크스페이스
  멤버십)은 이번 diff 가 건드리지 않은 상위 가드(`@Roles` 등)에 의존한다.
- **하드코딩 시크릿 없음**: diff 전체에 실제 API 키/토큰/비밀번호 리터럴 없음. 테스트 픽스처의
  `sk-live-abc123`, `admin:pw` 는 기존 저장소 관례상 마스킹 검증용 가짜 문자열(다른 spec 파일에서도
  동일 패턴 재사용)이라 신규 노출이 아니다.
- **인젝션/XSS**: 신규 로직은 `JSON.parse` + 순수 객체 순회(`Object.values`/`Array.some`)뿐이고
  DOM/SQL/커맨드 인젝션 표면이 없다. 마커 문자열은 React JSX 로만 렌더돼(`{t("editor.runWithInputMasked")}`
  등) 자동 이스케이프된다. `JSON.parse` 결과의 `__proto__` 키는 일반 own-property 로만 취급돼
  프로토타입 오염 경로가 아니다.
- **DoS/재귀 폭주 방어**: `hasMaskedMarkerLeaf` 가 백엔드 검증을 거치지 않은 사용자 입력(에디터
  "Run with Input" 텍스트에어리어)을 받을 수 있음을 인지하고 깊이 상한(10)으로 재귀 콜스택 폭주를
  막는다 — `editor-toolbar.tsx:106-110` 주석이 `JSON.parse` 는 반복적 구현이라 상한 없는 재귀
  탐색이 못 따라가는 깊이도 통과시킴을 명시하고, 렌더 경로(`useMemo`)에서 예외가 던져지면 React
  트리 전체가 깨지는 것을 인지해 depth guard 를 유일한 방어로 두지 않는다는 설계 의도가 코드
  주석에 남아 있다.
- **에러 처리**: `handleRunWithInput`(`editor-toolbar.tsx:294`)의 catch 블록은 `SyntaxError` 만
  안내 문구로 노출하고 나머지는 `console.error` 로만 남겨 스택 트레이스나 서버 응답 원문을
  사용자 화면에 노출하지 않는다 — 기존 패턴 유지.

## 요약

이 PR 은 `Execution.inputData` egress 마스킹의 유일한 예외(재제출 카브아웃)를 프런트 3개
소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커 감지 가드를 갖춘 뒤 닫는다.
백엔드 마스킹 관문 3곳(`toResponseExecution`/`toExecutionDto`/`BackgroundRunsService`)이 일관되게
`inputData` 를 포함하도록 갱신됐고, 프런트 마커 판별기(`isMaskedMarker`/`hasMaskedMarkerLeaf`)는
정확 일치 경계·깊이 상한(백엔드와 정합)·값-우선 순서 등 여러 라운드에 걸쳐 하드닝된 세부 방어를
그대로 유지한다. 자체 검증 결과 새로운 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화
문제는 발견되지 않았다. 유일한 지적 사항은 마커 재제출 차단이 서버가 아니라 클라이언트 UI
에서만 강제된다는 점(INFO)인데, 이는 기밀성 노출이 아니라 데이터 무결성 성격의 잔여 갭이고
이 저장소의 선행 리뷰가 이미 인지·판단해 별도 트래커 항목으로 관리 중이라 이번 PR 을 막을
사안은 아니다.

## 위험도

LOW
