# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 기능/보안 회귀나 CRITICAL 은 없다(핵심 마스킹 로직·egress 커버리지는 3라운드 누적 검증으로 견고함을 재확인). 다만 이 PR 내에서 **"미러 스윕이 몇 곳을 놓친다"는 동일 클래스의 결함이 세 번째로 재발**했고, 그중 하나는 `RESOLUTION.md`(직전 라운드 산출물)가 실제로는 고쳐지지 않은 것을 "처리했다"고 명시적으로 잘못 기록한 사례라 문서 신뢰성 측면에서 낮게만 볼 수 없다. 또한 이번 라운드에 신설된 안전 캐너리 1건이 뮤테이션으로 vacuous(자신이 주장하는 동작을 실제로 검증하지 못함)임이 실증됐다. 두 항목 모두 실질 유출 위험은 없다(빈 문자열 사각·주석 오탈자).

## 재확인 필요 사실 — 강제(forced) reviewer 이행 상태

`routing_status=skipped`(라우터 미사용) 이며 `documentation, maintainability, requirement, scope, security, side_effect, testing` 7명 전원이 **강제 포함(router_safety)** 대상이었다. 7명 전원의 보고서가 인라인 전문으로 확보되었고, 그중 `maintainability.md` 는 디스크에 파일이 없어(이전 실행에서 Write 가 누락된 것으로 보임) 이번 라운드에서 인라인 전문을 그대로 파일로 영속화했다 — **내용 손실은 없다.** 강제 화이트리스트 미이행(보고서 부재) 사례는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화(문법/신뢰성) | `mask-sensitive-fields.util.ts` 인라인 주석의 취소선 정정이 남긴 문법 파괴 문장(주어 없는 "내보낸다 — 비-자격증명 config 필드가…")이 **두 차례("고쳤다") 주장 이후에도** 그대로 남아 있다. 직전 라운드(`11_25_15`)의 `RESOLUTION.md` 는 이 문장을 "유일한 잔존 소비처를 주어로 재연결해 처리했다"고 명시했으나, `git show 23e1c91a0` 로 실제 diff 를 대조하면 새 문장 하나만 앞에 끼워 넣었을 뿐 뒤에 붕 뜬 절은 그대로다 — **실제로는 고쳐지지 않은 것을 고쳤다고 기록**했다. | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:30-36` | 원 문장 전체를 취소선 처리하거나, 남은 절을 유일한 잔존 소비처(`explore-tools.service.ts`)를 명시적 주어로 재작성. 향후 `RESOLUTION.md` 작성 시 `git show`/`git diff` 로 실제 반영 여부를 재확인하는 절차 권장. |
| 2 | 테스트 정확성 | 신규 "빈 문자열 대조군" 캐너리(`expect(typeof out.apiKey).toBe('string')`)가 자신이 JSDoc 에서 선언한 주장("egress 까지 원문 그대로 통과")을 실제로는 구분하지 못하는 **타입-only vacuous 단언**. `deepRedactObject` 의 빈 문자열 스킵 가드(`v !== ''`)를 제거하는 뮤테이션을 적용해도(빈 문자열이 마스킹되도록 회귀시켜도) 스위트 전체(42/42)가 조용히 GREEN 이었음을 직접 실행으로 실증. 보안 영향은 없음(빈 값엔 유출할 내용이 없음). | `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:160-163` | `expect(out.apiKey).toBe('')` (또는 마스킹 마커 배제 단언)로 교체해 "원문 그대로"를 실제로 검증하게 한다. |
| 3 | SPEC 문서 정합 | `spec/4-nodes/3-ai/1-ai-agent.md:480` — 직전 라운드(`11_25_15`)가 `:755`·`:979` 에서 고친 것과 **같은 자기모순**(미동봉인 `llmConfigId` 에 "마스킹" 을 귀속시킴)이 형제 문단에 그대로 남아 있다. 실측: AI Agent 의 config echo 조립 지점 3곳(`ai-turn-executor.ts`) 어디에도 `llmConfigId` 가 실리지 않아, 이 값은 마스킹 대상이 될 기회 자체가 없다(egress 마스킹과 무관). 직전 스윕이 "미동봉"이라는 단어를 grep 하는 방식이라 이 문장(그 단어를 안 씀)을 놓쳤다. | `spec/4-nodes/3-ai/1-ai-agent.md:480` | "credential(`llmConfigId`)은 config echo 조립 시점에 애초에 포함되지 않는다(allow-list 조립, egress 마스킹과 무관)"로 재정정. |
| 4 | SPEC 문서 정합 | `spec/5-system/4-execution-engine.md:1510` — 같은 spec_impact 파일 안에서 바로 위 `:193`/`:203` 두 자리는 이번 PR 이 정정했는데, `:1510`(더 오래된 문장, 이 PR 이 손대지 않음)은 여전히 `maskSensitiveFields` 를 현재형으로 credential 제외의 근거로 인용한다 — boundary 제거 후에는 이 인용이 사실과 무관해졌다. | `spec/5-system/4-execution-engine.md:1510` | `:193`/`:203` 과 동일 톤(취소선 + "allow-list 로 조립 시점에 배제, `maskSensitiveFields` 와 무관")으로 정정. |
| 5 | 보안(구조적 트레이드오프, 기지사안) | config echo 마스킹 제거로 안전성이 "safe-by-construction" 에서 "safe-by-convention" 으로 이동 — 워크플로 편집 권한자가 표현식(`$node["X"].config.<field>`)으로 한 노드의 자격증명을 다른 노드 body 에 실어 제3자 엔드포인트로 보내는 경로는 egress 마스킹을 아예 지나지 않아 원리적으로 막을 수 없다. 이미 spec R-5 정정 블록·plan 백로그에 명시 등재된 기지 트레이드오프로, 이 PR 을 막을 신규 미문서화 결함은 아니다. | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53` | 기존 백로그(자격증명 참조 간접화, `llmConfigId` 패턴 확산)의 우선순위 유지. |
| 6 | 스코프 혼입 | 마스킹 mirror-sweep(W1~W4)을 닫는 커밋 `23e1c91a0` 에, 커밋 스스로 "곁다리 실측"이라 표시한 **무관한 별건**("doc-link 검사기가 `CLAUDE.md`/`.claude/**` 를 안 훑는다"는 D 항목 전제 정정)이 함께 섞여 들어갔다. 내용 자체는 정확해 보이나 이 PR("config echo 마스킹 이관")의 스코프 밖이다. | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:771-793` | 향후에는 곁가지 실측이라도 별도 커밋으로 분리. 이미 머지된 이력은 소급 분리 불요. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 재확인 | 직전 CRITICAL(포함관계 캐너리 미파생)·WARNING 3건(spec 미러 스윕 논리오류)이 이번 diff 최종 상태에서 실제로 해소됨을 독립 재확인(security, requirement 공통) | `mask-sensitive-fields.util.ts:10`, `node-output.md:256`, `4-execution-engine.md:193`, `1-ai-agent.md:755,979` | 없음(양호) |
| 2 | 보안(기지사안) | WS 전용 로컬 `CREDENTIAL_KEY_PATTERN` 사본이 공유본보다 좁음(`x-api-key` 미포함). config echo 경로는 영향 없음, 이미 별건 트래커에 등재 | `websocket.service.ts:78-79` vs `sanitize-error-message.ts:112-113` | 이 PR 범위 아님. 통합 시 넓은 쪽(REST)으로 합칠 것 |
| 3 | 보안 | 빈 문자열 자격증명 값은 두 마스커 모두 통과시킴 — 값 자체가 비어 있어 실질 유출 없음, 의도적으로 문서화된 사각 | `mask-sensitive-fields.util.spec.ts`(대조군 블록) | 없음 |
| 4 | 보안 | 하드코딩된 시크릿 없음(테스트 픽스처는 전부 합성 placeholder), review 산출물 19개+ 는 읽기전용 기록물로 신규 이슈 없음 | 테스트 파일 전반, `review/**` | 없음 |
| 5 | 스코프 | WARNING #6 을 제외한 나머지 43개 파일은 전부 "config echo 마스킹을 어댑터→egress 로 이관"이라는 단일 목적에 귀속(핵심 코드 5개, spec 6개, plan/CHANGELOG, review 산출물) | 해당 없음 | 없음(양호) |
| 6 | 부작용(구조) | `config` 가 더 이상 deep-clone 되지 않고(마스킹의 부산물이던 clone 소실) 핸들러 원본 참조가 장기 생존 `structuredOutputCache` 에 방어적 복사 없이 저장됨. PR 자신이 캐너리로 이 aliasing 을 고정했으나, 자매 API `setEngineResolvedConfig` 는 정확히 같은 이유로 shallow-copy 하는 것과 비대칭 | `handler-output.adapter.ts:53`, `execution-context.service.ts:151,166` | `setStructuredOutput` JSDoc 에 참조 공유 사실을 `setEngineResolvedConfig` 와 대칭으로 명시 고려 |
| 7 | 부작용(구조) | `DEFAULT_SENSITIVE_KEYS` 를 모듈-private → export 전환 — 프로세스 전역 mutable `Set` 접근 범위 확대(이번 diff 자체의 소비처는 읽기 전용이라 안전) | `mask-sensitive-fields.util.ts:10` | 실질 강제 필요 시 얼린 배열 export + 소비처 `new Set()` 패턴 고려. 현재는 낮은 리스크 |
| 8 | 부작용 | `adaptHandlerReturn`/`maskSensitiveFields` 시그니처·공개 인터페이스 변경 없음(4개 호출부 대조 확인), `ai-turn-executor.ts` 는 주석만 변경 | `handler-output.adapter.ts:26`, `mask-sensitive-fields.util.ts:76` | 없음 |
| 9 | 유지보수성 | 동일 보안 불변식 설명이 3개 파일(어댑터 인라인주석·2개 spec JSDoc)에 근접-중복 서술됨, 한 줄 코드에 23줄 인라인 주석 | `handler-output.adapter.ts:30-53`, 관련 spec 2곳 | canonical 설명 1곳 + 나머지는 포인터로 축약(강제 아님) |
| 10 | 테스트 | 안전 주장 캐너리 전량이 실제 egress 진입점이 아니라 공유 저수준 함수(`deepRedactSecrets`)를 직접 호출 — 기존부터 있던 갭, 신규 아님. 회귀 스위트 stale 마스킹 기대값 없음을 grep+실행(2 suites/84 tests GREEN)으로 확인 | `handler-output.adapter.spec.ts:179-215` | 실제 진입점(`redactStoredDataForResponse`/`maskWireEnvelope`) 대상 통합 테스트 존재 여부 별건 확인 |
| 11 | 문서화 | `plan/in-progress/masking-expression-egress-split.md:127` 의 "실측" 테스트 카운트가 이후 커밋(`23e1c91a0`, "9,020 passed")과 다시 2건 어긋남 — PR 이 이어지는 한 반복되는 stale 패턴 | 위 경로 | 머지 시점 최종 실행 결과로 갱신, 또는 "최근 커밋 메시지 참조"식 표현으로 대체 |
| 12 | plan 위생 | `masking-expression-egress-split.md`, `spec-sync-external-interaction-api-gaps.md` 체크리스트가 실제 상태와 일치(`/ai-review` 만 미체크) — 이전 라운드 지적 완전 해소 | 위 경로 | 없음(양호) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이전 CRITICAL/WARNING 해소 재확인, 남은 것은 기지 트레이드오프(safe-by-convention)와 WS 정규식 비대칭뿐 |
| requirement | LOW | 이전 4건 해소 확인 + 빈 문자열 캐너리 vacuous(WARNING) + 문법 파괴 문장 반복 미수정(INFO) |
| scope | LOW | 43/44 파일이 단일 목적에 귀속, doc-link 검사기 전제 정정 곁다리 혼입만 지적 |
| side_effect | LOW | 시그니처·공개 인터페이스 불변, config aliasing/전역 export 노출 확대는 구조적 기록(INFO)만 |
| maintainability | LOW | 핵심 로직은 오히려 단순화됨, 문법 파괴 문장 미수정(WARNING)·근접중복 서술(INFO) |
| testing | LOW | 핵심 안전 전제 GREEN 재확인, 신규 캐너리 1건이 뮤테이션으로 vacuous 실증(WARNING) |
| documentation | MEDIUM | mirror sweep 잔여 2곳 신규 발견(`1-ai-agent.md:480`, `4-execution-engine.md:1510`) + `RESOLUTION.md` 의 허위 완료 선언 반증 |

## 발견 없는 에이전트

없음(전원 최소 INFO 이상 보고).

## 권장 조치사항

1. `RESOLUTION.md` 가 "처리했다"고 선언했으나 실제로는 미수정인 `mask-sensitive-fields.util.ts:30-36` 의 문법 파괴 문장을 지금 실제로 고친다(취소선 처리 또는 재작성) — 허위 완료 기록의 재발 방지를 위해 `git show`로 최종 검증.
2. 신규 "빈 문자열 대조군" 캐너리(`mask-sensitive-fields.util.spec.ts:160-163`)의 단언을 `expect(out.apiKey).toBe('')` 로 교체해 vacuous 상태를 해소한다.
3. `spec/4-nodes/3-ai/1-ai-agent.md:480` 과 `spec/5-system/4-execution-engine.md:1510` 을 나머지 6곳과 동일 톤으로 정정해 mirror sweep 을 완전히 닫는다.
4. (낮은 우선순위) doc-link 검사기 전제 정정을 향후에는 별도 커밋으로 분리, plan 의 stale 테스트 카운트를 머지 시점 값으로 갱신.

이 중 1~3은 문서/테스트 신뢰성 이슈이며 기능·보안 회귀는 아니므로 PR 자체를 차단할 사유는 아니나, 병합 전 반영을 권장한다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용(사유 미제공, prompt 에 명시 없음) — 전체 7개 reviewer(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 강제(router_safety) 실행.
  - **실행**: 전체 7명 (documentation, maintainability, requirement, scope, security, side_effect, testing)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원, 결과 전부 확보됨)