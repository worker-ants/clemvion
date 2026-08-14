### 발견사항

- **[WARNING]** title/Overview/하단 `## Rationale` 이 item (1) 의 철회와 서로 다른 결론을 동시에 담고 있다
  - target 위치: frontmatter `title`("...실측 shape 으로 재작성"), `## Overview`("직접 실측하니 안쪽 구조가 통째로 실제와 다르다" / "문서대로 파서를 짜면 동작하지 않는다"), 하단 `## Rationale` 의 **"왜 예시를 실측으로 맞추나(문서에 코드를 맞추지 않고)"** 항목 vs. 본문 **`### (1) §6.2 — 봉투만 맞춘다 (caveat 패턴 유지, 안쪽 재작성 철회)`**
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` **"§4.4 wire 필드 caveat — 직접 재작성 대신 caveat + 오너십 분리 (2026-07-14, PR #945)"** — 이 항목이 이미 EIA §6.2 를 "논리 JSON + wire caveat" 패턴의 선례로 명시했음
  - 상세: item (1) 은 "초판은 '안쪽을 실측 키로 교체' 였다 — 철회한다" 라고 명시적으로 번복하고, `node`/`interaction`/`context` 는 "의도된 논리 표기" 이며 이를 "허구로 진단한 것이 틀렸다" 라고 스스로 정정한다. 이는 WS §4.4 Rationale 이 이미 확립한 caveat 패턴과 정합하는 **올바른 되돌림**이다. 문제는 이 되돌림이 문서 전역에 반영되지 않았다는 것 — (a) frontmatter `title` 은 여전히 "실측 shape 으로 재작성" 이라고 선언하고, (b) `## Overview` 는 여전히 "안쪽 구조가 통째로 실제와 다르다"/"문서대로 파서를 짜면 동작하지 않는다" 라고 (이제는 철회된) 원 전제를 그대로 서술하며, (c) 하단 `## Rationale` 의 두 번째 항목 제목 자체가 "왜 예시를 실측으로 맞추나(문서에 코드를 맞추지 않고)" 라 item (1) 의 결론("안쪽 JSON 은 그대로 둔다" = 실측 키로 안 맞춘다)과 문면상 정반대다. 이 plan 의 `## Rationale` 절은 spec 반영 시 그대로 `14-external-interaction-api.md` 의 `## Rationale` 에 흡수될 가능성이 높은 텍스트인데, 그 상태로 반영되면 §6.2 의 실제 최종 결정(안쪽 유지 + blockquote 만 정정)과 모순되는 문구가 spec Rationale 에 고착된다.
  - 제안: `title` 을 "봉투 caveat + blockquote 필드명 정정" 계열로 좁히고, `## Overview` 에 item (1) 의 철회를 반영하는 한 줄 정정을 추가하며, 하단 `## Rationale` 의 "왜 예시를 실측으로 맞추나" 항목은 그 적용 범위를 **blockquote(§6.2 필드명 매핑)** 로 한정한다고 명시(또는 제목을 "왜 blockquote 매핑만 실측으로 맞추나" 로 좁힘)하여 안쪽 JSON 은 대상이 아님을 분명히 한다.

- **[WARNING]** item (4) `error.code` optional 화가 `15-chat-channel.md` R-CC-15 의 closed-enum 분류 전제를 건드리는데 cross-reference·spec_impact 가 없다
  - target 위치: `### (4) error.code 를 옵셔널로 (§6.4 + 필드 집합 표)` 및 frontmatter `spec_impact` (3개 파일만 등재: `14-external-interaction-api.md`/`1-data-model.md`/`6-websocket-protocol.md`)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` **"R-CC-15. Execution Failed 안내 — 분류 입력 화이트리스트 + placeholder 1종 정책"**
  - 상세: 현재 `spec/5-system/14-external-interaction-api.md §6.4` 는 `error.code` 를 `"EXECUTION_TIMEOUT" | "EXECUTION_TIME_LIMIT_EXCEEDED" | ... | ...` 형태의 **항상 채워지는** 문자열 유니온으로 문서화한다(실측 확인: L733). R-CC-15 는 바로 이 `output.error.code` 를 "분류 입력 화이트리스트"의 핵심 축으로 삼고, "분류 결정이 enum 이므로 코드 수준 정적 검증 가능(switch 문 exhaustive check 가능)" 을 명시적 근거로 든다. item (4) 는 이 필드를 **옵셔널**(대부분의 일반 catch 경로에서 부재)로 바꾸자고 제안하면서, R-CC-15 의 소비 측 전제(코드가 항상 존재, "unknown code" 는 신규 카테고리 미반영 케이스를 뜻함)를 언급하거나 갱신하지 않는다. `error.code` 가 부재(`undefined`)로 새로 발생 가능해지는 것이 R-CC-15 의 "unknown code fallback → executionFailedInternal" 런타임 분기에 자연 흡수될지, 아니면 별도 처리(예: TS 타입 상의 `undefined` 미고려)가 필요한지는 이 draft 에서 검증·언급되지 않았다. `spec_impact` frontmatter 에도 `spec/5-system/15-chat-channel.md` 가 빠져 있어, 이 리플이 review 파이프라인 상에서 아예 대상 밖으로 처리될 위험이 있다.
  - 제안: item (4) 본문에 R-CC-15 cross-ref 를 추가하고, `error.code` 부재 시 chat-channel 분류 switch 가 `executionFailedInternal` 로 안전하게 떨어짐을 (코드 확인 또는 명시적 문구로) 확정한다. 실제로 영향이 없다면 그 사실을 item (4) 의 근거에 한 줄 추가하고, 영향이 있다면 `spec_impact` 에 `15-chat-channel.md` 를 추가하고 R-CC-15 에 "code 부재는 unknown-code 와 동일 취급" 같은 명시적 addendum을 단다.

- **[INFO]** 형제 plan 각주는 이미 반영돼 있음 — 중복 작업 표기만 정리
  - target 위치: `### (3) "SSE 필드명 매핑" blockquote 정정` 하단 "형제 plan 과 충돌한다" 블록 — "그 plan 에 반증 각주를 다는 것을 이 작업의 일부로 포함한다"
  - 과거 결정 출처: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` §"실행 (2026-08-13)" 항목의 **"소급 정정 (2026-08-14)"** 각주 — 이미 본 target 문서를 정확히 역참조하고 있음("상세·처방: spec-draft-eia-62-waiting-payload.md 변경 제안 (1)·(3)")
  - 상세: target 은 이 각주 추가를 "포함한다"(앞으로 할 일)로 서술하지만, 실측 결과 그 각주는 오늘 날짜(2026-08-14)로 형제 plan 파일에 이미 존재한다. Rationale 자체의 충돌은 아니지만, 이 문서가 완료 처리될 때 "이미 완료된 항목을 미완료로 재수행"할 여지가 있다.
  - 제안: 해당 문구를 "이미 반영됨(확인)" 으로 갱신.

### 요약

핵심 결정 — §6.2 안쪽 JSON 을 실측 키로 재작성하지 않고 caveat 패턴(봉투 + blockquote 정정만)을 유지하기로 한 item (1) 의 철회, 그리고 §R17/WS §4.4 strip 범위를 코드 실측에 맞춰 넓히며 새 Rationale 을 함께 쓰는 item (7) 은 모두 기존 spec Rationale(WS §4.4 "wire 필드 caveat", "strip-only 결정")과 정합하며 번복 시 근거를 남기는 정석적인 처리다. 다만 두 가지 결함이 남는다: (1) item (1) 의 철회가 문서 전역(title/Overview/하단 Rationale 제목)에 고르게 반영되지 않아, 이 상태로 spec 에 반영되면 상반된 결론이 공존하는 Rationale 이 고착될 위험이 있고, (2) item (4) 의 `error.code` optional 화는 `15-chat-channel.md` R-CC-15 가 명시적으로 의존하는 "closed-enum 분류 입력" 전제를 건드리는데 그 cross-spec 영향이 검증·인용되지 않았고 `spec_impact` 에도 빠져 있다. 두 항목 모두 CRITICAL 급 위반(기각된 대안의 무단 재도입)은 아니며, spec 반영 전 정리하면 되는 WARNING 수준이다.

### 위험도
MEDIUM
