# 변경 범위(Scope) 리뷰

- **worktree**: agent-memory-admin-ui-455467
- **diff 범위**: `9f30216f..HEAD`
- **리뷰 날짜**: 2026-06-05
- **리뷰어**: scope-reviewer (subagent)

---

## 커밋 구성

| 커밋 | 설명 |
|---|---|
| `a3adf16a` | docs(spec): A1 메모리 가시화/삭제 admin surface 정의 (AGM-12/13, NAV-AM-01~06) |
| `1b98ff02` | feat(agent-memory): 메모리 조회/삭제 admin API (AGM-12/13) |
| `862c736d` | feat(agent-memory): 메모리 가시화/삭제 화면 (NAV-AM-01~06) |
| `7d7c20d6` | fix(plan): agent-memory-admin-ui frontmatter started/owner 추가 |
| `737f1a85` | fix: origin/main 선존 테스트 red 2건 해소 (본 기능 무관) |

---

## 발견사항

### INFO: 핵심 기능 변경 범위 — 적합

본 기능(메모리 가시화/삭제)과 직결된 변경 목록이 모두 해당 범위에 부합한다.

- **backend**: `AgentMemoryController` 신규(170줄), `AgentMemoryService` 에 `listScopes`/`listMemories`/`deleteMemory`/`clearScope` 메서드 추가(181줄), 3개 DTO 신규, `AgentMemoryModule` 에 controller 등록.
- **frontend**: `agent-memory/page.tsx` 신규(412줄), `lib/api/agent-memories.ts` 신규(71줄), `sidebar.tsx` 에 `agentMemory` 항목 1줄 추가, i18n dict(en/ko) 신규 파일, `dict/*/index.ts` import 2줄.
- **spec**: `spec/2-navigation/16-agent-memory.md` 신규, `spec/5-system/17-agent-memory.md` §6 추가 + §7 로드맵 갱신, `_product-overview.md` 양쪽 메뉴 맵·요구사항 등재.
- **plan**: `plan/in-progress/agent-memory-admin-ui.md` 신규 + frontmatter 보강.

불필요한 리팩토링, 포맷팅 노이즈, 무관 파일 수정 없음.

---

### WARNING: `737f1a85` — 본 기능 무관 fixes 를 같은 PR에 포함

- **위치**: `737f1a85` 커밋 3개 파일
  - `codebase/frontend/src/lib/i18n/backend-labels.ts` (Embedding Model KO 매핑 추가)
  - `spec/2-navigation/5-knowledge-base.md` (앵커 `#2161-rerankconfig-planned` → `#2161-rerankconfig`)
  - `spec/5-system/7-llm-client.md` (동일 앵커 수정)

- **상세**:
  `backend-labels.ts` 의 'Embedding Model' KO 매핑 누락은 AI Agent 노드의 임베딩 모델 필드를 추가한 #467(origin/main 선존)의 잔여 결함이다. spec 앵커 2건은 rerank PR(#460/#465, origin/main 선존)이 생성한 깨진 링크다. 세 건 모두 `9f30216f` 베이스라인에 이미 존재하던 실패이며 본 브랜치가 도입한 것이 아님을 git log 로 확인했다.

  커밋 메시지에 "origin/main 선존"임을 명시하고 별도 커밋으로 격리한 것은 의도적 선택이다.

- **제안**:
  이상적으로는 해당 수정들을 독립 hotfix PR로 분리해 원인 PR(#467/#465)에 귀속시키는 것이 추적성 측면에서 낫다. 그러나 CI green 게이트를 확보해야 본 PR을 머지할 수 있는 구조에서, 이미 "본 기능 무관" 커밋을 명시·격리한 방식은 허용 가능한 실용적 처리다. 분리 비용(별도 PR, cherry-pick) 대비 이득이 적다고 판단되는 경우 BLOCK 사유로 볼 필요는 없다. 단, 원인 PR 작성자에게 해당 수정이 완료됐음을 별도 코멘트로 통보하는 것이 권장된다.

---

### INFO: `backend-labels.ts` 변경 내용 — 본 기능 연관성 없음 확인

- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts` L103, L227-229
- **상세**: 추가된 'Embedding Model' label/hint는 AI Agent 노드의 임베딩 모델 설정 필드에 해당하는 것으로, 본 PR의 메모리 가시화 화면(`/agent-memory` 페이지)과 코드상 연결이 없다. 그러나 `AgentMemoryService` 가 embedding model 설정을 쓰는 문맥(§3 추출 파이프라인)을 고려하면, 같은 모듈 영역이라는 주장은 가능하다. 이 경우에도 소비 경로는 별도 노드 설정 UI이므로 본 화면 범위 밖이다.

---

### INFO: spec 변경 범위 — 적합

- `spec/5-system/17-agent-memory.md`: 기존 §6이 "v2 로드맵"이었고 이를 §7로 밀고 신규 §6(메모리 관리 API)을 삽입한 것은 본 기능 구현의 spec-first 의무(SDD)에 따른 정당한 변경이다.
- `spec/2-navigation/_product-overview.md`: 메뉴 맵·요구사항 테이블 추가는 신규 화면 등록의 표준 절차다.
- `spec/5-system/_product-overview.md`: AGM-12/13 요구사항 2줄 추가는 동일 이유로 적합하다.

---

### INFO: 불필요한 리팩토링·포맷팅·임포트 정리 — 없음

전체 diff에서 기존 코드에 대한 포맷팅 변경, 의미 없는 공백 조정, 무관 임포트 정리가 발견되지 않았다. `sidebar.tsx` 에 `BrainCircuit` 임포트 추가는 신규 nav 항목 아이콘 전용이다.

---

## 요약

전체 변경의 약 97%(1,550줄 중 ~1,520줄)는 메모리 가시화/삭제 기능(spec 정의 → backend API → frontend 페이지 → i18n)에 직결된다. 별도 커밋 `737f1a85`(5줄, 3개 파일)만 본 기능과 무관한 origin/main 선존 결함 수정이며, 커밋 메시지에 명시적으로 분리·고지되어 있다. 불필요한 리팩토링, 포맷팅 노이즈, 기능 확장은 없다. `737f1a85` 의 분리 PR 처리가 이상적이나, 이미 격리 커밋으로 명시된 점 및 CI 게이트 확보 필요성을 감안하면 BLOCK 사유에 해당하지 않는다.

## 위험도

LOW

## BLOCK: NO
