# 정식 규약 준수 Check — convention_compliance

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**scope**: `cafe24-call-401-retry`
**검토 대상**: `plan/in-progress/cafe24-call-401-retry.md` + `plan/in-progress/spec-update-cafe24-call-401-retry.md` (위임 노트) + 구현 대상 파일 `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`

---

### 발견사항

- **[INFO]** `source` 라벨 `'proactive'` — plan 과 기존 코드 간 일치, 추가 label 금지 명시
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` §코드 항목 "refreshViaQueue('proactive') 의 source label 을 그대로 사용 … 새 source label 추가 금지"
  - 위반 규약: 해당 없음 (규약 준수 확인)
  - 상세: 기존 코드의 `refreshViaQueue(integration, 'proactive' | 'background')` type union 이 spec/conventions 에 별도로 강제된 enum 은 아니다. plan 이 스스로 "새 source label 추가 금지" 를 명시하고 있고, 구현 예정 코드도 `'proactive'` 를 재사용하도록 제한하고 있어 규약 위반 소지 없음.
  - 제안: 확인 차원 정보. 변경 불필요.

- **[INFO]** spec §10.5 와 구현 의도 간 일시적 드리프트 — 의도된 SDD 순서
  - target 위치: `plan/in-progress/spec-update-cafe24-call-401-retry.md` §위임 사유
  - 위반 규약: 해당 없음 (SDD 패턴 준수)
  - 상세: `spec/2-navigation/4-integration.md §10.5` 현재 본문은 "노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출" 만 정의하고 있으며, `executeWithRateLimit()` 가 401 을 받은 뒤 refresh → 1회 재시도하는 경로는 아직 명시되어 있지 않다. plan 자체가 이 드리프트를 인지하고 `spec-update-cafe24-call-401-retry.md` 를 통해 project-planner 위임을 예약하고 있다 (`spec/` 은 developer skill 의 read-only). CLAUDE.md 의 "spec 본문 수정 필요 시 project-planner 로 위임" 정책에 부합한다.
  - 제안: 변경 불필요. 코드 PR 머지 후 spec 갱신 PR 이 즉시 후속되도록 `cafe24-test-connection-2d7fa4` plan 과의 직렬화 여부를 project-planner 가 확인.

- **[INFO]** plan frontmatter `type: spec-update-delegation` 비표준 키
  - target 위치: `plan/in-progress/spec-update-cafe24-call-401-retry.md` 1행 frontmatter
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 — frontmatter 는 `worktree`, `started`, `owner` 세 키를 표준으로 정의.
  - 상세: `type: spec-update-delegation` 는 CLAUDE.md 에 정의된 표준 frontmatter 키가 아니다. 그러나 이것은 추가 키(비표준이지만 충돌하지 않음)이며, `plan_coherence` checker 의 worktree 충돌 검출 로직이 사용하는 필드(`worktree`, `started`, `owner`) 는 모두 정상 존재한다. 무결성 위협 없음.
  - 제안: 관례적으로 허용 가능. 필요시 `owner` 필드에 역할 맥락을 상세히 기재하는 방식으로 `type` 키를 대체할 수 있으나 강제 사항은 아님.

---

### 요약

`cafe24-call-401-retry` 구현 scope 는 정식 규약(`spec/conventions/`)의 직접 위반 사항이 없다. 구현 대상인 `cafe24-api.client.ts` 의 `executeWithRateLimit()` 401 분기 수정은 — `refreshViaQueue('proactive')` 재사용, 403 분기 동결, 재시도 1회 제한, 무한 재귀 금지 — 모두 기존 `pingConnection()` 패턴 및 `spec/conventions/cafe24-api-metadata.md` 의 scope/메타데이터 규약과 일치한다. spec §10.5 와의 일시적 드리프트는 CLAUDE.md 의 SDD 순서(코드 PR 먼저, spec 갱신 PR 후속) 에 따른 의도된 패턴이며 별도 위임 플랜(`spec-update-cafe24-call-401-retry.md`)이 준비되어 있다. 발견된 항목 3건은 모두 INFO 등급이며 구현 차단 사유 없다.

### 위험도

NONE
