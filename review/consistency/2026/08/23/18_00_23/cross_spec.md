# Cross-Spec 일관성 검토 — spec/3-workflow-editor/ (assistant-mask-leak, impl-done)

## 검토 범위 요약

이번 PR 의 실제 diff(`codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` ·
`.spec.ts`, `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts`,
`codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` · `.spec.ts`)는
① `DEFAULT_SENSITIVE_KEYS` 에 `token` 접두 계열(`csrfToken`/`csrf_token`/`authToken`/`auth_token`/
`sessionToken`/`session_token`/`idToken`/`id_token`) 8개 키를 추가하고, ② workflow-assistant LLM
도구(`ExploreToolsService.getExecutionDetails`/`get_workflow_executions`)의 `inputData`/`outputData`/
`error` 응답에 `maskSensitiveFields`(키 축) 위에 `deepRedactSecrets`(값 축)를 겹쳐 자유 텍스트 안의
자격증명까지 가리도록 바꿨다(출력 포맷이 `"****<last4>"` → `"***"` 로 바뀜, 식별 힌트 트레이드).

`git diff origin/main...HEAD --stat -- spec/` 로 확인한 이번 PR 의 spec 변경분은 정확히 4개
파일이며, 전부 같은 결정을 동반 갱신했다:

- `spec/3-workflow-editor/4-ai-assistant.md` (target, §4.1.1 마스킹 규칙 + Rationale 실행조회 도구 표)
- `spec/5-system/14-external-interaction-api.md` (§R17 "잔여③ 해소" + `token` 계열 캐비엇 해소)
- `spec/conventions/egress-masking.md` (좌표계 표 2행 소비처에 workflow-assistant 추가 + `code:` 갱신)
- `spec/2-navigation/_product-overview.md` (EH-NAV-04 행 — 2중 마스킹 서술로 갱신)

이 네 파일을 상호 대조한 결과 **데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느
관점에서도 CRITICAL 급 직접 모순은 발견되지 않았다.** 각 문서가 서로를 명시적으로 SoT 로
교차 인용하고("포맷 SoT는 AI Assistant §4.1.1", "정책·잔여 갭 SoT는 EIA §R17", "좌표계 SoT는
egress-masking.md"), `VALUE_MASK_MARKER = "***"` 실제 상수·`redactStoredFieldsForResponse` 실제
함수명 등 코드 사실과도 일치한다. `ED-AI-37` 요구사항 ID 도 `_product-overview.md`/`4-ai-assistant.md`
양쪽에서 동일 의미로만 쓰이고 중복·충돌이 없다.

다만 사소한 문서 동기화 갭 3건을 아래에 남긴다 — 전부 INFO 급이며 이 PR 을 막을 필요는 없다.

## 발견사항

- **[INFO]** 같은 target 파일 안의 "구현 단계 유의 사항" 항목이 이번 갱신에서 빠짐
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` — "실행 조회 도구 기획 결정 메모" §
    "구현 단계에서 유의 사항 (실제 구현 반영)" 4번 항목 (현재 라인 ~1471)
  - 충돌 대상: 같은 파일의 §4.1.1 "마스킹 규칙"(현재 라인 259~264)과 바로 위 표의 "민감 필드 마스킹"
    행(현재 라인 1435) — 둘 다 이번 PR 에서 `maskSensitiveFields` + `deepRedactSecrets` 2층 구조로
    갱신됨
  - 상세: `git diff origin/main...HEAD -- spec/3-workflow-editor/4-ai-assistant.md` 로 확인하면
    라인 1435(표)는 "~~`maskSensitiveFields` 공통 유틸 재귀 적용~~ → **2026-08-23 결정으로 대체**"로
    갱신됐지만 바로 아래 "구현 단계에서 유의 사항" #4 는 손대지 않아 여전히 *"`mask-sensitive-fields.
    util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩
    통과시킴"* 이라는 옛 단일-층 서술이 남아 있다. 엄밀히는 target 문서 **내부**(같은 파일) 불일치라
    "다른 spec 영역과의 충돌"은 아니지만, 이 절이 §4.1.1 을 "SoT" 로 참조하는 문서 구조("응답
    envelope (spec §4.1.1 참조)")를 갖고 있어 두 서술이 병존하면 나중에 이 표를 읽는 사람이 옛
    구현 방식(2단계 이전)을 그대로 따라할 위험이 남는다
  - 제안: 4번 항목을 "`maskSensitiveFields` + `deepRedactSecrets` 2층(§4.1.1 참조)"로 한 줄 갱신하거나,
    §4.1.1 을 가리키는 링크만 남기고 세부 서술은 삭제해 SoT 중복을 없앤다

- **[INFO]** "잔여 갭" 열거가 target 과 EIA §R17 사이에서 항목 수가 다르다
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "잔여 갭은 상속된다" 콜아웃
    (현재 라인 264): *"자격증명 **없는** 연결 문자열 · 내부 호스트명 · 스택 프래그먼트"* (3항목)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 갭(의도)" 불릿:
    *"자격증명 없는 연결 문자열·내부 호스트명·**사설 IP**·스택 프래그먼트"* (4항목, "사설 IP" 포함)
  - 상세: 직접적 모순(둘 다 "통과시키는 갭이 있다"는 방향은 같음)은 아니지만, target 이 EIA 를
    "그대로 인용"하는 형태로 적어 두었는데 항목 하나가 누락돼 목록 자체를 SoT 삼아 읽는 사람에게는
    "사설 IP 는 이 표면에서 안 통과하나?"라는 오독 여지를 준다
  - 제안: target 콜아웃에 "사설 IP" 를 추가하거나, 목록을 나열하지 않고 "EIA §R17 잔여 갭 목록
    전체를 그대로 상속한다"로 축약해 향후 EIA 쪽 항목이 늘어도 target 이 낡지 않게 한다

- **[INFO]** `spec/1-data-model.md` §2.14 "응답 마스킹" 행이 이번에 새로 갈라진 "AI Assistant 전용,
  포맷이 다른 마스킹"의 존재를 신호하지 않음
  - target 위치: (참조 대상) `spec/1-data-model.md` 라인 564 — `Execution.error`/`NodeExecution.error`
    "응답 마스킹" 설명, *"SoT 는 [EIA §R17] 의 '적용 범위는 총칭이 아니라 열거다' 항목이다"*
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R17 — 이번 PR 이 갱신한 "workflow-assistant
    LLM 도구" 불릿은 "적용 범위는 총칭이 아니라 열거다" 가 가리키는 **6표면·2컬럼 열거 블록의 바깥**에
    별도 불릿으로 존재하고, 그 불릿만 유일하게 포맷을 `"***"` 로 다르게(식별 힌트 없이) 낸다
  - 상세: data-model.md 는 이 diff 로 수정되지 않았으므로 이 갭 자체는 이번 PR 이 만든 게 아니라
    기존 패턴이다. 다만 이번 PR 로 "AI Assistant 도구의 마스킹 포맷이 나머지 열거 표면과 실제로
    달라진다"(`****<last4>` 형태 보존 vs `***` 완전 치환)는 사실이 새로 생기면서, data-model.md 의
    "SoT는 그 열거 항목" 이라는 문구를 그대로 따라간 독자가 AI Assistant 경로의 이 차이를 놓칠
    가능성이 이전보다 커졌다. CRITICAL 은 아니다 — `Execution`/`NodeExecution` 엔티티 필드 자체의
    타입·의미는 안 바뀌었고, 실제 포맷 차이는 EIA §R17 본문에 명시돼 있다
  - 제안: (target 이 아니라 data-model.md 쪽 후속 과제) §2.14 "응답 마스킹" 행에 "단, workflow-assistant
    LLM 도구는 별도 강도(포맷 파괴적 `***`) — SoT 는 [AI Assistant §4.1.1]" 한 문장을 추가하면 이
    간극이 닫힌다. 이번 PR 의 착수 범위(target 문서)를 넘어서므로 이 리뷰에서는 정보성으로만 남긴다

## 요약

target(`spec/3-workflow-editor/4-ai-assistant.md`)의 이번 마스킹 강화 변경은 같은 커밋 세트 안에서
`spec/5-system/14-external-interaction-api.md`(§R17) · `spec/conventions/egress-masking.md`(좌표계
표) · `spec/2-navigation/_product-overview.md`(EH-NAV-04)와 함께 동반 갱신되어 있고, 네 문서가 서로를
명시적 SoT 로 교차 인용하며 실제 코드 상수(`VALUE_MASK_MARKER = "***"`)·함수명과도 일치한다. 요구사항
ID(`ED-AI-37`) 중복도 없고 데이터 모델·API 계약·RBAC·상태 전이·계층 책임 어느 축에서도 직접 모순은
찾지 못했다. 남은 3건은 모두 INFO 수준의 문서 동기화 권고(같은 target 파일 내 stale 체크리스트 1곳,
잔여 갭 열거 항목 수 불일치 1곳, data-model.md 의 SoT 포인터가 신규 예외를 아직 신호하지 않는 것
1곳)이며, PR 채택을 막을 필요는 없다.

## 위험도

LOW
