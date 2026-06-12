# 정식 규약 준수 검토 — spec-draft-cch-nf-03-rate-limit.md

대상: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### **[WARNING]** `worktree` frontmatter 값이 실제 worktree 디렉토리 이름과 불일치
- **target 위치**: 파일 상단 frontmatter `worktree: chat-channel-rate-limit`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree` 필드는 "이 plan 이 살아있는 worktree 디렉토리 이름"이며, `worktree-policy.md` 와 일관되게 `<task>-<slug>` 형식 사용
- **상세**: 실제 worktree 디렉토리는 `.claude/worktrees/chat-channel-rate-limit-baa15a` 이므로 `worktree` 값은 `chat-channel-rate-limit-baa15a` 여야 한다. 현재 값 `chat-channel-rate-limit` 은 slug(`baa15a`) 가 누락된 truncated 형식이다. `plan_coherence` checker 가 이 값으로 worktree 를 매칭하므로 값 불일치는 "충돌 탐지 실패" 또는 "dead worktree 오인" 을 유발할 수 있다.
- **제안**: `worktree: chat-channel-rate-limit-baa15a` 로 교정.

### **[INFO]** 문서 구조가 3섹션(Overview / 본문 / Rationale) 권장 패턴에서 약간 이탈
- **target 위치**: 문서 전체 섹션 구성 — `## 결정 (v1 정책)`, `## "큐 적재 → 재발사" 미채택 이유 (Rationale 본문화)`, `## 변경 surface`, `## plan 정합`, `## Rationale (본 draft 결정 근거)`
- **위반 규약**: CLAUDE.md "정보 저장 위치" 항목 — spec 문서의 "결정의 배경·근거"는 해당 spec 문서 끝의 `## Rationale` 절. 또한 일반적 3섹션 권장(Overview / 본문 / Rationale)
- **상세**: `Rationale` 섹션이 두 곳에 분산됨 — `## "큐 적재 → 재발사" 미채택 이유 (Rationale 본문화)` 와 `## Rationale (본 draft 결정 근거)`. plan draft 문서에서 두 관점(기각 이유 본문화 vs 결정 근거 요약)을 별도 섹션으로 가진 것은 목적상 이해 가능하나, 일관성 측면에서 하나의 `## Rationale` 절로 통합하거나 "Rationale 본문화" 섹션을 본문 내 서브섹션으로 흡수하는 것이 규약 정신에 더 부합한다. plan draft 문서의 역할 특성상 치명적이지 않음.
- **제안**: `## "큐 적재 → 재발사" 미채택 이유 (Rationale 본문화)` 를 `## Rationale` 아래의 서브섹션으로 통합하거나, 이 단독 섹션의 내용을 `## 결정` 본문 안으로 흡수하고 마지막 `## Rationale` 하나로 정리.

### **[INFO]** `{ executionId: 'ignored' }` 응답 페이로드가 기존 API 응답 봉투 형식을 따르는지 명시 없음
- **target 위치**: `## 결정 (v1 정책)` — "초과 시 동작" 항목 및 `## 변경 surface §2. §5.5 inbound 계약 표 (신규 행)`
- **위반 규약**: `spec/conventions/swagger.md` 및 `spec/5-system/2-api-convention.md §5.3` — API 에러 응답은 표준 봉투 형식을 따름
- **상세**: 정상 처리 생략 응답으로 `202 Accepted` + `{ executionId: 'ignored' }` 를 명시했는데, 이 응답이 API 응답 봉투 형식의 일부인지 아니면 raw body 인지 draft 에서 명확하지 않다. inbound webhook 특성상 봉투 형식이 적용 안 될 수 있으나, §5.5 inbound 계약 표에 기존 행의 응답 형식과 일관성을 갖추는지 근거가 없다. 위반이 아닌 불명확으로 분류하며, spec 반영 시 inbound 계약 표의 다른 행과 응답 형식을 맞추는지 명시 권장.
- **제안**: `## 변경 surface §2` 에서 `§5.5` 기존 행의 응답 body 형식과 `{ executionId: 'ignored' }` 형식이 동일 패턴임을 명시(또는 기존 spec 행 참조 추가).

---

## 요약

대상 plan draft 문서(`spec-draft-cch-nf-03-rate-limit.md`)는 정식 규약의 핵심 위반 없이 작성됐다. frontmatter 에 `worktree`·`started`·`owner` 세 필수 필드가 모두 존재하고(`plan-lifecycle.md §4` / `plan-frontmatter.test.ts` 통과 조건 충족), 문서 목적(spec draft 결정·변경 surface 기술·Rationale)에 맞는 내용이 포함돼 있다. 단, `worktree` 값이 실제 디렉토리 이름(`chat-channel-rate-limit-baa15a`)에서 slug 를 뺀 `chat-channel-rate-limit` 로 기재돼 있어, `plan_coherence` worktree 매칭 오류를 유발할 수 있는 WARNING 수준 불일치가 있다. 문서 구조 면에서는 Rationale 관련 섹션이 두 곳으로 분산된 점이 3섹션 권장 패턴에서 약간 이탈하나 plan draft 성격상 INFO 수준이다.

---

## 위험도

LOW
