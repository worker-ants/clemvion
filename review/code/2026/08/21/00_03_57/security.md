# 보안 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

실제 코드 변경(파일 1~8):
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(파일 9~41)는 plan/consistency-review 산출물과 spec 문서로, 애플리케이션 코드가 아니라 이번 변경의 배경/근거 기록이다. 하드코딩 시크릿·인젝션 표면이 없어 보안 관점에서 별도 발견사항 없음(문서 내용은 코드 사실과 대조해 확인했고 불일치 없음).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `findMaskedResubmissions`(`reject-masked-resubmission.ts` 전체)의 재귀는 `MAX_REDACT_DEPTH`(10)로 깊이만 제한하고 각 레벨의 branching factor(객체 key 수·배열 길이)는 제한하지 않는다. 이론상 폭이 넓은 트리에서 방문 노드 수가 커질 수 있으나, 방문 노드 수는 결국 파싱된 JSON 트리의 전체 노드 수(≈ 요청 본문 크기)를 넘지 않으므로 별도 지수적 증폭은 없다 — 순수 `O(n)`(n = 트리 노드 수)이고, 기존 `deepRedactCore`/`sanitizePayloadForWs`(같은 저장소, 같은 `MAX_REDACT_DEPTH`)와 동일한 위험 프로파일이다. 이 PR 이 새로 만든 표면이 아니라 기존 패턴을 재사용한 것이라 추가 조치 불필요. 참고로 순환 참조 우려도 없다 — 입력은 `JSON.parse`(또는 이미 파싱된 JSON body)를 거친 값이라 cycle 이 생길 수 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `hasMaskedLeaf`
- **[INFO]** 에러 응답(`TriggerParameterErrorDetail`)에는 `field`(스키마에 정의된 파라미터명)·`code`(고정 enum)·`message`(고정 문자열)만 실리고, 실제로 제출된 값(마스킹 마커든 원문이든)은 어디에도 echo 되지 않는다 — 정보 노출 관점에서 안전하게 설계됨을 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` `toTriggerParameterErrorDetails`/`REASON_TO_DETAIL`
- **[INFO]** 이번 변경 자체가 방어 강화다: re-run(`executions.service.ts`)과 execute(`workflows.controller.ts`) 두 Manual 실행 진입점에서 egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)가 그대로 재제출되면 400 으로 거부한다. 종전에는 프런트 렌더 경로에서만 막혀 `curl` 등 API 직접 호출로 우회되면 마스킹된 표시값이 그대로 새 실행의 실제 입력(예: 자격증명 필드)이 되는 문제가 있었다. 값 비교가 깊이 검사보다 먼저 수행되어(주석·테스트로 명시) 상한 깊이(정확히 `MAX_REDACT_DEPTH`)에 놓인 치환 마커를 놓치지 않는 off-by-one 회피가 되어 있고, 정확 일치만 보아 `a***b` 류 정상 값을 과잉 차단하지 않는 경계도 캐너리 테스트로 고정돼 있다.
- **[INFO]** `re-run` 경로의 선존 결함(내부 `errors` 키로 던져 `GlobalExceptionFilter` 가 `details` 만 읽어 필드별 내역이 조용히 버려지던 문제)이 이번 변경에서 함께 `details: toTriggerParameterErrorDetails(err.errors)` 로 교정됐고, 회귀 방지 테스트(`executions-rerun.service.spec.ts` "[회귀] 거부 응답이 details[] 로...")로 고정됨. 보안 관점에서는 실제 값이 아닌 분류 정보만 노출하므로 이 교정 자체가 새로운 정보 노출을 만들지 않는다.

## 요약

이번 diff 는 Manual 트리거 파라미터 재제출 경로(re-run `inputOverride`, execute `parameterValues`)에서 egress 마스킹 마커가 실제 값으로 그대로 되돌아오는 것을 서버측 2차 방어층으로 차단하는 보안 강화 변경이다. 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화 관련 문제는 발견되지 않았고, 새로 추가된 에러 경로는 실제 제출 값을 노출하지 않고 필드명·고정 코드·고정 메시지만 반환해 정보 노출 위험이 없다. 재귀 깊이는 기존 `MAX_REDACT_DEPTH` 상수를 재사용해 상한이 있으며, 폭 방향 순회 비용은 요청 본문 크기에 선형이라 별도 DoS 증폭 벡터를 추가하지 않는다(기존 `deepRedactCore`와 동일 프로파일). 정확 일치 판정·값→깊이 검사 순서 등 핵심 방어 경계는 회귀/경계 캐너리 테스트로 뒷받침된다.

## 위험도

NONE
