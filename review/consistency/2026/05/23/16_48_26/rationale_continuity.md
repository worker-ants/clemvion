# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-harness-impl-coverage.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### 1. [INFO] 결정 C-2 (`/spec-coverage`) 의 "CI 차단 아님" 근거 — 기존 Rationale 패턴과 정합하나 명시 부족

- **target 위치**: `## 변경안` → 결정 C — `/spec-coverage` standing audit 항
  > "CI 차단 아님. 주간 수동 호출 또는 사용자 트리거"  
  > "false-positive 가 높을 NLP 휴리스틱 기반. 차단 시 false-block 부담 > 검출 가치"
- **과거 결정 출처**: `spec/conventions/i18n-userguide.md` §Rationale "왜 P2-b 는 hard fail 이 아닌 ratchet 인가"
  > "한 번에 0 화는 비현실적. ratchet 으로 점진적 0 화 가능."  
  그리고 `spec/conventions/i18n-userguide.md` §Rationale "왜 .en.mdx sibling 누락은 위반이 아닌가"
  > "hard fail 시키면 KO 작성 자체가 막혀 작성 동력을 떨어뜨린다. coverage 는 warn-only 로 별도 ratchet 화 가능."
- **상세**: 기존 Rationale 은 "비결정적·회귀 부담이 있으면 hard fail 대신 ratchet(warn-only)" 으로 하는 패턴을 이미 확립해 두었다. `/spec-coverage` 의 "CI 차단 아님" 결정은 이 패턴과 같은 방향이므로 기각된 대안을 재도입하는 것은 아니다. 그러나 기존 ratchet 사례들은 모두 "왜 hard fail 이 아닌가" 를 해당 spec 의 Rationale 에 명시 기술했다. 결정 C-2 는 plan 문서의 "의식적 결정 포인트 (4)" 에서 한 줄 이유를 제시하지만, 신설 예정인 `spec/conventions/spec-impl-evidence.md` 또는 `.claude/skills/spec-coverage/SKILL.md` 에 Rationale 절로 옮겨 두지 않으면 추후 구현 시 근거가 소실된다.
- **제안**: 결정 C-2 구현 plan (`spec-coverage-slash-command.md`) 에서 신설 `SKILL.md` 또는 관련 spec 문서에 "CI 차단 아님" 의 근거 (NLP 휴리스틱 → 비결정적 → false-block 부담 > 검출 가치) 를 `## Rationale` 절로 기재. 기존 i18n-userguide 의 ratchet 패턴을 선례로 명시 인용하면 Rationale 연속성이 확보된다.

---

### 2. [INFO] 결정 A 의 `spec-only` 30일 만료 build fail — 기존 hard fail 패턴과 방향 일치, trade-off 서술 권장

- **target 위치**: 결정 A — `spec-only` status 30일 이상 지속 시 build fail 조항  
  그리고 "의식적 결정 포인트 (2)" — 30일 엄격성 trade-off ("옵션: 90일로 완화 또는 backlog 별 분류 추가")
- **과거 결정 출처**: `spec/conventions/interaction-type-registry.md` §4 Rationale, `spec/conventions/data-hydration-surfaces.md` §4 Rationale, `PROJECT.md §자동 가드 (build-time 차단)`
  > 기존 가드들은 모두 **결정적(deterministic) 구조 갭** (enum 값 vs 처리 분기 매트릭스, code glob 파일 실존 여부) 을 hard fail 로 잡는다. `spec-only` 30일 만료는 **시간 기반 제약** 으로 같은 hard fail 카테고리를 사용하는 새로운 패턴이다.
- **상세**: 기각된 대안을 다시 도입한 것은 아니다. 다만 기존 hard fail 가드들은 모두 "구조적 불일치(deterministic mismatch)" 를 잡는다는 공통 특성이 있고, "시간 경과 자동 fail" 은 새 패턴이다. plan 의 의식적 결정 포인트 (2) 가 이 trade-off 를 인식하고 있으나, 신설 spec `spec/conventions/spec-impl-evidence.md` 의 `## Rationale` 에 (a) 왜 30일인가, (b) 90일/backlog 분류를 기각한 이유를 명시하지 않으면 향후 rollout plan (`spec-frontmatter-rollout.md`) 에서 다시 열릴 수 있다.
- **제안**: 신설 `spec/conventions/spec-impl-evidence.md` 의 `## Rationale` 절에 `spec-only` TTL 30일 채택·대안 기각 근거를 작성. plan 의 "의식적 결정 포인트 (2)" 내용을 해당 spec 으로 이전하고 plan 에서는 참조만 유지.

---

### 3. [INFO] 결정 B (`<ImplAnchor>`) — `spec/conventions/i18n-userguide.md` 의 MDX frontmatter `spec:`/`code:` 경로 검증 패턴과의 관계 명시 필요

- **target 위치**: 결정 B — `<ImplAnchor>` 컴포넌트 + `impl-anchor-existence.test.ts`  
  > "모든 `<ImplAnchor>` 의 `file` 실존 + `symbol` 이 file 안 grep ≥1 매치"
- **과거 결정 출처**: `PROJECT.md §자동 가드` — `registry.test.ts`
  > "MDX frontmatter 의 `spec:`/`code:` 경로 실존 검증. frontmatter `spec:` / `code:` 경로 stale — registry.test.ts 가 hard fail 가드"
- **상세**: 기존 `registry.test.ts` 는 MDX 파일 frontmatter 의 `spec:` / `code:` glob 실존을 검증한다. 결정 B 의 `impl-anchor-existence.test.ts` 는 MDX 본문 내 JSX 컴포넌트 인자 `file`/`symbol` 실존을 검증한다. 두 가드가 서로 보완적 관계인데, target 이 이 관계를 명시하지 않아 rollout 시 어느 가드가 어느 갭을 커버하는지 혼동 가능성이 있다. 기각된 대안 재도입이나 합의 원칙 위반은 아니지만, 신규 가드를 기존 가드의 연장으로 명확히 위치시키지 않으면 향후 `registry.test.ts` 확장 vs `impl-anchor-existence.test.ts` 범위가 중복될 수 있다.
- **제안**: 신설 `spec/conventions/user-guide-evidence.md` 의 `## Rationale` 에 "기존 `registry.test.ts` 는 MDX frontmatter 경로를 검증하고, 본 가드는 MDX 본문 JSX 참조를 검증 — 역할 분리" 를 명시. `PROJECT.md §자동 가드` 에 `impl-anchor-existence.test.ts` 추가 시 같은 절에 두 가드의 역할 분리를 주석으로 병기.

---

### 4. [INFO] 결정 E (PROJECT.md 매트릭스 갱신) 의 `status: partial` 시 `pending_plans:` 의무화 — 기존 plan-lifecycle 설계 원칙과의 정합 확인 필요

- **target 위치**: 결정 E — PROJECT.md 매트릭스 신규 row "spec 신규/대규모 변경"  
  > "`status: partial` 이면 `pending_plans:` 의 plan 신설"
- **과거 결정 출처**: `.claude/docs/plan-lifecycle.md` (plan 이동은 "모든 체크박스 완료 + 미해결 follow-up 0건" 이 되는 PR 안에서만 이동, plan 이동만 별 PR 금지)
- **상세**: 기존 plan-lifecycle 은 plan 파일의 **이동(complete 로 이동)** 기준을 정의하고, plan 의 생성 트리거는 개발자 판단에 맡긴다. 결정 A 의 `partial` status 가 `pending_plans:` 를 의무화하면 "spec 파일에 `partial` 을 기록하는 순간 plan/in-progress/ 파일이 반드시 존재해야 한다" 는 새 인과관계가 생긴다. 이것이 plan-lifecycle 의 기존 흐름(plan 은 개발자가 착수 시 생성)과 충돌하지 않는지 확인이 필요하다. 방향 충돌은 아니나 spec 파일이 plan 생성을 강제하는 역방향 의무가 새로 생기는 점은 Rationale 에 기록되지 않았다.
- **제안**: `.claude/docs/plan-lifecycle.md` 의 `§audit` 추가 절 또는 신설 `spec/conventions/spec-impl-evidence.md` 의 `## Rationale` 에 "`partial` status 가 plan 생성을 역방향으로 강제하는 이유 — spec 약속과 구현 사이 갭이 추적 불가 상태로 방치되는 것을 차단" 를 명시.

---

## 요약

검토 대상 plan 은 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목을 포함하지 않는다. 결정 C-2 의 "CI 차단 아님" 정책은 기존 i18n-userguide 의 ratchet(warn-only) 패턴과 같은 방향이고, 결정 A 의 hard fail 가드들은 기존 interaction-type-registry 및 hydration-surfaces 의 build-time 차단 패턴과 일관된다. 다만 신설 예정인 `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/user-guide-evidence.md` 의 `## Rationale` 절에 각 결정의 "왜 이 방식인가, 무엇을 기각했는가" 가 아직 plan 단계에서만 존재하고 spec 문서로 이전되지 않은 상태다. 향후 구현 plan 5건이 착수될 때 결정 근거가 plan 에만 남아 있으면 spec 은 Rationale 없는 규약 덩어리가 되어 기존 프로젝트 규약("결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`")을 위반하게 된다. 모든 발견사항은 이 Rationale 이전 작업을 각 구현 plan 에서 명시적으로 체크박스로 포함하도록 하는 것으로 해소 가능하다.

## 위험도

LOW
