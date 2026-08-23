# Plan 정합성 검토 — `spec-update-assistant-masking.md`

## 발견사항

- **[WARNING]** `egress-masking.md` §1 좌표계 표 · `code:` frontmatter 가 target 집행 직후 stale 해진다
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` §"고칠 두 곳" (spec_impact 는
    `4-ai-assistant.md` · `14-external-interaction-api.md` 두 파일만 선언)
  - 관련 문서: `spec/conventions/egress-masking.md` §1 좌표계 표 **표 2행**
    ("`deepRedactSecrets`(REST 응답·저장 에러·conversation thread)") + frontmatter `code:` 목록
  - 상세: 자매 developer plan(`assistant-mask-leak.md`)의 코드는 이미 커밋됐다(`3aaa4cd19`,
    `git show` 로 실측). `explore-tools.service.ts` 가 신설한 `redactAssistantFields` 가
    `deepRedactSecrets(maskSensitiveFields(v))` 를 호출해 **`deepRedactSecrets` 의 새 소비처**가
    생긴다(workflow-assistant LLM 도구 explore 응답 — `inputData`/`outputData`/`error` 3필드).
    그런데 `egress-masking.md` §1 표 2행은 소비처를 "REST 응답·저장 에러·conversation thread"
    로만 열거하고 이 신규 표면을 담지 않는다. 같은 문서 `code:` frontmatter 도
    `mask-sensitive-fields.util.ts`/`explore-tools.service.ts` 를 등재하지 않는다.
    `egress-masking.md §3` 은 스스로 "이 문서는 기계가 지키지 않는다 — 사람이 갱신해야 한다"
    라 명시하고, 최근 사례(2026-08-23 `masking-gate-consolidation` 세션)로 같은 표가 실제로
    갱신 누락 위험을 겪은 이력도 있다. `redact-stored-error.ts` 위생 4건 트래커(같은 트래커
    문서 554행)에도 "`egress-masking.md` frontmatter `code:` 미등재" 가 이미 한 번 지적된
    같은 패턴이다.
  - 제안: target 의 spec_impact 에 `spec/conventions/egress-masking.md` 를 추가해 §1 표 2행
    소비처 열에 신규 표면(예: "workflow-assistant explore 응답")을 등재하고, `code:` 에
    `mask-sensitive-fields.util.ts`·`explore-tools.service.ts` 를 더한다. (§2 "마스킹은 한 번"
    불변식과의 관계 — 이 표면은 키-마스킹 결과를 값-마스킹이 의도적으로 덮는 예외라는 점도
    한 줄 caveat 로 남기는 편이 안전하다.)

- **[WARNING]** 트래커 W1 종결이 자매 표면(`handler-output.adapter.ts`)의 값 축 잔여를
  조용히 삼킬 위험 — 같은 문서가 이미 경고한 패턴의 재발 후보
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` 작업 목록
    "트래커 `17_12_34` W1 종결"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 470~486행
    (W1 원문) 및 `plan/in-progress/assistant-mask-leak.md` 156~161행("표면별로 강도를
    나눈다") · 177행("자매의 값 축 잔여를 트래커에 등재" — 아직 `[ ]` 미체크)
  - 상세: `assistant-mask-leak.md` 는 `handler-output.adapter.ts` 를 **키 축만** 넓히고
    값 축(문자열 안 `Bearer …` 등)은 위험(저장값·표현식이 읽는 값 변경) 때문에 의도적으로
    남겨 뒀다. 이 잔여는 별도 트래커 항목으로 등재해야 한다는 TODO 가 developer plan 에
    이미 있지만 아직 미완이다. target 이 planner 턴에서 트래커 W1("workflow-assistant LLM
    도구가 … 더 약한 마스킹으로 내보낸다")을 그대로 닫아 버리면, 같은 트래커 문서
    246~249행이 스스로 기록해 둔 교훈 — *"결합 항목을 둘로 쪼갰다 … 한 체크박스로 두면
    완료 시 통째로 닫히면서 나머지가 조용히 사라진다 — 이 세션에서 이미 겪은 형태다"* —
    가 그대로 재발할 수 있다. W1 은 `explore-tools.service.ts` 표면만 완전히 닫혔을 뿐
    `handler-output.adapter.ts` 값 축은 여전히 열려 있다.
  - 제안: W1 종결 편집 시 (a) 자매 표면의 값 축 잔여를 **새 별도 체크박스**로 함께 등재하고
    나서 W1 을 닫거나, (b) W1 종결 노트에 "값 축은 `handler-output.adapter.ts` 아래 별도
    항목으로 분리됨" 문구를 명시해 사라짐을 방지한다. `assistant-mask-leak.md` 의
    "자매의 값 축 잔여를 트래커에 등재" 체크박스가 이 planner 편집과 같은 시점에 함께
    완료되는지 확인할 것.

- **[WARNING]** `4-ai-assistant.md` 내부 자기참조 표(§4.1.1 밖)가 target 편집 범위 밖에 남는다
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` "고칠 두 곳 → 1." 은
    §4.1.1 만 명시
  - 관련 문서: 같은 파일 `spec/3-workflow-editor/4-ai-assistant.md:1429` "확정된 결정 사항"
    표의 "민감 필드 마스킹" 행("`maskSensitiveFields` 공통 유틸 재귀 적용 …. 기존 유틸
    재사용") + `:1432` "응답 envelope (spec §4.1.1 참조)" — 이 절이 §4.1.1 을 SoT 로
    명시적으로 가리킨다.
  - 상세: §4.1.1 이 `deepRedactSecrets` 중첩과 `***` 포맷으로 바뀌는데, 그 아래 "실행 조회
    도구 기획 결정 메모" 표는 여전히 "`maskSensitiveFields` 공통 유틸 재귀 적용 …. 기존
    유틸 재사용" 이라 적어 **같은 파일 안에서 §4.1.1 을 인용하면서 §4.1.1 과 어긋나는**
    상태가 된다. target 이 §4.1.1 문구만 고치고 이 표를 지나치면 발견되지 않은 채 남을
    가능성이 높다(1400줄 넘는 파일에서 참조 관계가 멀리 떨어져 있다).
  - 제안: 같은 편집에서 `:1429` 행도 "`maskSensitiveFields` + `deepRedactSecrets` 중첩,
    `***`" 로 갱신하거나, 최소한 §4.1.1 을 가리키는 포인터로 대체해 재기술(prose 복제)을
    없앤다.

- **[INFO]** EIA §R17 잔여③ 바로 위 "`token` 계열 확장은 잔여③에 미치지 않는다" 캐비엇이
  flip 이후에도 남으면 자기모순이 된다
  - target 위치: `plan/in-progress/spec-update-assistant-masking.md` "고칠 두 곳 → 2."
    (EIA §R17 잔여③ flip 만 명시)
  - 관련 문서: `spec/5-system/14-external-interaction-api.md:1648-1650` — *"다만 이 확장은
    잔여 ③ 에 미치지 않는다 — `maskSensitiveFields` 의 키 목록은 리터럴 나열이라 접두
    계열이 아직 통과한다."*
  - 상세: 이 문장은 "`token` 계열 확장이 잔여③에는 안 미친다"는 **당시 사실**을 적은
    것인데, target 이후엔 `DEFAULT_SENSITIVE_KEYS` 에 token 계열이 추가되고
    `explore-tools.service.ts` 가 `deepRedactSecrets`(값+키 축 전면)까지 두르므로 이
    캐비엇의 전제가 무너진다. 잔여③ 표시를 취소선+결정으로 덮을 때 바로 위 이 문장도
    같이 취소선 처리하지 않으면 "확장은 잔여③에 안 미친다"(구) vs "잔여③ 결정 완료"(신)가
    같은 문단에서 충돌한다.
  - 제안: 잔여③ flip 편집에 이 캐비엇 문장의 취소선 처리를 함께 포함한다(다른 checker —
    cross_spec/rationale_continuity — 도 이 지점을 잡을 가능성이 높다).

## 요약

Target 은 EIA §R17 "잔여③"이 명시적으로 열어 둔 "값-패턴 vs 키-힌트 우선순위" 결정을
사용자 결정(유출 차단 우선)으로 정당하게 닫는 **planner 턴**이며, 미해결 결정을 우회하지
않고 정면으로 반영한다는 점에서 구조적으로 올바르다. 자매 developer plan 의 코드
(`3aaa4cd19`)도 실측 확인 결과 target 이 서술하는 것과 일치한다(explore-tools 6곳 헬퍼화,
`DEFAULT_SENSITIVE_KEYS` token 계열 추가, `***` 포맷 캐너리). 다만 target 의 spec_impact
범위(2개 파일)가 실제 파급을 다 덮지 못한다 — ①`spec/conventions/egress-masking.md` 의
소비처 좌표계 표·frontmatter 가 새 `deepRedactSecrets` 소비처(explore-tools)를 반영하지
못한 채 stale 해지고, ②트래커 `17_12_34` W1 종결이 자매 표면(`handler-output.adapter.ts`)의
아직 열린 값 축 잔여를 조용히 삼킬 위험이 있으며(이 저장소가 같은 문서에서 이미 겪었다고
스스로 기록한 패턴), ③같은 `4-ai-assistant.md` 파일 안에 §4.1.1 을 참조하는 별도 결정
메모 표가 편집 범위 밖에 남아 파일 내부 자기모순을 만들 수 있다. 셋 다 CRITICAL 급 결정
충돌은 아니지만(미해결 결정을 새로 우회하는 것이 아니라 "이미 하기로 한 일의 반경을
빠뜨린" 성격), 이 PR 이 스스로 강조하는 "spec-impl drift 를 만들지 않는다"는 목표와
정면으로 관련되므로 WARNING 으로 반영을 권한다.

## 위험도
MEDIUM
