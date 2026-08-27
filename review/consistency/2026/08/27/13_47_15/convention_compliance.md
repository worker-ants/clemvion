# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 대상 파일 19개 **전부**와 diff 자체가
생략되어 있었다. 이에 따라 지시대로 대상 파일과 diff 를 워크트리에서 직접 열어 확인했다:

- `git diff origin/main...HEAD --stat` 로 실제 변경 파일 확정 — `spec/5-system/` 안에서는
  `4-execution-engine.md` · `6-websocket-protocol.md` · `14-external-interaction-api.md`
  **3개만** 변경됐다 (나머지 16개는 이번 PR 에서 무변경).
- 세 파일의 `git diff` 전문, 관련 `spec/conventions/egress-masking.md` ·
  `spec/conventions/node-output.md` 전문(번들에 포함), `spec/2-navigation/14-execution-history.md`
  diff, 관련 코드 diff(`handler-output.adapter.ts` · `mask-sensitive-fields.util.ts` ·
  `execution-context.service.ts` · `ai-turn-executor.ts`), `plan/complete/masking-expression-egress-split.md`
  를 대조했다.

## 변경 개요

이번 PR 은 "config echo 마스킹을 어댑터(storage 경계)에서 egress(REST/WS)로 이동" 하는 변경이다.
`handler-output.adapter.ts` 의 `maskSensitiveFields(config)` 호출을 제거해 `NodeExecution.outputData`
와 표현식(`$node["X"].config.*`)이 이제 **원문**을 보게 하고, 안전성은 REST/WS 두 egress 가 공유하는
`deepRedactSecrets*` 가 이미 자격증명 키 축을 덮는다는 포함관계(`DEFAULT_SENSITIVE_KEYS ⊆
CREDENTIAL_KEY_PATTERN`)에 위임한다. `spec/5-system/` 의 3개 파일 변경은 이 코드 변경을 반영하는
**용어 정정 + 취소선 정정** 수준의 소폭 편집이다.

## 발견사항

### INFO — 신규 인용이 동일 target 의 기존 anchor-link 관례를 따르지 않음
- target 위치: `spec/5-system/4-execution-engine.md` "Engine Raw Config Exposure" 절의 신규 블록
  (`> **`config` 에는 storage-time 마스킹이 없다**... — [node-output.md Principle 7](../conventions/node-output.md)`)
- 위반 규약: 명시적 "정식 규약" 조항은 아니고, 같은 대상(node-output.md Principle 7)을 인용하는
  같은 PR 안의 자매 문서 관례
- 상세: 같은 PR 이 건드린 `spec/5-system/14-external-interaction-api.md`(:1710)와 기존
  `spec/5-system/6-websocket-protocol.md`(:216)는 동일 Principle 7 을 인용할 때
  `#principle-7--config-echo-원칙-nodehandleroutputconfig` **anchor 를 포함**하는데, 신규로 추가된
  `4-execution-engine.md` 인용은 파일 링크만 걸고 anchor 가 없다. 다만 저장소 전체를 보면
  `spec/4-nodes/_product-overview.md:407` · `spec/3-workflow-editor/1-node-common.md:306` 도
  anchor 없이 인용하고 있어 **이미 혼재된 스타일**이다 — 이번 PR 이 새로 만든 위반이라기보다
  기존 비일관성에 한 사례를 더한 것.
- 제안: 강제 규약이 아니므로 BLOCK 사유는 아니다. 후속 편집 시 anchor 를 붙이면 동일 파일군
  내 인용 스타일이 통일된다.

### INFO — `NodeHandlerOutput.config` aliasing 변경이 코드 주석에만 있고 conventions 문서엔 미반영
- target 위치: (간접) `spec/conventions/node-output.md` "`context.rawConfig` 의 mutation 보호"
  단락 — 이번 diff 대상은 아니지만 이번 PR 의 코드 변경과 직접 관련
- 위반 규약: 명시적 위반은 아님 — 문서 커버리지 gap 후보
- 상세: `execution-context.service.ts` 의 신규 JSDoc 은 "Load-bearing since 2026-08-24" 라고
  명시하며, `maskSensitiveFields` 제거로 `adapted.config` 가 더 이상 방어적 복제본이 아니라
  **핸들러가 반환한 객체 그 자체**가 장수명 캐시(`structuredOutputCache`)에 참조로 저장된다고
  설명한다 — 핸들러가 반환 후 자기 `config` 객체를 mutate 하면 캐시도 함께 오염될 수 있다는
  새 불변식이다. `node-output.md` 의 기존 "mutation 보호" 단락은 `context.rawConfig`(엔진→핸들러
  입력)의 freeze 만 다루고, 이 반대 방향(핸들러→캐시, 출력 aliasing)은 다루지 않는다.
- 제안: CRITICAL/WARNING 사유는 아니다 (코드 자체 JSDoc 이 이미 위험을 명시하고 있고, 관례상
  D1 명시 열거 echo 패턴을 따르는 핸들러라면 매 호출 새 객체를 만들어 위험이 낮다). 다만 향후
  `node-output.md` 개정 시 이 aliasing 계약을 한 줄 추가해 두면 다음 리팩터가 "복제였으니
  안전하다" 는 잘못된 전제를 다시 쌓는 것을 막을 수 있다.

## 확인된 준수 사항 (참고)

- **좌표계 정합**: `egress-masking.md` §1 표(마스커 좌표계)는 이번 PR 로 바뀌지 않았고, 신규 추가된
  콜아웃("`maskSensitiveFields` 는 이 좌표계 표에 행이 없다")이 코드 diff(`mask-sensitive-fields.util.ts`
  주석: "소비처는 이제 `explore-tools.service.ts` 하나다")와 정확히 일치한다.
- **egress-only 원칙 일관성**: `node-output.md` Principle 7 신규 블록과 `spec/5-system/4-execution-engine.md`
  "Engine Raw Config Exposure" 신규 블록이 동일한 근거(REST `redactStoredDataForResponse` / WS
  `maskWireEnvelope`, 공유 `deepRedactSecrets*`)를 **문구까지 정합**하게 서술한다.
- **용어 정정 전파 완결성**: "boundary masking parity" → "egress masking parity" 이름 교체가
  `spec/2-navigation/14-execution-history.md`(원본 정정) · `spec/5-system/14-external-interaction-api.md`
  · `spec/5-system/6-websocket-protocol.md` **세 곳 모두**에 일관되게 반영됐다 (grep 으로
  잔존 `boundary masking parity` 0건 확인). 인접한 다른 용어 `boundary parity`(수신 인구 parity,
  다른 개념)는 이번 정정 대상이 아니며 건드리지 않은 것이 맞다 — 혼동하기 쉬운 두 용어를
  구분해 유지했다.
- **자기-반증형 소정정 형식 준수**: 취소선(`~~구문~~`) + 굵게 정정문 + 날짜(2026-08-24) 패턴이
  `node-output.md`(변경 대상 확인용 conventions 문서)와 `4-execution-engine.md` 양쪽에서
  동일 스타일로 적용됐고, 인접 서술(TTL·재구성 로직 등)은 건드리지 않았다 — CLAUDE.md
  §자기-반증형 소정정 조건 4("정정은 그 문장에 국한")를 만족하는 형태.
- **거버넌스 우회 없음**: `plan/complete/masking-expression-egress-split.md` 의 `spec_impact`
  에 정확히 이 3개 spec/5-system 파일을 포함한 6개 파일이 등재되어 있고, "이 변경은 developer
  자신이 쓴 예고가 아니므로 자기-반증형 소정정 대상이 아니다 → planner 턴으로 처리" 라고 명시,
  실제로 `--impl-prep` BLOCK:YES → planner 턴 경유로 spec 을 고쳤다. CLAUDE.md 워크플로 규약과
  정합.
- **금지 패턴 재도입 없음**: 마커 리터럴(`VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER` 값)을 문서에
  직접 적는 egress-masking.md 의 금지 규칙을 이번 diff 가 위반하지 않는다 (예시로 쓴
  `****abcd` 는 마스킹 패키지의 마커 상수가 아니라 서술용 illustrative 문자열).
- **API 문서 규약(Swagger/OpenAPI)**: 이번 diff 범위에 컨트롤러/DTO/데코레이터 변경이 없어
  해당 관점의 신규 위반 없음.

## 요약

`spec/5-system/` 에서 이번 PR 로 실제 변경된 파일은 3개(`4-execution-engine.md` ·
`6-websocket-protocol.md` · `14-external-interaction-api.md`)뿐이며, 모두 코드 변경(config echo
masking 을 storage 경계에서 egress 로 이동)을 반영하는 용어 정정·취소선 정정 수준의 좁은 편집이다.
`spec/conventions/egress-masking.md` 및 `spec/conventions/node-output.md` 의 좌표계·Principle 7
서술과 문구 단위로 정합하며, "boundary masking parity → egress masking parity" 용어 교체가 관련
3개 문서 전체에 누락 없이 전파됐다. CLAUDE.md 의 자기-반증형 소정정 형식(취소선 보존 + 날짜 + 국소
정정)도 준수한다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. INFO 2건은 각각
(1) 신규 인용의 anchor-link 스타일 비일관(기존에도 혼재하던 패턴의 연장), (2) 코드 주석에만 있는
신규 config aliasing 불변식이 `node-output.md` mutation-보호 단락에는 아직 반영되지 않은 문서
커버리지 gap — 둘 다 차단 사유가 아닌 선택적 개선 제안이다.

## 위험도

NONE
