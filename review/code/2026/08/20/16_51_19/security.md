STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard (16_51_19)

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹의 마지막 카브아웃을 닫는 작업이다.
같은 작업이 이미 6라운드(`14_08_45`, `14_44_08`, `15_10_25`, `15_32_34`, `15_59_17`,
`16_25_35`)의 code review 와 다수의 consistency-check 를 거쳤고, 그 라운드들에서 실제
CRITICAL 이 세 번(값-기반 판정 우회, touch 영구화 우회, 무효 JSON 폴백 우회) 발견되어
매번 즉시 코드로 수정됐다. 이번 최종 diff(`git diff origin/main...HEAD`, 실 코드 변경
23파일)를 원본 소스 기준으로 재검토했다.

## 점검 결과

### 1. 인젝션 / XSS
새 UI 문자열은 전부 `t("editor.runWithInputMasked")` / `t("history.rerun.maskedInputBlocked")`
경유 정적 i18n 텍스트이고 `dangerouslySetInnerHTML` 등 raw HTML 삽입 경로가 없다.
`role="alert"` 로 렌더되는 경고 문구(`rerun-modal.tsx`)도 정적 문자열뿐이다. JSON 파싱은
`JSON.parse` 표준 API 만 쓴다 — 커스텀 파서·`eval` 류 없음. 인젝션 벡터 없음.

### 2. 하드코딩된 시크릿
diff 전체(backend/frontend 실 코드 + 신규 테스트)를 grep 했다. `sk-live-abc123`,
`admin:pw`, `real-key`, `apiKey: "***"` 류는 전부 테스트 픽스처로, egress 마스킹이 실제
자격증명 패턴을 가리는지 검증하기 위한 **의도된 가짜 값**이다. 실제 API 키·비밀번호·
인증서는 발견되지 않았다.

### 3. 인증/인가
이 diff 는 인증/인가 경로(`@Roles`, 워크스페이스 멤버십 체크, RR-PL-06 permission gate 등)를
건드리지 않는다. `ExecutionsService.reRunExecution` 의 권한 검증·chain depth 제한·dry-run
pre-flight 로직은 diff 밖(무변경)이며 이번 변경과 상호작용하지 않는다.

### 4. 입력 검증 — 마스킹 마커 왕복 방지 (이 PR 의 핵심 로직)
egress 마스킹된 `Execution.inputData` 가 세 소비처(폼 프리필 `#1181`, Re-run 모달, 에디터
히스토리 로드)를 거쳐 **그대로 재제출**되면 리터럴 `'***'` 가 새 실행의 실제 입력이 되는
데이터 무결성 문제(왕복 오염)를, 프런트 마커 감지 가드로 막는 구조다. 소스를 직접 열어
확인한 결과:

- `codebase/frontend/src/lib/utils/masked-markers.ts` — `isMaskedMarker`(정확 일치) +
  `hasMaskedMarkerLeaf`(중첩 leaf 재귀 탐색, 깊이 상한 10)가 backend `sanitize-error-message.ts`
  의 `MAX_REDACT_DEPTH = 10` 과 정확히 일치함을 확인(`grep` 실측). 상한보다 얕게 두면
  깊이-치환 마커를 놓치는 fail-open 이 되는데, 두 값이 같아 그 리스크가 없다. 값 검사를
  깊이 검사보다 **먼저** 수행하는 순서(off-by-one 방지)도 코드·주석·테스트로 고정돼 있다.
- `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput` —
  "건드렸는가" AND "현재 값에 마커가 없는가" AND "구조 필드면 파싱 성공했는가" 세 조건의
  합으로, 세 조건 각각이 단독으로 뚫리는 별개 우회 경로(스키마 지연 도착 시 boolean 재조정,
  touch 후 마커로 되돌림, 무효 JSON 폴백)에 대응한다. 세 우회 모두 `rerun-modal.test.tsx`
  에 캐너리(`[캐너리] 건드린 뒤 값이 다시 마커면 계속 막는다`, `[캐너리] object 필드를 무효
  JSON 으로 만들어도 계속 막는다`, `[캐너리] 마스킹된 boolean 은 지연 스키마 도착 후에도
  계속 막힌다`)로 고정돼 있음을 실측 확인.
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — JSON 파싱과 마커
  검사를 한 `try` 블록에 두어, 파싱 성공 후 마커 검사가 던지는 예외까지 "잘못된 JSON"
  경로로 흡수한다(렌더 경로에서 미포착 예외가 React 트리를 깨는 것을 방지). 마커를 포함할
  뿐인 정상 값(`***bold***`)을 오탐하지 않는 경계도 캐너리 테스트로 고정돼 있다.
- **클라이언트 가드는 UX/데이터 무결성 방어이지 confidentiality 방어가 아니다** — 이 마스킹
  마커 감지는 "이미 마스킹되어 노출이 발생하지 않은" 값을 재제출로부터 지키는 것이지,
  이 가드를 우회한다고 해서 새로운 정보 노출이 생기지는 않는다(사용자가 API 를 직접 호출해
  `inputOverride` 에 리터럴 `'***'` 를 스스로 제출해도, 그건 자기 자신의 실행 입력을
  스스로 오염시키는 것뿐이다). Re-run 백엔드는 `resolveTriggerParameters`/
  `isCoerceFailure` 로 스키마 불일치(무효 JSON 등)를 `coerce_failed` 로 거부하는 서버측
  백스톱을 diff 밖에서 이미 갖고 있음을 확인했다(`resolve-trigger-parameters.ts`) — 클라
  가드가 뚫려도 구조 필드의 무효 JSON 은 어차피 서버가 거부한다.

### 5. Egress 마스킹 관문 확장 (backend)
`ExecutionsService.toResponseExecution` 계열 읽기 표면(`findById`/`findByWorkflow`/
`getChain`/`stop`) 전부와 `background-runs.service.ts` 읽기 경로가 `Execution.inputData`
를 `redactStoredDataForResponse` 로 통과시키도록 일관되게 바뀌었다. `ResponseExecution`
타입도 `inputData`를 `Omit`+재선언에 포함시켜, 마스킹을 거치지 않은 경로가 있으면
컴파일 타임에 잡히도록(엔티티 타입 그대로 `as` 캐스트하면 타입 오류) 강제하는 구조다.
webhook ingestion 시점 `[REDACTED]` 마커(민감 헤더, 12-webhook §5.3)가 이번에 새로
관문을 지나게 된 `inputData` 표면에서 **덮어써지지 않는지**(마스커가 이미 마스킹된 값을
재마스킹하지 않는 단조성)를 검증하는 테스트(`⑥`)가 신규로 추가돼 실제 리그레션 포인트를
정확히 짚었다. `executions.service.ts` 전체에서 `inputData` 를 다루는 자리를 grep 해
관문을 우회하는 원문 반환 경로가 남아 있지 않음을 확인했다(rerun 실행용 `original.inputData`
직접 읽기는 서버 내부 재실행 입력 조립용이지 클라이언트 응답이 아니므로 대상 아님).

### 6. 암호화 / 평문 전송
이번 diff 에 해시·암호화·전송 프로토콜 변경 없음.

### 7. 에러 처리
`sanitize-error-message.ts` 변경은 JSDoc(프런트 미러 경로 갱신)뿐 — 마스킹 로직 자체는
무변경. 새 에러 경로(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`)는
내부 상태·스택트레이스를 노출하지 않는 일반 안내 문구다.

### 8. 의존성 보안
신규/변경 의존성 없음.

## 발견사항

없음.

## 요약

이 changeset 은 egress 마스킹 카브아웃 폐지라는 보안/데이터-무결성 성격의 변경을
backend 마스킹 관문 확장(3개 읽기 표면 + 자매 background-run 표면)과 frontend 3개
재제출 소비처의 마커 감지 가드로 구현한다. 핵심 방어 로직(`isMaskedMarker`/
`hasMaskedMarkerLeaf`, `blockedByMaskedInput` 세 조건)은 이전 6라운드 리뷰가 재현한
세 가지 우회 경로(값-기반 판정의 스키마 지연 도착 우회, touch 영구화, 무효 JSON 폴백)
전부에 대응하는 캐너리 테스트로 고정돼 있고, 소스를 직접 열어 프런트 깊이 상한(10)이
backend `MAX_REDACT_DEPTH`(10)와 일치함·webhook `[REDACTED]` 마커 보존 계약이 새로
관문을 지나는 `Execution.inputData` 표면에서도 깨지지 않음을 실측 확인했다. 하드코딩된
시크릿, 인젝션 벡터, 인증/인가 우회는 발견되지 않았다. 클라이언트 측 마스킹-마커 가드는
confidentiality 방어가 아니라 재제출 데이터 무결성 방어이며, 이를 우회해도 새로운 정보
노출은 발생하지 않고(자기 자신의 재실행 입력만 오염) 서버측 스키마 검증(`coerce_failed`)
이 구조 필드의 무효 입력을 별도로 거부하는 것도 확인했다. 신규로 지적할 CRITICAL/WARNING
없음.

## 위험도

NONE
