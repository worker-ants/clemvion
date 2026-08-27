# 요구사항(Requirement) 코드 리뷰

## 변경 개요

`handler-output.adapter.ts`(`adaptHandlerReturn`)가 노드 `config` echo 에 걸던 storage-time
마스킹(`maskSensitiveFields`)을 제거하고, 마스킹 책임을 egress 두 곳(REST
`redactStoredDataForResponse`, WS `maskWireEnvelope` — 둘 다 `deepRedactSecrets*`)에만
위임한다. 안전 전제는 "`DEFAULT_SENSITIVE_KEYS`(어댑터가 쓰던 키 이름 목록) ⊆
`CREDENTIAL_KEY_PATTERN`(egress 가 쓰는 키 정규식)"이고, 이를 `DEFAULT_SENSITIVE_KEYS` 를
직접 순회하는 신규 포함관계 캐너리(`mask-sensitive-fields.util.spec.ts`)로 못박는다. 이번
라운드(`12_52_43`)는 이미 4라운드(`10_53_52`→`11_25_15`→`12_00_05`→`12_28_26`)에 걸쳐
CRITICAL 1건·WARNING 다수가 지적·수정된 뒤의 5번째 검증 라운드다.

## 독립 검증 (Read 로 실제 소스 대조)

핵심 코드 4개 파일과 spec 6개 파일을 직접 열어 diff 와 대조했다:

- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` — `config: r.config ?? {}` (마스킹 호출 완전 제거) 확인. 주석의 "새로 걸 출구가 없다" 주장대로 두 egress 만 남아 있음을 코드로 확인.
- `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` — `DEFAULT_SENSITIVE_KEYS` export 확인. **정규식 대조를 직접 재현**: 목록의 22개 키(소문자화 후 `apikey`/`api_key`/`password`/`token`/`accesstoken`/`csrftoken`/`authtoken`/`sessiontoken`/`idtoken`/`secret`/`client_secret`/`authorization` 등)가 `sanitize-error-message.ts:113` 의 `CREDENTIAL_KEY_PATTERN = /^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key)$/i` 전부와 일치함을 수기로 확인 — 포함관계 주장이 실제로 성립한다.
- `mask-sensitive-fields.util.spec.ts` — `KEYS = [...DEFAULT_SENSITIVE_KEYS]` 로 상수에서 직접 파생, `it.each(KEYS)` 가 `deepRedactSecrets` 로 각 키를 검증. 초판의 "손으로 재나열" 결함(CRITICAL, `10_53_52`)이 재발하지 않는 형태임을 확인.
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `buildRetryState`(:3361 부근) 를 직접 읽어 `llmConfigId`/`workspaceId`/`executionId` 등이 반환 객체에 없음을 확인 — "credential 은 allow-list 로 애초에 배제, `maskSensitiveFields` boundary 와 무관"이라는 정정 주석이 실제 구현과 일치한다.
- `execution-context.service.ts`/`.spec.ts` — `setStructuredOutput` 이 `adapted` 를 참조로 저장(`toBe`)하고 `setEngineResolvedConfig` 는 shallow-copy(`not.toBe`)하는 비대칭이 각각 캐너리로 고정돼 있음을 확인. JSDoc 도 hop1(어댑터)/hop2(이 서비스) 를 분리해 정확히 서술.
- spec 6개(`14-execution-history.md` R-5, `4-ai-assistant.md`, `1-ai-agent.md`, `4-execution-engine.md`, `egress-masking.md`, `node-output.md`) — 전부 취소선 + 정정 블록으로 "storage-time 마스킹 제거, egress-only 정렬" 방향을 line-level 로 일치시켰다. `1-ai-agent.md` 의 "`llmConfigId` 는 config echo 필드 열거에 없다"는 주장도 `assembleSingleTurnConfigEcho`/`buildMultiTurnConfigEcho` grep 으로 재확인(0건).

TODO/FIXME/HACK/XXX 마커는 변경된 7개 코드 파일 전체에서 검색해 **0건**.

## 발견사항

- **[WARNING]** 이번 리뷰 라운드(`12_52_43`)의 forced-reviewer 커버리지 게이트가 통과하지 않은 상태에서 plan 이 이미 "5라운드 수렴, CRITICAL 0·WARNING 0" 으로 종결 커밋됐다
  - 위치: `review/code/2026/08/27/12_52_43/meta.json` (`agents_forced: ["documentation","maintainability","requirement","scope","security","side_effect","testing"]`) vs `review/code/2026/08/27/12_52_43/SUMMARY.md` ("forced whitelist(`documentation`, `testing`) 2명 전원 결과 확보됨 — 누락 없음") vs `plan/complete/masking-expression-egress-split.md` (커밋 `ad166120d`, "5라운드 `/ai-review` 가 CRITICAL 0·WARNING 0 으로 수렴")
  - 상세: `meta.json` 에 기록된 이번 라운드의 `agents_forced` 는 7명(documentation·maintainability·requirement·scope·security·side_effect·testing)인데, 그 SUMMARY(같은 라운드, 같은 커밋에 포함)는 "forced whitelist 2명"만 언급하며 나머지 5명(그중 하나가 지금 이 `requirement.md` 를 작성 중인 본 리뷰어다)의 산출물이 커밋 시점엔 디스크에 없었다(`git show --stat ad166120d` 확인 — 그 커밋이 추가한 `review/code/2026/08/27/12_52_43/` 하위 파일은 `SUMMARY.md`/`_retry_state.json`/`documentation.md`/`meta.json`/`testing.md` 5개뿐, `maintainability.md`/`requirement.md`/`scope.md`/`security.md`/`side_effect.md` 없음). 이 저장소의 `code_review_orchestrator.py`(`_verify_coverage`)는 정확히 이 상태를 막기 위해 존재한다 — 함수 docstring 이 "forced 화이트리스트는 router 도 override 못한다. Coverage 는 '주장' 이 아니라 디스크 산출물로 판단한다"고 명시하는데, 이번엔 그 게이트를 통과하지 않은 상태에서 plan 종결 커밋이 먼저 나갔다. (근본 코드 변경 자체의 결함은 아니다 — 본 리뷰어를 포함한 독립 검증으로 코드는 문제없음을 확인했다. 다만 "종결 판단의 근거가 되는 그 순간의 증거"가 스스로 주장하는 것과 달랐다는 점에서 이 저장소가 이미 여러 차례 겪은 "허위 완료 선언"·"forced whitelist 미이행" 클래스와 같은 종류다.)
  - 제안: (본 리뷰어를 포함해) 누락된 forced reviewer 5명의 산출물을 확보한 뒤 SUMMARY 를 갱신하고, 실제로 CRITICAL/WARNING 0 이 맞다면 그 근거로 plan 종결 커밋 메시지의 "forced 미이행 없음" 서술을 사실과 맞게 정정(또는 이번 라운드가 실제로는 완료됐다는 추가 증거를 제시)한다. 코드 자체를 되돌릴 필요는 없다.

- **[INFO]** 이번 변경이 만드는 두 트레이드오프(크로스-노드 자격증명 릴레이, safe-by-construction → safe-by-convention)는 신규 미문서화 결함이 아니라 R-5 정정 블록·`spec-sync-external-interaction-api-gaps.md` 트래커에 이미 등재·추적되고 있음을 확인했다 — 추가 조치 불요.
  - 위치: `spec/2-navigation/14-execution-history.md`(R-5 정정 블록), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`("자격증명을 노드 `config` 에 평문으로 담는 노드 타입 — 참조 간접화 검토")
  - 상세: 근본 처방(자격증명을 `llmConfigId` 처럼 참조로 담기)까지 명시돼 있어 재발 방지 방향이 정해져 있다.
  - 제안: 없음.

## 요약

핵심 코드 변경(`handler-output.adapter.ts` 의 마스킹 제거, `DEFAULT_SENSITIVE_KEYS` export + 포함관계 캐너리, `ai-turn-executor.ts`/`execution-context.service.ts` 의 정정·캐너리 보강)은 실제 소스를 직접 대조한 결과 의도한 기능(표현식이 config 원문을 읽도록 복원하되 REST/WS egress 는 그대로 마스킹)을 정확히 구현하고 있으며, 안전 전제(키 집합 포함관계)도 정규식을 직접 대조해 성립함을 확인했다. spec 6개 문서도 line-level 로 코드와 일치한다. TODO/FIXME 없음, 에러 경로·반환값·엣지 케이스(빈 문자열, 비-문자열 값, 순환 참조)도 캐너리로 커버돼 있다. 유일하게 남는 사항은 코드 결함이 아니라 **이번 리뷰 라운드 자체의 forced-reviewer 커버리지 게이트 미이행 상태에서 plan 종결 커밋이 먼저 발생**했다는 프로세스 정합성 문제다.

## 위험도

LOW
