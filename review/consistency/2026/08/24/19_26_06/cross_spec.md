# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 발견사항

- **[CRITICAL] `NodeExecution.outputData`(config 포함) 마스킹 "시점"에 대해 두 영역이 정면으로 모순한다**
  - target 위치: `spec/5-system/` 자체는 이 사실에 대해 침묵한다(아래 참조) — 다만 target 이 마스킹 정책의 SoT 로 위임하는 [`spec/conventions/node-output.md` Principle 7](../../../../../spec/conventions/node-output.md)·[`spec/5-system/14-external-interaction-api.md` §R17](../../../../../spec/5-system/14-external-interaction-api.md) 이 "egress-only(DB 는 raw)" 를 반복 규정하고 있어, 아래 두 소비 문서가 그 위에서 서로 다른 결론을 낸 것으로 보인다.
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` R-5(§465-469) **vs** `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1(라인 259)
  - 상세: 두 문서는 **같은 DB 필드**(`NodeExecution.outputData` — `node-output.md` Principle 0 이 명문화하듯 `{config, output, meta, port, status}` 를 통째로 싣는 컬럼이라 `config` 도 그 일부)에 대해 정반대로 서술한다.
    - `14-execution-history.md` R-5: *"config echo 는 엔진 boundary(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 DB·WS·REST 모든 경로에 **보편 마스킹**되어 내려오므로(**민감 필드는 저장 시점에 이미 마스킹**), 노출 자체가 새로운 시크릿 유출 경로를 만들지 않는다."* — 즉 **DB 는 이미 마스킹된 값을 보유**한다는 전제. R-5 는 이 카브아웃을 신중히 좁혀 두기까지 했다 — 같은 절의 상단 경고 박스가 *"본 항목이 다루는 것은 Config 탭의 config echo 하나다. `Execution.error` 는 별개 정책으로 write 시점이 아니라 응답 egress 에서 마스킹된다... 두 정책을 하나로 읽으면 'error 도 write 시점에 마스킹된다' 는 잘못된 결론이 나온다"* 라고 명시해, config 만 예외적으로 write-time 마스킹임을 의도적으로 못박아 두었다.
    - `4-ai-assistant.md` §4.1.1: *"`inputData` · `outputData` · `error` 필드는 서버가 두 층을 겹쳐 반환한다 — 키 이름 기반 `maskSensitiveFields` 위에 값 패턴 기반 `deepRedactSecrets`... **원본은 DB 에 그대로 남고 read 시점에만 변환한다.**"* — `outputData`(=config 포함)를 `error`/`output` 과 **동일하게** "DB 원본 보존 + read-time 변환" 으로 일반화한다. 즉 `maskSensitiveFields` 조차 이 도구의 read 경계에서 **처음** 걸리는 것처럼 읽힌다.
    - 실제 코드(`codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36`, 이번 plan `masking-expression-egress-split.md` 자신이 인용한 좌표)는 `adaptHandlerReturn`(핸들러 반환 직후 = **영속 이전**)에서 `maskSensitiveFields(r.config)` 를 적용한다 — `14-execution-history.md` R-5 쪽이 코드와 일치하고, `4-ai-assistant.md` 의 "원본은 DB 에 그대로 남고" 는 `output`/`meta`/`error` 에는 맞지만 **`config` 서브필드에는 부정확**하다.
  - 제안: 이번 masking-residuals 작업(어댑터의 `maskSensitiveFields(config)` 제거, egress 로 일원화)이 이 모순을 실제로 해소할 기회다 — 어댑터 마스킹을 걷어내면 "저장 시점 마스킹"이 사라지고 `config` 도 진짜 egress-only 가 되어 `4-ai-assistant.md` 쪽 서술과 합치한다. 다만 그 경우 **`spec/2-navigation/14-execution-history.md` R-5 를 반드시 같은 PR 에서 갱신**해야 한다 — "저장 시점에 이미 마스킹" → "REST egress(`redactStoredDataForResponse`/`deepRedactSecrets`)에서 마스킹, DB 는 raw" 로. 현재 `plan/in-progress/masking-expression-egress-split.md` 의 `spec_impact` 는 `spec/conventions/egress-masking.md` **한 곳뿐**이라 R-5 갱신이 누락될 위험이 크다 — **`spec/2-navigation/14-execution-history.md` 를 spec_impact 에 추가**할 것을 권한다. R-5 는 "안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존한다" 는 보안 근거 문서이므로, 근거 자체(write-time → egress-time)가 바뀌는데 문서가 안 바뀌면 향후 감사·리뷰가 틀린 메커니즘을 SoT 로 참조하게 된다.

- **[WARNING] `spec/conventions/egress-masking.md` 의 마스커 좌표계(§1)가 이번 변경의 당사자인 `handler-output.adapter.ts`/`maskSensitiveFields` 를 누락하고 있다**
  - target 위치: target(`spec/5-system/`) 다수 문서가 마스킹 상세를 위임하는 `spec/conventions/egress-masking.md`
  - 충돌 대상: 같은 문서 내부 — frontmatter `code:` (`codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` 등재) vs 본문 §1 좌표계 표(5개 행 — `MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH`/frontend 상한/`MAX_SANITIZE_DEPTH`/`stripExternalOnlyFields`)
  - 상세: 문서 스스로 *"나가는 페이로드에서 자격증명을 가리는 egress 마스킹은... 여러 마스커·스캐너의 협업이다. 본 컨벤션은 그 좌표계를 소유한다"* 라 선언하지만, `handler-output.adapter.ts` 의 `maskSensitiveFields(config)` — 정확히 위 CRITICAL 항목의 근원인 마스커 — 는 §1 표에 행이 없다(frontmatter 에만 파일 경로가 있을 뿐). 좌표계가 이 마스커의 존재·적용 시점(핸들러 반환 boundary = pre-storage)을 기술하지 않다 보니, `14-execution-history.md` 와 `4-ai-assistant.md` 가 서로 다른 가정으로 서술을 채운 것으로 보인다 — 좌표계 문서 자체가 이번 CRITICAL 충돌의 근본 원인 중 하나다.
  - 제안: 이번 작업의 `spec_impact`(이미 `egress-masking.md` 를 포함하고 있음)에서, 어댑터의 `maskSensitiveFields(config)` 를 제거한 뒤에는 §1 표에 "폐기됨(2026-08-24, config 는 egress-only 로 통합)" 을 명시하거나, 존치되는 다른 `maskSensitiveFields` 소비처(workflow-assistant explore tools 등)를 위해 표에 정식 행으로 편입.

- **[INFO] target(`spec/5-system/`) 자신은 `config` 의 storage-time 마스킹 여부에 대해 완전히 침묵한다**
  - target 위치: `spec/5-system/4-execution-engine.md` "Engine Raw Config Exposure" 결정 및 `NodeExecution.outputData` 영속을 다루는 전 구간
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` R-5 · `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1
  - 상세: `4-execution-engine.md` 는 *"핸들러는 `NodeHandlerOutput.config` 에 raw echo... `output.config` echo 는 'Engine Raw Config Exposure' 결정대로 항상 raw(`rawConfig` frozen snapshot)를 유지"* 라고만 말할 뿐, 그 raw 값이 영속 전에 key-name 마스킹을 거치는지는 언급이 없다. `NodeExecution.outputData` 영속의 SoT 인 이 문서가 이 사실을 갖고 있지 않아, 다른 두 영역(위 CRITICAL 항목)이 각자 다른 가정을 채워 넣게 된 정황으로 읽힌다.
  - 제안: masking-residuals 작업 완료 후 "config 는 (제거된 어댑터 마스킹 대신) egress 에서만 마스킹되고, 엔진→핸들러→저장 경로 전체에서 raw 를 유지한다" 는 한 문장을 `4-execution-engine.md`(또는 `node-output.md` Principle 7 인접부)에 명문화해 이 침묵을 해소.

## 요약

target(`spec/5-system/`) 은 그 자체 6개 서술 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)에서 다른 영역과 뚜렷한 정면 모순은 드러나지 않았다 — 다만 이번에 착수하려는 코드 변경(`handler-output.adapter.ts` 의 `maskSensitiveFields(config)` 제거, egress-only 로 일원화)이 직접 건드리는 좁은 영역 하나에서, 이미 `spec/2-navigation/14-execution-history.md`(R-5, config 는 write-time 마스킹)와 `spec/3-workflow-editor/4-ai-assistant.md`(§4.1.1, outputData 는 DB 원본 보존 + read-time 마스킹)가 **같은 `NodeExecution.outputData` 필드에 대해 상반된 서술**을 이미 갖고 있다. 실제 코드는 전자(write-time)와 일치하므로 후자가 현재는 부정확하지만, 계획대로 어댑터 마스킹을 제거하면 반대로 전자(R-5)가 stale 해진다 — 이번 PR 의 `spec_impact` 에 `spec/conventions/egress-masking.md` 뿐 아니라 `spec/2-navigation/14-execution-history.md` 를 반드시 추가해 R-5 의 보안 근거 문장을 새 메커니즘(egress-time)에 맞춰 갱신해야 한다. 이 조치 없이는 보안 근거를 서술하는 spec 문서가 틀린 메커니즘을 정본으로 남기게 된다.

## 위험도

HIGH — 기능적으로 워크플로가 깨지지는 않으나(egress 마스킹이 실제 보호를 이어받음), viewer 롤 노출의 보안 근거를 서술하는 spec 문서(`14-execution-history.md` R-5)가 이번 변경 이후 사실과 어긋나게 방치될 위험이 크고, 그 갱신이 현재 plan 의 `spec_impact` 범위 밖에 있다.
