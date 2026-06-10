# 정식 규약 준수 검토 — `plan/in-progress/db-pool-creds-pubsub.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] 문서 제목 prefix 형식이 spec 규약 표준에서 벗어남
- **target 위치**: 1번째 줄 heading `# 04 m-4 — DB Pool credential rotation 멀티 인스턴스 무효화 (Redis pub/sub)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` 및 `.claude/docs/plan-lifecycle.md §4` — plan 문서 제목 naming 규칙 명시 없음 (비강제). 단, `plan-lifecycle.md §4` 는 frontmatter 스키마만 의무화하며 제목 형식은 관행 참조 수준.
- **상세**: "04 m-4" prefix 는 상위 refactor 클러스터 문서(`plan/in-progress/refactor/04-security.md`) 의 항목 번호를 그대로 가져온 것으로 추측됨. plan 최상위 독립 파일로 분리된 시점에는 번호 체계가 외부 문서에 의존하는 형태라 가독성은 떨어지지만, 규약에서 명시적으로 금지한 패턴은 아님.
- **제안**: 제목에서 "04 m-4" 를 제거하거나 의미 있는 약어로 대체(예: `# DB Pool credential rotation — Redis pub/sub 멀티 인스턴스 무효화`). 기술적 규약 위반은 없으므로 필수 아님.

---

### [INFO] Spec 체크리스트 항목에 참조된 `2-database-query.md` 경로가 불완전
- **target 위치**: 체크리스트 "Spec (planner)" 섹션, `- [ ] '2-database-query.md' §4 step 2 ...`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2 spec-link-integrity.test.ts` — spec 문서 내 in-repo 링크는 타깃 실존이 강제됨. plan 문서의 링크는 `spec-link-integrity.test.ts` 가드 적용 대상이 아니라고 명시(`plan/ 링크 = plan-coherence 담당`)이지만, plan 내에서 backtick 내 경로 참조를 정확히 작성하는 것이 관행.
- **상세**: `2-database-query.md` 는 부분 경로로 실제 파일이 `spec/4-nodes/4-integration/2-database-query.md` 또는 유사 경로에 있어야 함. 단순 메모 수준 참조라 실질 위반은 아님.
- **제안**: backtick 참조를 `spec/4-nodes/4-integration/2-database-query.md` 와 같이 레포 루트 기준 상대 경로로 명시하면 검증 가능성이 높아짐.

---

### [WARNING] 완료 시점에 필요한 `spec_impact` 준비 안내 부재 (Gate C 대비)
- **target 위치**: 문서 전체 frontmatter 및 체크리스트
- **위반 규약**: `.claude/docs/plan-lifecycle.md §5 Gate C` 및 `spec/conventions/spec-impl-evidence.md §4.2` — `started: 2026-06-11` (≥ grandfather cutoff `2026-06-04`)인 plan 은 완료(`complete/` 이동) 시 frontmatter 에 `spec_impact` 선언 필수.
- **상세**: 현재 frontmatter 는 `worktree`/`started`/`owner` 3필드만 포함함. `spec_impact` 는 in-progress 단계에서는 의무가 아니지만, 체크리스트에 완료 이동 단계(spec 반영 완료 후)에서 `spec_impact` 를 추가해야 한다는 안내가 없어 완료 커밋 시 누락되기 쉬움. build guard `spec-plan-completion.test.ts` 가 완료 시점에 강제하므로 현 상태에서 가드 위반은 발생하지 않으나, 완료 전환 체크리스트 항목 부재가 Gate C 누락을 유발하는 운영 갭.
- **제안**: 체크리스트(또는 별도 이동 점검 섹션)에 `- [ ] 완료 이동 시 frontmatter 에 spec_impact 선언 (plan-lifecycle §5 Gate C)` 항목 추가 권장. 규약 갱신이 아닌 plan 문서 보강으로 충분.

---

### [INFO] 설계 섹션의 코드 식별자 명명이 API/spec 규약과 직접 관련 없음 (확인 사항)
- **target 위치**: `## 설계` 섹션 전반 (`IntegrationCacheBus`, `integration:cache:invalidate` 채널명 등)
- **위반 규약**: `spec/conventions/` 내 채널명·버스 클래스 명명 규약 파일 없음 (해당 규약 미존재).
- **상세**: `IntegrationCacheBus`, 채널 `integration:cache:invalidate`, payload `integrationId` 평문 문자열 등 식별자 명명이 현행 spec/conventions 파일 중 명명 규약으로 다루는 파일이 없어 위반 여부 판단 불가. 명명 자체는 기존 코드베이스 camelCase/kebab-case 일관성 범위 내로 보임.
- **제안**: 신규 버스 컴포넌트의 명명은 구현 단계 `/ai-review` 에서 코드 관행 일관성 검토로 커버 — spec 규약 수준 이슈 없음.

---

## 요약

`plan/in-progress/db-pool-creds-pubsub.md` 는 plan-lifecycle.md 에서 요구하는 3-필드 frontmatter(`worktree`/`started`/`owner`)를 모두 충족하고, 문서 구조도 현황·설계·체크리스트·Rationale 의 4섹션으로 구성되어 읽기 좋게 정리됨. 정식 규약의 명시적 위반 사항은 없다. 다만 `started: 2026-06-11` 이 grandfather cutoff 이후라 완료 이동 시 Gate C(`spec_impact`) 선언이 build 가드에 의해 강제되므로, 체크리스트에 해당 항목이 미리 포함되어 있지 않은 점이 운영 리스크(WARNING)이다. 나머지 두 건은 사소한 형식 개선 제안(INFO) 수준이다.

---

## 위험도

LOW
