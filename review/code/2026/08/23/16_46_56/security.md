# 보안(Security) 코드 리뷰

## 스코프

리뷰 대상 diff 는 workflow-assistant LLM 도구(`ExploreToolsService`)가 `inputData`/`outputData`/`error`
세 필드를 반환할 때 걸던 마스킹을 강화하는 보안 수정이다.

- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` — `DEFAULT_SENSITIVE_KEYS` 에
  `token` 계열 접두형 8개(`csrfToken`/`csrf_token`/`authToken`/`auth_token`/`sessionToken`/
  `session_token`/`idToken`/`id_token`) 추가.
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` — 신설
  `redactAssistantFields()` 가 `deepRedactSecrets(maskSensitiveFields(v))` 로 키-축과 값-축 마스킹을
  중첩해 `toNodeExecutionEnvelope`/`toExecutionEnvelope` 두 지점에 적용.
- 나머지(스펙·plan·review 산출물)는 코드 실행 경로가 아니므로 보안 관점에서 실질 영향 없음.

## 발견사항

- **[INFO]** 자매 표면 `handler-output.adapter.ts` 의 값-축(문자열 안 `Bearer …`/URI 자격증명)이 이번
  diff 로 닫히지 않고 여전히 열려 있음(이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  에 별도 항목으로 등재·추적됨, 값을 겹치면 DB 저장/WS emit/표현식이 읽는 값이 바뀌는 위험이 있어 의도적으로
  범위 밖).
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` (본 diff 에는 포함되지 않음)
  - 상세: 이번 PR 이 고친 것은 workflow-assistant LLM 도구 read 경로뿐이며, 노드 `config` echo →
    DB 저장·WS emit·표현식으로 흐르는 값-축은 여전히 키-축(`maskSensitiveFields`)만 적용된다. 회귀는
    아니고 새로 만든 취약점도 아니지만, 아직 열려 있는 유출 표면이라는 사실 자체는 보안 리뷰에서 기록해 둘
    가치가 있음.
  - 제안: 이미 트래킹된 항목이므로 별건 착수 전 재확인만 하면 됨(추가 조치 불요).

- **[INFO]** 마스킹 마커 표기 이원화 — `explore-tools.service.ts` 출력은 이번 diff 로 공유 계약
  `VALUE_MASK_MARKER`(`"***"`, `codebase/packages/masked-markers/src/index.ts`)와 일치하게 됐으나,
  `handler-output.adapter.ts` 산출물은 여전히 `****<last4>` 포맷이라 그 계약 밖에 있음. 향후 그 표면이
  재제출 가능 경로(폼 프리필/Re-run 모달/에디터 히스토리 로드)에 들어가면 `isMaskedMarker` 가
  `****<last4>` 를 인식하지 못해 이미 마스킹된 값을 "새 입력"으로 오인해 재제출을 허용할 수 있음.
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` vs
    `codebase/packages/masked-markers/src/index.ts` (`isMaskedMarker`)
  - 상세: consistency checker(`review/consistency/2026/08/23/16_09_25/SUMMARY.md` INFO #1)가 이미 동일
    위험을 등재했고, plan(`spec-sync-external-interaction-api-gaps.md`)도 "오늘은 그 경로에 없다"고 확인함.
    현재는 실질적 보안 구멍이 아님.
  - 제안: 해당 표면이 재제출 가능 경로로 확장될 때 이 노트를 재확인.

## 긍정적 확인 사항 (회귀 없음 검증)

- `DEFAULT_SENSITIVE_KEYS` 신규 8개 항목은 `sanitize-error-message.ts` 의
  `CREDENTIAL_KEY_PATTERN`(`^(...|[a-z0-9_-]*token|...)$/i`)에 전부 이미 포함되어 있어, 값-축 레이어와
  키-축 레이어가 서로 보강 관계다(한쪽이 놓쳐도 다른 쪽이 잡는 defense-in-depth) — 코드를 직접 대조해
  키 목록 전 항목이 정규식과 어긋나지 않음을 확인함.
- `redactAssistantFields` 의 합성 순서(`deepRedactSecrets(maskSensitiveFields(v))`, 키 먼저 값 나중)는
  주석이 설명하는 의도와 일치하며, 역순일 때 발생한다는 "두 층이 서로를 지운다" 문제가 실제로 없음을
  코드 경로로 확인함(값-패턴 레이어가 이미 `****<last4>` 형태의 문자열을 다시 `***` 로 전부 통일).
  `isMaskedMarker` 가드가 정확 일치(`=== '***'`)만 보므로 `****1234` 는 "이미 마스킹됨"으로 오인되지
  않고 올바르게 `***` 로 재마스킹됨 — 이중 마스킹 우회 없음.
  - 확인 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`deepRedactObject`,
    `CREDENTIAL_KEY_PATTERN`), `codebase/packages/masked-markers/src/index.ts` (`isMaskedMarker`,
    `VALUE_MASK_MARKER`).
- `redactAssistantFields()` 는 `inputData`/`outputData`/`error` 세 필드만 추출해 반환하고,
  `toNodeExecutionEnvelope`/`toExecutionEnvelope` 는 나머지 필드를 명시적 리터럴로만 구성 —
  스프레드로 인해 엔티티의 다른 미마스킹 필드가 실수로 함께 노출될 여지 없음
  (`codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:97-112`,
  `:500-514`, `:516-532`).
- 인증/인가 로직(`workspace_id` 스코프 필터, `isExecutionInScope`, UUID 형식 검증, cross-workspace
  존재 여부 통합 응답 `EXECUTION_NOT_FOUND`)은 diff 에서 변경되지 않음 — 이번 변경으로 인한 인가 우회
  가능성 없음.
- 테스트 fixture 의 자격증명류(`sk-live-abc123def456`, `postgres://u:pw@db.internal/prod`,
  `tok_xyz_0001` 등)는 모두 마스킹 동작 검증용 합성 값이며 실제 시크릿이 아님 — 하드코딩된 시크릿
  이슈 아님.
- 인젝션(SQL/XSS/커맨드/경로 탐색), 암호화 알고리즘, 의존성 관련 변경은 이 diff 범위에 없음.

## 요약

이번 diff 는 신규 취약점을 도입하지 않고, workflow-assistant LLM 도구가 반환하던 `inputData`/
`outputData`/`error` 세 필드의 마스킹 취약점(값 문자열 안의 `Bearer …`/자격증명 URI 완전 통과, `token`
접두 계열 키 평문 통과)을 실측 기반으로 닫는 보안 강화 변경이다. 두 마스킹 레이어(키-축 `maskSensitiveFields`,
값-축 `deepRedactSecrets`)의 합성 순서·마커 일치 여부를 코드 레벨로 직접 검증했고 이중 마스킹 우회나
인가 로직 변경은 없었다. 유일하게 남은 항목은 이미 별도로 추적 중인 자매 표면(`handler-output.adapter.ts`)의
값-축 잔여 갭과 마커 포맷 이원화이며, 둘 다 이번 PR 의 스코프 밖으로 의도적으로 분리되어 있고 현재 시점에
악용 가능한 경로가 없음이 plan/consistency 문서로 확인된다.

## 위험도

NONE
