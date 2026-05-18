# Cross-Spec 일관성 검토 결과

> 검토 대상: `plan/in-progress/spec-draft-ai-timezone-context.md`
> 검토 모드: `--spec` (spec draft 검토)
> 검토 일시: 2026-05-18

---

### 발견사항

---

- **[WARNING]** `cafe24-api-metadata.md` 의 §5.3 에서 description 을 `prepend` 라 기술하고 `suffix` 라 예시하는 용어 불일치
  - target 위치: `§1.2 cafe24-api-metadata.md §5.3` — "모든 도구의 description 끝에 다음 한 줄을 자동 **prepend**" 라고 쓰면서 예시에서는 `(Cafe24 GET products)` 뒤에 해당 줄이 **append** 되어 있다. §6 의사결정 표에서도 "Cafe24 description suffix 위치 — 도구 description 의 마지막 줄"로 `suffix`/`append` 로 표현.
  - 충돌 대상: 동일 draft 의 §6 `의사결정 default` 표 (`Cafe24 description suffix 위치`), `§1.3 4-cafe24.md §8.1` 한 줄 추가 (`description suffix` 라 명명)
  - 상세: §5.3 의 "자동 prepend" 는 오기(誤記)이다. 본문은 "description 끝에" 라고 했고 예시도 끝에 붙으므로 실제 의도는 `append`/`suffix` 다. 그러나 `spec/5-system/11-mcp-client.md` §2.3 추가 한 줄도 "description suffix" 로 표기해 세 군데 중 한 군데만 `prepend` 라는 단어를 쓴다. 용어가 혼재하면 구현자가 혼동할 수 있다.
  - 제안: `spec/conventions/cafe24-api-metadata.md §5.3` 의 "자동 prepend" 를 "자동 append (description 끝에 suffix)" 로 수정. 섹션 제목 "description 자동 부기" 는 중립이라 유지 가능.

---

- **[WARNING]** `0-common.md §11.4` 의 systemPrompt build ordering 이 `conversation-thread.md §5` 의 기존 ordering 기술과 충돌 가능성
  - target 위치: `§2.2 0-common.md §11.4` — ordering `[1] System Context Prefix → [2] 사용자 systemPrompt → [3] KB_TOOL_GUIDANCE → [4] Condition suffix → [5] Thread injection (system_text 모드)`
  - 충돌 대상: `spec/conventions/conversation-thread.md §5` AI Agent 자동 주입 (draft 에서 §5 에 "ordering 한 줄 추가" 예정이나, 기존 §5 의 원문이 코퍼스에 미포함)
  - 상세: draft 는 `conversation-thread.md §5` 에 한 줄만 추가하여 기존 ordering 기술이 있다면 두 곳이 각각 ordering 을 정의하게 된다. `0-common.md §11.4` 가 canonical SoT 이고 `conversation-thread.md §5` 가 참조 요약이어야 하는데, 만약 기존 `conversation-thread.md §5` 에 이미 다른 순서(예: thread injection → systemPrompt) 로 기술된 내용이 있다면 직접 충돌이 발생한다. draft 의 §2.5 추가 한 줄은 ordering 을 다시 정의하는 게 아닌 "§11.4 를 참조하라" 는 포인터 역할이어야 한다.
  - 제안: `0-common.md §11.4` 를 canonical 로 명시하고, `conversation-thread.md §5` 에 추가하는 한 줄은 "SoT 는 §11.4" 를 가리키는 링크만 두어 중복 정의를 방지한다. `conversation-thread.md` 의 기존 내용이 다른 ordering 을 기술하고 있다면 그쪽을 §11.4 에 맞춰 갱신해야 한다.

---

- **[WARNING]** `$now` 의 "execution 단위 frozen" 정의와 `§11.4` "Multi Turn 에서 turn 마다 prefix 재계산" 설명의 미묘한 불일치
  - target 위치: `§2.2 0-common.md §11.2` — "`$now` (execution 단위 frozen, UTC). prefix 본문에는 §11.3 의 timezone 으로 변환된 ISO 출력". `§2.3 1-ai-agent.md §6.2` 한 줄 — "turn 마다 prefix 재계산 — `$now` 가 turn 마다 갱신되지 않으므로 사실상 노드 실행 단위 frozen"
  - 충돌 대상: `spec/5-system/4-execution-engine.md §6.2 제공 변수` — `$now` 는 execution 시작 시점에 frozen UTC ISO8601 (기존 spec 정의, 코퍼스에서 §0 사실관계 확인에 인용됨)
  - 상세: "turn 마다 prefix 재계산" 이라는 표현이 `$now` 를 실제로 다시 계산한다는 오해를 줄 수 있다. 현재 설명의 괄호 안에 "사실상 노드 실행 단위 frozen" 이라는 단서가 있으나, 표현이 모호하다. `$now` 가 execution 단위로 frozen 이라면 multi-turn 에서도 같은 `$now` 를 사용해 "turn 마다 재계산해도 결과가 같다" 는 의미인데, 이를 명시하지 않으면 구현자가 turn 마다 `Date.now()` 를 새로 호출하는 구현을 선택할 위험이 있다.
  - 제안: `§11.4` 의 해당 괄호를 "`$now` 는 execution 시작 시점 고정이므로 multi-turn 에서 재계산해도 동일 값 — 사실상 노드 실행 단위 frozen" 으로 명확화. 또는 "재계산 없이 동일 `$now` 참조" 로 기술 방식을 통일.

---

- **[INFO]** `output.config` echo 에서 신규 필드의 `?` (optional) 처리 기준이 CONVENTIONS Principle 7 과 정합 여부 확인 필요
  - target 위치: `§2.3 1-ai-agent.md §7 config echo` — `includeSystemContext?` / `systemContextSections?` 를 optional 로 표기
  - 충돌 대상: `spec/conventions/node-output.md` CONVENTIONS Principle 7 (config echo 는 실제 적용된 값을 모두 echo — optional 생략 기준이 별도 정의되어 있을 수 있음)
  - 상세: 기존 `output.config` echo 필드 중 `conditions?` / `knowledgeBases?` 등도 `?` 로 표기되어 있어 패턴은 일관된다. 단, `includeSystemContext` 는 기본값 `true` 이므로 "값이 없는 경우" 가 없어 항상 echo 되어야 한다. `?` 표기가 "absent when default" 를 의미하는지 "값이 있을 때만 포함" 을 의미하는지가 모호하다. 코루스 내 `CONVENTIONS Principle 7` 원문이 없어 단정하기 어렵지만, 기존 필드들의 `?` 표기 패턴이 "기능 미사용 시 생략" 의미라면 `includeSystemContext: true` 가 default 일 때 항상 echo 하는지 생략 가능한지가 불명확하다.
  - 제안: `spec/conventions/node-output.md` §7 의 optional 기준을 확인하고, `includeSystemContext` 가 항상 echo 대상인지를 draft 본문에 명시 ("기본값이어도 항상 echo" 또는 "기본값이면 생략 가능"). `2-text-classifier.md` / `3-information-extractor.md` 도 동일하게 적용.

---

- **[INFO]** `Workspace.settings.timezone` 필드의 공식 정의 위치가 data-model spec 에 미반영
  - target 위치: `§2.2 0-common.md §11.3` — `Workspace.settings.timezone` (IANA, NAV-SC-06 필수 항목)을 SoT 1번 우선순위로 참조
  - 충돌 대상: `spec/1-data-model.md §2.2 Workspace` — `settings` 필드는 `JSONB` 로만 정의되어 있고 내부 구조(`settings.timezone` 등)가 명시되어 있지 않다. `spec/2-navigation/_product-overview.md` NAV-SC-06 에서 timezone 이 필수 항목이라고 참조되지만 data-model 에는 JSONB 타입만 있을 뿐 schema 정의가 없다.
  - 상세: draft 가 `Workspace.settings.timezone` 을 SoT 로 사용하게 되면, 데이터 모델 spec 도 `settings` JSONB 내부 schema 에 `timezone: string (IANA)` 을 formal 하게 기술해야 한다. 현재 data-model 에 이 schema 가 없으면 구현자가 필드 이름을 임의로 정하거나 다른 이름을 쓸 수 있다. 이미 구현이 되어있다면 실질 충돌은 없지만 spec 의 누락이다.
  - 제안: `spec/1-data-model.md §2.2 Workspace` 의 `settings` 행에 `timezone: string (IANA, optional)` 을 schema 예시로 추가하거나, `spec/2-navigation/_product-overview.md NAV-SC-06` 행에서 data-model 참조를 역방향으로 추가. draft 에서 `Workspace.settings.timezone` 을 SoT 로 공식화하는 시점이 이 gap 을 채울 기회다.

---

- **[INFO]** `spec/5-system/11-mcp-client.md §2.3` 기존 Internal Bridge 표의 컨텍스트 확인 없이 "마지막 행 추가"를 가정
  - target 위치: `§1.4 11-mcp-client.md §2.3` — "§2.3 Internal Bridge 표의 마지막에 한 행 추가"
  - 충돌 대상: `spec/5-system/11-mcp-client.md §2.3` 의 실제 표 구조 (코퍼스에 미포함)
  - 상세: draft 는 §2.3 Internal Bridge 표에 "Bridge 별 description suffix" 한 행을 추가한다고 기술한다. 그런데 이 추가 내용이 표 행이 아닌 표 하단 blockquote(본문 draft 예시 참조)라면, "표의 마지막 행 추가" 가 아닌 "표 아래 blockquote 추가" 로 표현이 달라야 한다. draft 의 실제 예시 본문은 `> **Bridge 별 description suffix**: ...` 로 blockquote 형식인데 "한 행 추가" 라고 적었다.
  - 제안: `§1.4` 의 "표의 마지막에 한 행 추가 (또는 본문 한 줄)" 표현에서 "(또는 본문 한 줄)" 이 이미 양쪽 가능성을 열어두고 있다. 실제 §2.3 을 확인하여 표인지 서술인지 파악 후 추가 위치를 확정. 큰 문제는 아니지만 구현 시 혼란을 줄이기 위해 명확화 권장.

---

- **[INFO]** Cafe24 `$now` UTC-to-KST 변환 책임 소재 — 노드 핸들러 책임인지 명시 누락
  - target 위치: `§1.2 cafe24-api-metadata.md §5.4` — "워크플로우 캔버스의 Cafe24 노드는 사용자 표현식 `{{ $now.iso }}` 가 UTC ISO 라는 점을 인지하고 — Cafe24 가 designator 를 존중하므로 — 그대로 전송해도 의미 동일이다"
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §4` (기존 노드 실행 파라미터 처리 — 코퍼스에 미포함). `spec/5-system/4-execution-engine.md §6.2` `$now` UTC 정의
  - 상세: §5.4 는 참고 수준(informative) 이라고 명시하고, 책임을 "노드 핸들러 책임" 이라고 소제목에 표기한다. 그러나 어느 spec 문서가 이 책임을 정식으로 기술하는지가 불명확하다. `spec/4-nodes/4-integration/4-cafe24.md §4.3` 신설(draft §1.3) 에 bullet 로 포함되어 있으나, "참고" 수준인지 "규범적(normative)" 내용인지 등급 구분이 없다. 구현자가 §5.4 를 근거로 별도 변환 로직을 추가하거나 추가하지 않는 판단이 달라질 수 있다.
  - 제안: `spec/4-nodes/4-integration/4-cafe24.md §4.3` 의 해당 bullet 을 normative 어조로 확정하거나, §5.4 의 제목에 "(참고 — informative)" 라는 표시를 유지하면서 §4.3 이 규범적 SoT 임을 교차 명시.

---

### 요약

target draft 는 두 갈래(Cafe24 KST 명시 + AI 노드 시스템 컨텍스트 자동 주입)로 나뉜 spec 개정안이며, 기존 spec 의 다른 영역과 **직접 모순(CRITICAL)** 은 발견되지 않았다. 가장 주의할 사항은 `§5.3` 의 "prepend"/"suffix" 용어 불일치(WARNING)와, `conversation-thread.md §5` 와의 ordering 중복 정의 가능성(WARNING)이다. 두 WARNING 은 구현 혼동을 유발할 수 있으나, 동일 draft 안에서 정합성을 맞추면 해소된다. `$now` multi-turn 재계산 표현의 모호성(WARNING)은 구현자 오해를 방지하기 위해 명확화가 필요하다. INFO 항목들은 data-model 의 `Workspace.settings.timezone` 공식화, `output.config` echo optional 기준 명시, MCP Client 표 vs. blockquote 확인 등 drift 예방 수준의 권장 사항이다. 전반적으로 spec 구조는 기존 아키텍처(execution engine, data-model, RBAC, 상태 전이)와 정합하며 Critical 차단 없이 다음 단계(실제 spec 파일 편집)로 진행 가능하다.

### 위험도

LOW

---

*CRITICAL: 0, WARNING: 3, INFO: 4 — 합계 7건*
