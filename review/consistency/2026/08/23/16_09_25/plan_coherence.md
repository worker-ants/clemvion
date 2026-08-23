### 발견사항

- **[WARNING]** `spec_impact: none` 이 실측과 어긋난다 — 이번 결정이 즉시 stale 로 만드는 target 문서 2곳
  - target 위치:
    - `spec/3-workflow-editor/4-ai-assistant.md:259` §4.1.1 "마스킹 규칙" — *"매칭 키(대소문자 무시): `apiKey`, `api_key`, `password`, `token`, `accessToken`, `refreshToken`, `secret`, `clientSecret`, `authorization`. 매칭된 값이 문자열이면 `"****<last4>"` 로... 치환"* 을 명문화하고, `:789` 에서 요구사항 `ED-AI-37 (민감 필드 마스킹)` 이 이 절을 정본으로 지목한다.
    - `spec/5-system/14-external-interaction-api.md:1652-1658` §R17 카탈로그 "잔여 ③ (범위 밖 유지)" — *"workflow-assistant LLM 도구(`explore-tools.service.ts`)는 ... `maskSensitiveFields`(**키 이름** 기반)로만 내보내 자유 텍스트 안의 자격증명을 통과시킨다 ... 여기에 값-패턴 마스킹을 **단순 합성하면 안 된다** ... 어느 의미가 우선하는지는 별도 결정이라 분리했다"* — 이 문단 자체가 "그쪽 마스킹 규칙의 SoT 는 `4-ai-assistant.md`" 라고 명시 포인터를 건다.
  - 관련 plan: `plan/in-progress/assistant-mask-leak.md` (frontmatter `spec_impact: none`) 가 집행하는 정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `17_12_34` requirement W1 항목("workflow-assistant LLM 도구가 ... 더 약한 마스킹으로 내보낸다").
  - 상세: `assistant-mask-leak.md` 는 "**사용자 결정 (2026-08-23): 유출 차단이 우선**" 으로 `deepRedactSecrets` 를 `explore-tools.service.ts` 에 중첩 적용하기로 했다. 이 결정이 집행되면 값이 `"****<last4>"` 대신 `"***"` 로 바뀌고(단언 6개 갱신을 plan 스스로 명시), `DEFAULT_SENSITIVE_KEYS` 에 `token` 계열이 추가된다 — 둘 다 위 두 target 문서가 지금 정본으로 서술 중인 정확한 문구(리터럴 키 목록·`****<last4>` 포맷·"단순 합성하면 안 된다"는 캐비엇)를 무효화한다. `14-external-interaction-api.md` 의 §R17 캐비엇은 정확히 이 표면을 두고 *"어느 의미가 우선하는지는 별도 결정"* 이라고 적어 뒀는데, 그 결정이 지금 내려지는데도 `assistant-mask-leak.md` 의 작업 목록 8개 항목 어디에도 이 두 target 문서를 갱신하는 태스크가 없다. 같은 트래커 안에 선례가 있다(`spec-sync-external-interaction-api-gaps.md:2295` "§6.4 필드 표 + §R17 마스킹 카탈로그에 이 egress 지점 등재" — 다른 egress 지점을 닫을 때 R17 카탈로그를 함께 갱신했다). `handler-output.adapter.ts`(자매 표면)는 target 문서에 이런 리터럴 서술이 없어 이 문제가 없다 — `4-execution-engine.md` 의 `maskSensitiveFields` 언급은 전부 "동일 정책" 식의 일반 비교이지 키 목록/포맷 열거가 아니다.
  - 제안: (a) `assistant-mask-leak.md` 작업 목록에 두 target 문서 갱신 태스크를 추가 — `4-ai-assistant.md:259`(키 목록 + 포맷) 와 `14-external-interaction-api.md:1652-1658`(잔여 ③ → 해소 서술로 flip, "별도 결정" 문구 제거)를. (b) frontmatter `spec_impact: none` 을 두 경로를 담은 리스트로 정정. (c) CLAUDE.md 규약상 `spec/` 쓰기는 developer 권한 밖이므로, 이 두 문서 편집은 `project-planner` 턴으로 넘기거나(권장) 이 정도 캐비엇 flip 이 "구현 중 spec 변경" 문턱을 넘는지 사용자에게 확인.

- **[INFO]** `maskSensitiveFields` 실사용처 3곳 중 1곳은 주석-only 참조 — 착오 방지 메모
  - target 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280,3351` ("`maskSensitiveFields` boundary 와 동일 정책" 주석)
  - 관련 plan: `plan/in-progress/assistant-mask-leak.md` "표면별로 강도를 나눈다" 표 (2곳만 열거)
  - 상세: `grep -l maskSensitiveFields` 로는 3번째 소비처처럼 보이지만 실제 import/호출이 없다 — 순수 주석 비유다. plan 이 표면을 `explore-tools.service.ts`·`handler-output.adapter.ts` 두 곳으로 한정한 것은 실측과 일치하며 "방어를 한 칸 좁게 잡는" 누락이 아니다.
  - 제안: 조치 불필요. 검토 과정에서 확인한 사실을 기록만 남긴다.

### 요약

`assistant-mask-leak.md` 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md` `17_12_34` W1)가 "별도 결정" 으로 남겨 둔 값-패턴 vs 키-포맷 우선순위를 사용자 택일로 정당하게 해소하고, 실제 코드 소비처(`maskSensitiveFields` 2곳)도 빠짐없이 식별했다 — 결정 자체를 우회하거나 선행 조건을 무시하는 문제는 없다. 다만 그 "별도 결정" 문구를 담고 있는 target 문서 2곳(`spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 의 요구사항 `ED-AI-37` 정본 서술, `spec/5-system/14-external-interaction-api.md` §R17 카탈로그의 "잔여 ③" 캐비엇)이 결정 집행 즉시 factually stale 해지는데도 작업 목록에 그 갱신이 없고 frontmatter 는 `spec_impact: none` 을 선언하고 있다 — 이 저장소가 반복 지적해 온 "빈 약속 영구 누락"·"결정 시점에 SoT 동시 갱신" 패턴과 같은 종류의 누락이다.

### 위험도
MEDIUM
