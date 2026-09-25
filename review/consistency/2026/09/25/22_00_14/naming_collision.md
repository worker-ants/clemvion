# 신규 식별자 충돌 검토 — spec-draft-integration-personal-owner-assistant

## 검토 대상 요약

target(`plan/in-progress/spec-draft-integration-personal-owner-assistant.md`)은 `spec/3-workflow-editor/4-ai-assistant.md`
세 자리에 **설명 문구 보강 + 기존 앵커 링크 추가**만 한다:

1. §4.2 탐색 도구 표 `list_integrations` 행 — 설명 문구에 괄호 절 추가
2. §4.3.1 후보 필터 표 `integration-selector` · `mcp-server-selector` 두 행 — 설명 문구에 괄호 절 추가
3. Rationale ED-AI-39 "구현자가 기억해야 할 계약" 1번 — 괄호 절 추가

세 자리 모두 **새 요구사항 ID·엔티티·DTO·endpoint·이벤트·ENV·config key·파일을 도입하지 않는다** — 기존 식별자(`list_integrations`,
`integration-selector`, `mcp-server-selector`, `ED-AI-39`)의 설명에 조회 범위 제약을 덧붙이고, 이미 존재하는 앵커
(`spec/2-navigation/4-integration.md#8-권한-규칙`)로 링크만 새로 건다.

## 확인한 사항

- `list_integrations`·`integration-selector`·`mcp-server-selector`·`ED-AI-39` 는 `spec/3-workflow-editor/4-ai-assistant.md` 에
  이미 정의된 식별자이고(각각 §4.2 L201, §4.3.1 L371·L372, Rationale L798·L1402), target 은 이 식별자들을 **재정의하지 않고 그대로
  참조**한다. 새 이름을 만들지 않으므로 "다른 의미로 이미 사용 중" 충돌이 성립할 여지가 없다.
- 링크 대상 앵커 `#8-권한-규칙` 은 `spec/2-navigation/4-integration.md:790` `## 8. 권한 규칙` 헤더에서 나온 것으로 실재하며, 같은
  파일의 §9.2 precheck 두 행(L851, L852)이 이미 같은 앵커로 self-link 하고 있다 — target 이 처음 쓰는 참조 형식이 아니라 기존
  관례를 다른 spec 파일에서 재사용하는 것이다.
- "판정 규칙" 이라는 일반 명사구가 `spec/2-navigation/14-execution-history.md`(표 컬럼명) · `spec/5-system/2-api-convention.md` ·
  `spec/5-system/4-execution-engine.md` 에도 등장하지만 고유 식별자가 아니라 보통명사이고, target 은 이 문구를 새로 쓰지도 않는다
  (§8 링크 텍스트로 "통합 §8" 을 쓴다) — 충돌 아님.
- 파일 경로 `plan/in-progress/spec-draft-integration-personal-owner-assistant.md` 는 같은 디렉터리의
  `spec-draft-integration-personal-owner.md`(반영 완료) · `integration-personal-owner.md` · `integration-personal-owner-followup.md`
  와 이름이 겹치지 않고, `spec-draft-<slug>` 컨벤션과 "이미 반영된 draft 의 보강분은 별도 draft 로 받는다" 는 target 자신의
  Rationale(§"왜 별도 draft 인가")이 부여하는 `-assistant` suffix 로 대상 spec 파일을 식별할 수 있게 구분된다. 기존 명명 컨벤션을
  깨지 않는다.

## 발견사항

없음. target 이 도입하는 신규 식별자가 없어 본 관점(요구사항 ID·엔티티/타입·API endpoint·이벤트·ENV/설정키·파일 경로)에서 검토할
충돌 후보 자체가 존재하지 않는다.

## 요약

target 문서는 새 식별자를 전혀 만들지 않고, 기존에 이미 정의된 도구명(`list_integrations`)·widget id(`integration-selector`,
`mcp-server-selector`)·요구사항 ID(`ED-AI-39`)의 설명 문구에 조회 범위 제약을 덧붙이며, 이미 존재하는 `§8 권한 규칙` 앵커로 링크만
새로 연결한다. 파일 경로도 기존 명명 컨벤션 안에서 구분 가능한 이름을 쓴다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
