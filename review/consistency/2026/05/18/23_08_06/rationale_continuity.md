### 발견사항

- **[INFO]** `Cafe24McpBridge.listTools()` description 수정 위치 표현 혼선
  - target 위치: `plan/in-progress/spec-draft-ai-timezone-context.md` §1.2 §5.3
  - 과거 결정 출처: 해당 없음 (기존 Rationale 충돌이 아닌 target 내부 표현 문제)
  - 상세: §1.2 변경 위치 요약 표에서 "description 끝에 자동 prepend" 라고 서술하고, §5.3 소제목도 동일 표현을 사용한다. "prepend"는 앞에 추가하는 동작이고, "description 끝에" 추가하는 것은 "append"이다. §6 의사결정 표에서는 "Cafe24 description suffix 위치 — 도구 description 의 마지막 줄"이라 명시해 실제 의도는 append(suffix)임을 확인할 수 있다. Rationale 연속성 위배는 아니나, spec 본문에 이 표현이 그대로 반영되면 구현자가 prepend(앞에 붙임)로 잘못 해석할 수 있다.
  - 제안: §1.2, §5.3, §5.4 에서 "description 끝에 자동 prepend" 표현을 "description 끝에 자동 append (suffix)" 또는 "모든 도구 description 뒤에 KST 한 줄 자동 부기"로 통일. 단, target 내 일부 위치에서 이미 "suffix", "자동 부기" 표현을 올바르게 사용하고 있으므로 앞 위치들만 수정하면 충분하다.

- **[INFO]** `includeSystemContext: true` default 로 인한 기존 워크플로 breaking change — Rationale 에 opt-out 마이그레이션 가이드 기록 권장
  - target 위치: `plan/in-progress/spec-draft-ai-timezone-context.md` §4 Side-effects, §3.3 Rationale 대안(A) 기각
  - 과거 결정 출처: 해당 없음 (기존 Rationale 에 AI 노드 systemPrompt prefix 관련 결정 없음 — 신규 설계)
  - 상세: target §4 는 "기존 워크플로의 LLM 호출에 30토큰 prefix 가 자동 추가 — 응답 변화 가능"를 side-effect 로 인식하고 `includeSystemContext: false`로 opt-out 가능하다고 명시한다. 그러나 spec 본문(0-common.md §11)에 기존 워크플로 사용자에게 이 변화를 어떻게 고지하는지 또는 rollout 시점에 default 를 `false`로 시작했다가 `true`로 전환하는 점진적 전략이 있는지에 대한 명시가 없다. Rationale 기각 대안 (A, opt-in) 의 근거가 "토큰 비용 미미 + 일반 prefix 패턴"으로 서술되어 있으나, 기존 워크플로 응답 품질 회귀 위험에 대한 구체적 완화 방안이 Rationale 에 부재하다.
  - 제안: `0-common.md §11 Rationale` 의 대안(A) 기각 항목에 "기존 워크플로 보호: 응답 변화가 우려되는 워크플로는 노드 config에서 `includeSystemContext: false`로 명시적 opt-out 가능. 신규 default-true 적용은 해당 spec PR merge 이후 신규 생성·수정된 워크플로부터 적용되며, DB 기존 row는 config 필드 부재 시 true로 해석된다" 식으로 기존 row 해석 정책과 점진적 적용 범위를 명문화할 것을 권장.

- **[INFO]** 기각된 대안 (A) — backend 자동 변환 — 의 기각 근거가 기존 Rationale 의 "단일 진실 원칙"과 호환됨을 명시적으로 연결하지 않음
  - target 위치: `plan/in-progress/spec-draft-ai-timezone-context.md` §3.1 Rationale 신규 항, 대안 (A) 기각
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Attention 가상 필터값" — "영속화되는 상태와 화면 필터링용 술어를 분리"
  - 상세: target 이 기각한 대안 (A) "시각 변환을 backend wrapper가 자동 수행"은 기존 Rationale 에서 명시적으로 채택 또는 기각된 대안이 아닌 신규 검토 항목이다. 기각 이유("의도 추론이 위험 — '오늘 자정'이 UTC 자정인지 KST 자정인지 모호")는 신규 근거이므로 Rationale 연속성 위배는 없다. 다만, 기존 통합 도메인의 "영속 상태 vs 화면 술어 분리" 원칙과 유사하게 "LLM 의도(domain) vs 데이터 변환(infrastructure) 분리" 원칙으로 이어지는 흐름임을 명시하면 Rationale 간 coherence 가 높아진다.
  - 제안: 필수 수정 사항은 아님. 선택적으로 §3.1 대안 (A) 기각 항목에 "기존 통합 도메인의 'DB 상태와 화면 필터링 술어 분리' 원칙(spec/2-navigation/4-integration.md Rationale)과 같은 맥락 — 변환 책임을 infrastructure가 무관적으로 수행하면 의도 투명성이 낮아진다"는 연결 문구 추가를 고려할 수 있다.

### 요약

target 문서(`plan/in-progress/spec-draft-ai-timezone-context.md`)는 기존 spec 의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나, 합의된 설계 원칙을 위반하거나, 과거 결정을 근거 없이 번복하는 사례를 포함하지 않는다. `$now` 의 UTC 고정 invariant(`spec/5-system/4-execution-engine.md §6`)는 그대로 보존되며, target 은 이를 prefix 변환 시 출처로 명확히 인용한다. 워크스페이스 timezone SoT(`Workspace.settings.timezone`)도 기존 NAV-SC-06 필수 항목과 일치한다. 발견된 세 건은 모두 INFO 수준으로, 첫 번째는 target 내 "prepend/append" 표현 혼선(spec 작성 품질 이슈), 두 번째는 default-true 적용에 따른 기존 워크플로 영향 완화 방안의 Rationale 보강 권장, 세 번째는 기각 근거와 기존 설계 원칙 간 연결 명시 제안이다. Rationale 연속성 관점에서 이번 spec draft 는 건전하다.

### 위험도

LOW
