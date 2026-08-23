# 테스트(Testing) 리뷰

## 검증 방법

`mask-sensitive-fields.util.spec.ts` / `explore-tools.service.spec.ts` / `sanitize-error-message.spec.ts` 를
실제로 `jest` 로 실행했고(112 passed), plan 문서(`assistant-mask-leak.md`)가 주장하는 뮤테이션 결과를
직접 재현해 검증했다(커밋 후 `cp` 백업 → 뮤테이션 → 테스트 → `cp` 복원, `git status` 로 클린 확인):

| 뮤턴트 | 예측(plan 문서) | 실측(재현) | 일치 |
| --- | --- | --- | --- |
| M1: `deepRedactSecrets` 중첩 제거 | 값 축 캐너리 RED | **3 RED** (`masks sensitive fields...`, `[캐너리] 값 축`, `[캐너리] 키 축`) | ✅ |
| 순서 반전(`maskSensitiveFields(deepRedactSecrets(v))`) | (plan 미기재, 자체 검증) | **2 RED** (`****` 로 되돌아감 — "키 먼저, 값 나중" 이 실제로 강제됨) | ✅ 추가 확인 |
| M2: `DEFAULT_SENSITIVE_KEYS` 에서 token 계열 8개 제거 | util 8 RED / explore-tools 27 GREEN | **util 8 RED / explore-tools 18 전부 GREEN** | ✅ |

plan 문서의 뮤테이션 주장은 과장이나 허위 없이 실측과 일치한다. 캐너리 테스트는 vacuous 하지 않다.

## 발견사항

- **[WARNING]** 자매 표면(`handler-output.adapter.ts`)의 key-axis 확장이 그 표면 자신의 테스트로 잠기지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts` — `describe` 블록 내 `it('masks credential-like keys in echoed config', ...)` / `it('masks non-string credential values as ****', ...)` (이 PR 의 diff 에 포함되지 않은 파일이라 게이트 번호 없음, 함수/테스트명으로 특정)
  - 상세: `plan/in-progress/assistant-mask-leak.md` 의 작업 체크리스트는 `DEFAULT_SENSITIVE_KEYS` 에 token 계열 8개를 추가한 것을 **"자매 표면 키 축"** 수정으로 명시적으로 체크(`- [x] DEFAULT_SENSITIVE_KEYS 에 token 계열 8개 추가 (자매 표면 키 축)`)했고, `mask-sensitive-fields.util.ts` 의 주석도 "EIA 쪽 두 목록은 같은 라운드에 계열째 닫혔고 이 목록만 남아 비대칭이었다"며 `handler-output.adapter.ts` 를 명시적 수혜자로 지목한다. 그런데 `handler-output.adapter.spec.ts` 에는 `csrf_token`/`auth_token`/`session_token`/`id_token` 계열을 검증하는 테스트가 전혀 없다(직접 확인). 현재는 `handler-output.adapter.ts` 가 `mask-sensitive-fields.util.ts` 의 동일 `DEFAULT_SENSITIVE_KEYS` Set 을 그대로 import 하므로(로컬 사본 없음, 직접 확인) 구조적으로는 안전하지만, 이 저장소가 반복해 겪은 *"방어를 한 칸 좁게 잡는다 — 자매 함수 미적용"* 패턴과 같은 모양이다. 예컨대 향후 누군가 `handler-output.adapter.ts` 를 별도 key set 으로 파라미터화하거나 마스킹 함수를 교체해도, 이 표면 자신의 테스트 스위트는 그 회귀를 못 잡는다 — 잡아내는 유일한 안전장치는 무관한 파일(`mask-sensitive-fields.util.spec.ts`)의 유틸 레벨 테스트뿐이다.
  - 제안: `handler-output.adapter.spec.ts` 의 `'masks credential-like keys in echoed config'` 근처에 token 계열(`csrf_token` 등 최소 1~2 개) 캐너리를 추가해, 이 PR 이 실제로 체크한 "자매 표면 키 축" 항목을 그 표면 자신의 테스트로 고정한다.

- **[INFO]** `redactAssistantFields` 가 비-export 라 전체 서비스 왕복 없이 단위 테스트할 수 없다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` — 함수 `redactAssistantFields` (모듈 최상단, `@Injectable() export class ExploreToolsService` 바로 위)
  - 상세: 이 함수는 `deepRedactSecrets(maskSensitiveFields(v))` 두 층을 합성하는 순수 함수이지만 module-private 이라, 그 합성 자체를 검증하려면 `makeService()` + repo mock + `getExecutionDetails()` 전체 왕복이 필요하다(UUID 검증·workspace 스코프·timeline 배치 로직까지 함께 세팅). 이번 PR 은 그 비용을 감수하고 캐너리 2건 + 기존 단언 갱신으로 충분히 커버했지만(위 뮤테이션 재현으로 확인), 다음에 마스킹 케이스를 더 늘릴 때마다 같은 설정 비용이 반복된다.
  - 제안: 필수는 아님 — 현재 커버리지는 충분하다. 마스킹 케이스가 더 늘어날 경우 `export`하여 별도 `describe('redactAssistantFields')` 블록으로 분리하는 것을 고려.

- **[INFO]** `MAX_REDACT_DEPTH`(=10) 깊이 상한 경계가 이 신규 소비처에서 별도 검증되지 않음
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` — `redactAssistantFields` 문서 주석이 `deepRedactSecrets` 의 "값 축" 겹침을 설명하는 블록
  - 상세: `deepRedactSecrets` 의 깊이 상한 주석은 "an unbounded walk over **low-trust LLM/tool output** can blow the stack" 이라고 명시하는데, `explore-tools.service.ts` 가 노출하는 `inputData`/`outputData`/`error` 는 정확히 그 특성(임의 깊이의 노드 실행 산출물)을 갖는다. 깊이 상한 자체는 `sanitize-error-message.spec.ts` 에서 이미 단위 테스트되어 있어 로직 결함 위험은 낮지만, 이 호출부에서 상한을 넘는 실행 기록이 왔을 때 서브트리가 통째로 `***` 로 뭉개지는 동작을 확인하는 캐너리는 없다.
  - 제안: 낮은 우선순위. 공유 유틸에서 이미 검증되므로 필수 아님.

- **[INFO]** `tokenCount` 대조군 캐너리는 현재 구현에 대해 항상 자명하게 통과한다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` — `it('leaves a non-credential key that merely contains "token" as a substring', ...)`
  - 상세: `maskSensitiveFields` 는 `sensitiveKeys.has(k.toLowerCase())` 로 `Set` 완전 일치만 보므로, 이 대조군은 현재 코드에 대해서는 원천적으로 실패할 수 없다(정규식으로 바뀌기 전까지는 회귀를 못 잡는 캐너리). 주석이 이 의도("넓히다 이 성질을 잃으면 여기가 RED 가 된다")를 정확히 밝히고 있어 오해의 소지는 없다 — 결함이 아니라 "미래 리팩터를 겨눈 문서적 캐너리"라는 점만 기록.

## 요약

새로 추가된 `token` 계열 키 8개(`mask-sensitive-fields.util.ts`)와 `explore-tools.service.ts` 의 값축+키축
이중 마스킹(`redactAssistantFields`)에 대해, 캐너리 테스트(값 축 1건·키 축 1건)와 유틸 레벨 `it.each` 9건이
새로 추가됐다. plan 문서가 주장하는 3가지 뮤테이션 결과(M1 값축 제거→3 RED, 순서 반전→2 RED, M2 목록에서
8개 제거→util 8 RED/explore-tools 27 GREEN)를 직접 재현해 전부 일치함을 확인했고, 뮤테이션 후 리포지토리를
`cp` 백업/복원으로 클린 상태로 되돌렸다(`git status` 로 확인). 기존 6개 단언이 `****<last4>` → `***` 로
의도된 정책 변경에 맞춰 정확히 갱신됐고, 자매 스펙 파일(`workflow-assistant-stream.service.spec.ts` 등)에
stale 잔존 단언이 없음도 grep 으로 확인했다. 유일하게 실질적인 갭은 이 PR 이 명시적으로 "자매 표면 키 축
수정"으로 체크한 `handler-output.adapter.ts` 가 그 자신의 테스트 스위트에서 token 계열 마스킹을 검증받지
못한다는 점이다(구조적으로는 같은 Set 을 공유해 현재 안전하지만, 그 표면 고유의 회귀 가드는 없음). 나머지는
INFO 수준의 테스트 용이성/문서적 캐너리 관찰이다.

## 위험도
LOW
