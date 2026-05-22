# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/conventions/cafe24-api-metadata.md`
**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**검토 일시**: 2026-05-22
**검토 커밋**: `36a8f16` (spec: Cafe24OperationMetadata.constraints? 신설)

---

## 발견사항

### [INFO] `oneOf` 이름 중의성 — 명시적 disambiguation 은 완비, 단 switch.md 의 `requiredWhen` 맥락은 미언급

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §2` 의 "이름 주의" 박스
- **충돌 대상**: `spec/4-nodes/1-logic/2-switch.md §8.1`
- **상세**: target 은 `kind: 'oneOf'` 가 (1) JSON Schema `oneOf` ("정확히 1개") 및 (2) `Frontend UiHint.visibleWhen.oneOf` ("값 whitelist 비교") 와 의미가 다름을 명시한다. 그러나 `spec/4-nodes/1-logic/2-switch.md §8.1`에는 `requiredWhen` DSL 의 `oneOf` 형태가 등장하며 해당 DSL 의 `oneOf` 형태는 이미 폐기(`equals` array 로 대체) 된 상태다. target 의 "이름 주의" 박스는 `visibleWhen.oneOf`(값 whitelist) 를 언급하지만 이미 폐기된 `requiredWhen.oneOf` 형태는 누락한다. 타입 네임스페이스가 분리되어 있으므로 runtime/컴파일 충돌은 없다.
- **제안**: 정보성 갱신. target 의 "이름 주의" 박스에 `requiredWhen` DSL 에서는 이미 폐기된 이름임을 한 줄 추가하거나, 또는 switch.md 의 맥락이 이미 다른 타입 네임스페이스임을 확인하고 현행 유지로 족하다. 긴급 수정 불필요.

---

### [INFO] `constraints` 의 "두 채널" 표현과 `§2` / `§7` pseudocode 사이의 채널 수 미스매치

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §2` "constraints 의 의미" 단락 — "본 필드는 **두 채널** 로 노출하여 회귀를 방어한다 — (1) MCP 도구 description 자동 suffix, (2) execute() 의 runtime 검증. 일부 kind 는 (3) JSON Schema 변환도 추가한다."
- **충돌 대상**: 동일 문서 내 `§7 MCP Bridge 와의 매핑` 의 pseudocode 주석
- **상세**: 본문 "두 채널"이라 명시한 직후 "(3) JSON Schema 변환" 을 세 번째 채널로 나열하는 표현이 있다. 이는 동일 문서 내부 일관성 문제이며, 다른 spec 과의 직접 충돌은 아니다. `spec/4-nodes/4-integration/4-cafe24.md §4 step 5` 는 "requiredFields + constraints 검증" 을 한 단계로 묶어 runtime 검증 채널을 올바르게 반영한다. `spec/5-system/11-mcp-client.md §2.3` 의 Bridge description suffix 설명도 "constraint kind 별 한 줄씩 … 삽입" 으로 description suffix 채널과 schema 변환 채널을 구분 없이 서술한다.
- **제안**: "두 채널" → "세 채널 (oneOf 에 한해)" 또는 표현을 "두 의무 채널 + 선택적 schema 변환" 으로 재정리. 기능 동작에는 영향 없음.

---

### [INFO] `cafe24-api-catalog/_overview.md §5` Coverage Matrix 갱신 필요성

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §6 신규 endpoint 추가 절차` step 6
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/_overview.md §5 Coverage Matrix`
- **상세**: target §6 step 6은 "coverage matrix 카운트도 갱신"을 요구하나, `constraints` 신설이 coverage count 에는 영향을 주지 않는다. 신규 endpoint 추가 절차의 step 8 ("조건부 제약 확인") 이 추가되었으며 `_overview.md §4` 에 이미 `constraints invariant 는 catalog-sync 와 별개` 임이 명시되어 있다. Coverage Matrix 자체는 변경 불필요 — 다만 절차 step 순서 (step 8 "조건부 제약 확인") 가 step 6 (coverage matrix 갱신) 보다 나중에 위치하여 가독성이 다소 떨어진다. 기능 충돌은 없다.
- **제안**: step 8 을 step 6 바로 다음 (step 7) 으로 이동시키거나 step 순서 재조정을 검토. 현재 절차상 step 7 이 "백엔드 단위 테스트 자동 검증"이고 step 8 이 "조건부 제약 확인"인데, 조건부 제약 확인이 step 7 검증의 전제가 되는 순서상 의존이 있어 step 7 이전에 두는 것이 논리적이다.

---

### [INFO] `Cafe24McpToolProvider.execute()` 참조 일관성 — target 과 plan 파일 사이의 클래스명 불일치

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §2` "노드 핸들러 / MCP execute 시 runtime 검증" 단락 — `Cafe24McpToolProvider.execute()`
- **충돌 대상**: `plan/in-progress/cafe24-conditional-required-impl.md §4` — `cafe24-mcp-tool-provider.ts`
- **상세**: target 은 `Cafe24McpToolProvider.execute()` 라는 클래스명을 사용하는 반면, `spec/4-nodes/4-integration/4-cafe24.md §8.6` 은 `Cafe24McpToolProvider.buildTools()` 라는 동일 클래스명을 일관되게 사용한다. 그러나 target §7 pseudocode 의 함수명은 `operationToMcpTool` 이고 plan §4 는 `buildTools()` 안에서 suffix 를 생성한다고 기술한다. 이는 동일 클래스의 다른 메서드를 가리키며 실질 충돌이 아니나, spec 내에서 `Cafe24McpBridge` 와 `Cafe24McpToolProvider` 두 클래스명이 혼용된다 — `spec/5-system/11-mcp-client.md §2.3` 는 `Cafe24McpBridge` 라는 이름을 쓰고, target §7 pseudocode 도 `Cafe24McpBridge.listTools()` 를 사용하지만 §2 "runtime 검증" 단락은 `Cafe24McpToolProvider.execute()` 를 사용한다. spec 이 구현 클래스명을 두 가지로 기술하여 구현자 혼란 가능성이 있다.
- **제안**: target §2 "runtime 검증" 단락의 `Cafe24McpToolProvider.execute()` 를 `Cafe24McpBridge.callTool()` (§7 pseudocode 와 동일 이름) 또는 plan §4 의 `cafe24-mcp-tool-provider.ts` 를 근거로 일관되게 선택. 동작상 충돌 없음.

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 의 `constraints?: Cafe24FieldConstraint[]` 신설은 cross-spec 관점에서 실질적 모순을 유발하지 않는다. 주요 연관 spec (`spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cafe24-api-catalog/_overview.md`) 이 모두 같은 커밋(`36a8f16`)에서 함께 갱신되어 데이터 모델 충돌·API 계약 충돌·상태 전이 충돌·RBAC 충돌·계층 책임 충돌은 발견되지 않는다. 요구사항 ID 충돌도 없다. 발견된 4건은 모두 INFO 등급(명명 비일관성, 동기 권장)이며, 모두 기능 동작에 무해한 표현 수준의 이슈다. 구현 착수를 차단할 이유가 없다.

---

## 위험도

NONE

---

STATUS: OK
