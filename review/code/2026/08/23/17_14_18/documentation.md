# 문서화(Documentation) 리뷰 — assistant-mask-leak (재검토, `16_46_56` RESOLUTION 반영 후)

## 컨텍스트

이번 라운드는 이전 문서화 리뷰(`review/code/2026/08/23/16_46_56/documentation.md`, 위험도 LOW)가
낸 WARNING 1건·INFO 2건에 대한 `RESOLUTION.md` 처분을 검증하는 재검토다. 실제 코드/스펙 변경은
`CHANGELOG.md`·`mask-sensitive-fields.util.{ts,spec.ts}`·`handler-output.adapter.spec.ts`·
`explore-tools.service.{ts,spec.ts}`·plan 3건·spec 4건이고, 나머지(`review/code/16_46_56/**`·
`review/consistency/16_09_25,16_21_45/**`)는 이전 라운드의 감사 산출물이라 이번 문서화 관점 재평가
대상이 아니다(이 저장소 관례상 `review/` 는 커밋 대상).

## 발견사항

- **[INFO]** (재확인, 이미 알려짐) LLM 도구 설명 문자열이 값-패턴 축 마스킹을 반영하지 않는다 — 여전히 미조치
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/tool-definitions.ts:170`
    (`'Sensitive fields (apiKey, token, password, secret, authorization, etc.) are auto-masked
    server-side.'`), `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts:234`
    (`'Per-node \`inputData\` / \`outputData\` / \`error\` are auto-masked for sensitive keys.'`)
  - 상세: `16_46_56/documentation.md` 가 낸 동일 INFO 가 `RESOLUTION.md` 에서 "9는 과다 마스킹 방향이라
    안전 쪽" 이라는 근거로 명시적으로 미조치 처리됐다. 현재 코드를 다시 확인해도 두 문자열은 이전과
    동일하며(diff 밖), `redactAssistantFields` 가 이제 키 이름과 무관하게 문자열 값 안의 자격증명
    패턴까지 가리는데도 두 설명은 "sensitive fields/keys" 라는 키 기반 표현만 유지한다. 처분이 합리적이라
    재차 WARNING 으로 격상할 근거는 없지만, 다음 사람이 이 도구 설명을 근거로 "필드명이 목록에 없으면
    안전하다" 고 잘못 판단할 여지는 여전히 남아 있다.
  - 제안: 이전과 동일 — 필수는 아님. 처분 유지에 동의.

- **[INFO]** (재확인, 이미 알려짐) `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 의 `egress-masking.md`
  참조가 여전히 하이퍼링크가 아닌 평문이다
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md:259`
    (`"...값 패턴 기반 \`deepRedactSecrets\`(Egress 마스킹 좌표계 참조). ..."`)
  - 상세: 같은 문단의 EIA 참조(`:265`, `[EIA §R17](../5-system/14-external-interaction-api.md)`)는
    실제 마크다운 링크인데, `egress-masking.md` 참조는 `16_21_45` consistency-check 가 "필수 아님"으로
    제안한 대로 텍스트 언급만 유지됐다. `spec/conventions/egress-masking.md` 파일은 실재하므로
    `[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 형태로 링크화 가능하다.
  - 제안: 이전과 동일 — 급하지 않음, 발견성 개선 목적의 경량 후속 정리로 남겨도 무방.

## 확인했지만 문제 없음 (WARNING/INFO 반영 검증)

- **CHANGELOG WARNING 반영 확인**: `CHANGELOG.md` 에 신설된
  `## Unreleased — workflow-assistant LLM 도구의 마스킹을 값 축까지 넓혔다 (포맷 변경 포함)` 항목이
  바로 아래(같은 파일) `## Unreleased — \`token\` 계열이 값·키 두 축에서...` 항목과 상호 참조하며,
  세 가지 실제 변경(값 축 신설·포맷 `****<last4>`→`***`·`DEFAULT_SENSITIVE_KEYS` token 계열 8개 추가)을
  정확히 설명한다. 자매 표면(`handler-output.adapter.ts`)의 값 축을 의도적으로 안 닫았다는 점과
  `--impl-prep` BLOCK:YES → planner 턴 경위까지 기록돼 있어 이 저장소의 기존 CHANGELOG 관례(보안·마스킹
  변경마다 Unreleased 항목)와 일치한다. 코드 대조 결과 서술과 실제 동작이 어긋나는 곳 없음.
- **maintainability WARNING #3 반영 확인**: `explore-tools.service.ts` 를 직접 Read 해 확인 —
  `redactAssistantFields` 함수와 그 30줄 JSDoc 이 이제 클래스 JSDoc(`Read-only "Clarify" 도구들...`)
  **위**(모듈 레벨 상수·타입 선언 직후)로 옮겨졌고, 클래스 JSDoc 닫는 `*/` 와 `@Injectable()` 사이에
  빈 줄 하나가 추가돼 시각적으로도 클래스 doc과 클래스 선언이 다시 인접한다. 지적된 소속 혼동은 해소됨.
- **testing WARNING #2 부수 문서화 확인**: `handler-output.adapter.spec.ts` 신규 `it.each` 블록의
  주석이 "이 표면은 값-패턴 층을 겹치지 않으므로 `DEFAULT_SENSITIVE_KEYS` 가 유일한 방어" ·
  "workflow-assistant 쪽 테스트로는 안 잡힌다(뮤테이션으로 확인)" 를 정확히 설명하고, 대조군
  (`endpoint` 는 손상되지 않음)에도 "과잉 마스킹이 곧 기능 회귀" 라는 이유를 남겨 재발견 비용을 낮춘다.
- **소스 주석 사실 정확성 spot-check**: `mask-sensitive-fields.util.ts` 신규 주석이 인용하는
  `http-request.handler.ts` 의 `auth_token` 이 실제로 `QUERY_PARAM_BLACKLIST`(라인 53~58) 소속이며
  이 상수(`DEFAULT_SENSITIVE_KEYS`)와 무관하다는 서술을 코드로 직접 대조해 정확함을 확인했다.
  `explore-tools.service.ts` JSDoc 이 인용하는 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`/
  `MAX_REDACT_DEPTH` 심볼명도 `sanitize-error-message.ts` 실제 선언과 일치한다.
- **spec 4곳 동기화 상태 유지 확인**: `4-ai-assistant.md` §4.1.1(+scoping/키축/잔여갭 캐비엇 3블록)·
  `:1435` 결정 메모 표·`14-external-interaction-api.md` §R17 잔여③(취소선 보존 + flip)·
  `_product-overview.md` EH-NAV-04·`egress-masking.md` §1 표+`code:` 2건이 이번 라운드에서도
  변경 없이 그대로이며 코드(포맷 `***`, `DEFAULT_SENSITIVE_KEYS` 8개, `deepRedactSecrets` 중첩)와
  여전히 일치한다.
- `egress-masking.md` 에 이번 PR이 추가한 "표를 갱신한 실례" 문단(§3, 2026-08-23)은 바로 아래 이미
  존재하던 별개 태스크(`masking-gate-consolidation`, 병렬 세션에서 먼저 머지된 것으로 보임)의
  "그 예고는 틀렸다 — 표는 무변경" 문단과 인접하지만, 전자는 "마스커가 새 표면에 도달"(변경 있음),
  후자는 "호출부만 묶임"(변경 없음)으로 서로 다른 시나리오를 대비시키는 구성이라 모순이나 혼란은 없다.

## 요약

이전 문서화 리뷰(`16_46_56`)가 지적한 WARNING(CHANGELOG 누락)은 상호 참조까지 갖춘 상세한 Unreleased
항목으로 정확히 반영됐고, maintainability 리뷰의 JSDoc 배치 WARNING도 함수를 클래스 JSDoc 위로 옮겨
해소됐다. 새로 추가된 소스 주석·JSDoc·spec 서술을 코드와 직접 대조한 결과 사실 오류나 stale 서술은
발견되지 않았다. 남은 것은 이전 라운드에서 이미 "필수 아님"으로 명시적으로 유예된 INFO 2건(도구 설명
문자열의 값-축 미반영, `egress-masking.md` 참조 링크화)뿐이며 이번 라운드도 같은 판단을 유지한다.

## 위험도

NONE
