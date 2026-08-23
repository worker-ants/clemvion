# Cross-Spec 일관성 검토 — spec/5-system/ (--impl-prep)

## 컨텍스트

이번 세션의 실제 작업물은 `plan/in-progress/assistant-mask-leak.md` (developer, `spec_impact:
none`) — `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` 와
`codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` 의 마스킹 강화다. bundle 예산
초과로 target 본문은 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세
파일만 전문 제공되고 나머지(§5-system 잔여 14개 + 관련 spec 전체)는 절단됐다. 절단된 영역은
저장소 파일을 직접 읽어 별도로 대조했다.

## 발견사항

### [CRITICAL] workflow-assistant 마스킹 포맷 변경이 ED-AI-37(§4.1.1)·EIA "잔여 ③" 서술과 직접 모순

- **target 위치**: 이번 세션의 코드 변경 대상 —
  `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
  (`redactAssistantFields` 신설, `deepRedactSecrets(maskSensitiveFields(v))` 이중 적용) +
  `plan/in-progress/assistant-mask-leak.md` (frontmatter `spec_impact: none`). git diff 확인
  결과 `spec/5-system/**` 자체는 origin/main 대비 무변경이므로, "target 문서"가 아니라 target
  **작업이 전제하는 spec 상태**가 충돌 지점이다.

- **충돌 대상**:
  1. `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "마스킹 규칙" (L259) — PRD 요구사항 ID
     `ED-AI-37` (§14 매핑표 L789: `| ED-AI-37 (민감 필드 마스킹) | §4.1.1 "마스킹 규칙" |`)
     이 명시적으로 이 절을 SoT 로 지정한다. 동일 문서 §"실행 조회 도구 기획 결정 메모" 표
     (L1429, L1465)도 같은 내용을 반복한다.
  2. `spec/5-system/14-external-interaction-api.md` "잔여 ③ (범위 밖 유지)" 절 (L1652-1658) —
     정확히 이 조합(`explore-tools.service.ts` + 값-패턴 마스킹 합성)을 다루며 **"여기에
     값-패턴 마스킹을 단순 합성하면 안 된다"** 고 명문화하고, "어느 의미가 우선하는지는 별도
     결정" 이라고 미결 상태로 남겨 뒀다.
  3. (근거 보강) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L237-253 —
     `17_12_34 requirement W1` 로 이미 등재된 정본 트래커 항목이 "두 마스킹 의미 중 이 표면에서
     무엇이 우선인지가 **결정 항목**" 이라고 동일하게 명시한다.

- **상세**: `spec/3-workflow-editor/4-ai-assistant.md §4.1.1` 은 다음을 wire 계약으로 명문화한다
  (L259): *"매칭 키(대소문자 무시): `apiKey`, `api_key`, `password`, `token`, `accessToken`,
  `refreshToken`, `secret`, `clientSecret`, `authorization`. 매칭된 값이 문자열이면
  `"****<last4>"` 로, 그 외 타입이면 `"****"` 로 치환."* 이 절은 PRD 요구사항 `ED-AI-37` 의
  유일한 SoT 다.

  이번 작업(이미 이 worktree 에 부분 반영됨 — `git diff origin/main` 확인)은
  `deepRedactSecrets(maskSensitiveFields(v))` 를 겹쳐, 매칭 값의 표기를 `"****<last4>"` 에서
  `"***"` 로 바꾼다 (`explore-tools.service.spec.ts` L514-528 이 이미 이 변경을 단언하도록
  갱신됨: `expect((exec.inputData as Row).apiKey).toBe('***')`). 즉 **§4.1.1 문구는 구현 완료
  즉시 사실과 어긋나며, `ED-AI-37` 이 가리키는 SoT 가 stale 해진다.**

  더 결정적으로, `spec/5-system/14-external-interaction-api.md` 는 바로 이 조합을 사전에
  검토하고 **"단순 합성 금지"** 로 명문화해 뒀다 (인용: *"여기에 값-패턴 마스킹을 단순
  합성하면 안 된다 — 그 함수는 자격증명 키를 `****9876` 처럼 접미 힌트를 남겨 어떤 키가
  가려졌는지 식별하게 하는데, 값-패턴 마스킹을 겹치면 그 힌트가 사라진다(기존 테스트가 이
  회귀를 잡는다). 어느 의미가 우선하는지는 별도 결정이라 분리했다."*). 이 문장이 예측한
  "기존 테스트가 이 회귀를 잡는다" 는 그대로 실현됐고(플랜 자체가 "기존 단언 6개가 바뀐다"
  라고 기록), 플랜은 그 미결 "별도 결정" 을 2026-08-23 자로 실제로 내렸다("유출 차단이
  우선"). **결정 자체는 트래커가 요구한 바로 그 절차를 따른 것으로 보이지만, 그 결정을
  spec 본문(§4.1.1 + EIA 잔여 ③ 절)에 되반영하는 단계가 빠져 있다** — plan frontmatter 가
  `spec_impact: none` 을 선언해 이 두 파일이 갱신 대상에서 아예 빠졌다.

  결과적으로 구현이 착륙하면: (a) `ED-AI-37` 이 가리키는 문서가 실제 wire 포맷과 다른
  내용을 계속 주장하고, (b) EIA 문서의 "잔여 ③" 절은 이미 해소된 gap 을 여전히 "범위 밖
  유지" 로 서술하며 "단순 합성 금지" 경고가 더 이상 유효하지 않은 채로 남는다 — 두 문서
  모두 실제 구현과 직접 모순된 채 고정(spec 이 코드보다 신뢰할 수 없는 상태)된다.

- **제안**: 이번 PR 의 `plan/in-progress/assistant-mask-leak.md` frontmatter
  `spec_impact: none` 을 `spec_impact: [spec/3-workflow-editor/4-ai-assistant.md,
  spec/5-system/14-external-interaction-api.md]` 로 정정하고, 구현 착수 전(또는 병행)
  project-planner 턴으로 다음을 반영한다:
  - `4-ai-assistant.md §4.1.1` "마스킹 규칙" 문구를 `***`(식별 힌트 없음) 로 정정하고
    `ED-AI-37` 서술을 동기화. 같은 문서의 "기획 결정 메모" 표(L1429)도 동반 갱신.
  - `14-external-interaction-api.md` 의 "잔여 ③ (범위 밖 유지)" 절을 "해소됨(2026-08-23,
    유출 차단 우선 결정)" 으로 갱신하고 "단순 합성 금지" 경고를 결정 이력으로 남긴다.
  - `spec-sync-external-interaction-api-gaps.md` 의 `17_12_34 requirement W1` 체크박스를
    해소로 표시(체크박스=실제 상태 규약).
  CLAUDE.md 규약상 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이
  적용되는 사례로 판단된다.

### [WARNING] `egress-masking.md` §1 좌표계 표에 신규 소비처(`ExploreToolsService`) 미등재

- **target 위치**: `explore-tools.service.ts` 의 `redactAssistantFields` — `deepRedactSecrets`
  를 새로 호출하는 소비처.
- **충돌 대상**: `spec/conventions/egress-masking.md` §1 좌표계 표 2행 — "소비처(심볼)" 열이
  `deepRedactSecrets`(REST 응답·저장 에러·conversation thread) · `hasMaskedLeaf`(Manual 실행
  재제출 거부 판정) 만 나열한다.
- **상세**: 이 문서는 스스로를 "`MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH` 등 마스킹 좌표계의 SoT" 로
  선언하고, §3 에서 "표는 기계가 지키지 않는다 — 사람이 갱신해야 한다" 고 명시한다. 직전
  커밋(`2022fdbc8`, masking-gate-consolidation)에서 실제로 "표가 낡는지" 를 검증하는 절차를
  거쳤고 그때는 무변경으로 판정됐다. 이번 변경은 `deepRedactSecrets` 의 **새 호출부**
  (`explore-tools.service.ts`)를 추가하므로, 같은 절차(§3 의 "마스커가 늘거나·상한/연산자가
  바뀌면 표가 낡는다" 기준의 "소비처 확장" 케이스에 해당)가 요구하는 표 갱신 대상이다. Critical
  은 아니지만, 이 문서가 최근에 반복적으로 stale 판정을 자체 검증해 온 이력을 볼 때 방치 시
  다음 사람이 "왜 두 값-패턴 소비처(§execution 저장 경로 vs assistant 도구)가 다른 깊이 상한
  정책을 쓰는지" 를 또 재발견하게 된다.
- **제안**: `egress-masking.md` §1 표 2행 소비처 열에 `ExploreToolsService.redactAssistantFields`
  (또는 상위 개념으로 "workflow-assistant 도구 응답")를 추가.

## 요약

nominal target(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`) 자체는
origin/main 대비 무변경이며 내부적으로도 다른 spec 영역과 뚜렷한 신규 모순은 발견되지 않았다
(RBAC·에러 코드 카탈로그·AuthConfig 마스킹 정책 등은 `spec/1-data-model.md`·
`spec/data-flow/12-workspace.md` 등과 상호 정합 확인됨). 그러나 이번 impl-prep 이 실제로
게이트해야 할 작업물 — workflow-assistant 마스킹 강화(코드는 이미 worktree 에 부분 반영됨) —
는 `spec/3-workflow-editor/4-ai-assistant.md §4.1.1`(요구사항 ID `ED-AI-37`)이 명문화한 wire
포맷과, `spec/5-system/14-external-interaction-api.md` 가 이 정확한 조합에 대해 사전에 남긴
"단순 합성 금지 + 별도 결정 필요" 경고 모두와 직접 충돌한다. 플랜의 `spec_impact: none` 선언은
이 두 파일을 놓친 것으로 판단되며, 구현을 그대로 완결하면 두 spec 문서가 실제 코드와 반대되는
내용을 계속 주장하게 된다.

## 위험도

CRITICAL
