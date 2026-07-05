# 정식 규약 준수 검토 — convention_compliance

- 검토 대상: `plan/in-progress/spec-draft-ai-context-memory-close.md` (spec draft, `--spec` 모드)
- 대조 규약: `spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`, `spec/conventions/conversation-thread.md` 등 `spec/conventions/**`
- 검토 시각: 2026-07-05

## 발견사항

- **[CRITICAL]** `webchat-widget-refactor.md` 종결 시 `spec_impact: []` 가 Gate C build guard 를 fail 시킨다
  - target 위치: 「변경」 항목 6 — `webchat-widget-refactor.md` — `git mv` → `plan/complete/`(spec 무관, 검증완료)
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §5 Gate C ("흔한 실패형 — 빈 배열 `spec_impact: []` … `length>0` 위반으로 '미선언' 처리돼 fail. spec 무변경이면 `[]` 가 아니라 **`none` 리터럴**") + `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (`hasValidSpecImpact`: 배열이면 `length>0` 필수)
  - 상세: `plan/in-progress/webchat-widget-refactor.md` 의 현재 frontmatter 는 `spec_impact: []  # behavior-preserving 리팩터 — spec 변경 없음` 이다. 이 plan 의 `started: 2026-06-27` 는 Gate C cutoff(`2026-06-04`) **이후**라 grandfather 면제 대상이 아니다 — `isGateCEnforced` 가 `true` 를 반환하고 `spec-plan-completion.test.ts` 가 `plan/complete/` 로 이동한 이 파일을 스캔해 `spec_impact` 판정을 수행한다. 배열이지만 `length === 0` 이므로 `hasValidSpecImpact` 가 `false` → **build fail**. target draft 의 변경 6은 이 파일을 그대로(frontmatter 수정 없이) `git mv` 하는 것만 명시해, 종결 PR 이 CI 를 깨뜨릴 것이다. 이는 plan-lifecycle.md 자체가 "흔한 실패형" 으로 명시 경고한 정확히 그 패턴이며, spec-only PR 은 unit 테스트가 안 돌아 이 회귀가 그 PR 에서 안 잡히고 main 에 샐 위험까지 문서가 지적한 그대로다.
  - 제안: target 변경 6에 `webchat-widget-refactor.md` frontmatter `spec_impact: []` → `spec_impact: none` 수정을 명시적 하위 단계로 추가한다. (동봉 PR 이므로 `git mv` 직전/직후 이 1줄 수정을 같이 커밋해야 한다.) 종결 후 최소 `pnpm --filter frontend test -- spec-plan-completion` 확인을 체크리스트에 추가하는 것도 plan-lifecycle.md §5 의 권고와 일치한다.

- **[INFO]** `ai-context-memory-followup-v2.md` 종결 시 `spec_impact` 필드 부재 — grandfather 대상이라 의무는 아니나 누락 상태로 남는다
  - target 위치: 「변경」 항목 1 — `ai-context-memory-followup-v2.md` 잔여 체크박스 처리 + `git mv` → `plan/complete/`
  - 위반 규약: 직접 위반 아님. `.claude/docs/plan-lifecycle.md` §5 Gate C — 이 plan 은 `started: 2026-06-03` (cutoff `2026-06-04` 이전)이라 grandfather 면제 대상이며 build guard 도 이 plan 은 `isGateCEnforced` = false 로 건드리지 않는다.
  - 상세: 강제 대상은 아니지만, 본 종결 PR 이 이미 4개 spec frontmatter 의 `pending_plans` 를 정리하는 "정합 결정을 명시화" 하는 작업이라는 점에서, 같은 PR 에서 `spec_impact` 를 함께 채워두면(변경 2·3·4·5 가 건드리는 4개 spec 경로를 그대로 나열) Gate C 의 취지("정합 결정을 암묵에 두지 않는다")와 더 정합적이다.
  - 제안: 강제 아님 — 원한다면 변경 1에 `spec_impact:` 필드 신설(4개 spec 경로 리스트)을 선택적으로 추가. 규약 갱신 불요, target 의 사소한 개선 여지로만 남긴다.

- **[INFO]** 내부 rationale 의 "3-execution §6 breakpoint 로드맵" 선례 인용이 파일 식별을 생략해 모호하다
  - target 위치: 「status 승격 근거」 단락 — "**[3-execution §6 breakpoint 로드맵 = frontmatter implemented + 로드맵 표기] 선례**와 동형"
  - 위반 규약: 명명 규약 직접 위반 아님. 다만 `spec/` 트리에 "3-execution" 류 파일이 두 곳 존재한다 — `spec/3-workflow-editor/3-execution.md`(실제 선례, §6 이 명시적으로 "미구현 (로드맵)" 격하) 와 `spec/5-system/4-execution-engine.md`(과거 `3-execution.md` 였을 가능성이 있는 별 파일, 현재 §6 은 "실행 컨텍스트" 절로 무관). 검증 결과 인용 대상은 전자이며 실제로 `status: implemented` + §6 로드맵 격하 패턴이 확인돼 draft 의 논거 자체는 타당하다.
  - 제안: rationale 인용을 `spec/3-workflow-editor/3-execution.md §6` 처럼 전체 경로로 명시하면 향후 재검증 시 모호함이 사라진다. spec draft 는 merge 전 산문이라 강제 사항은 아님.

## 검증 확인 (규약 위반 아님 — 정합성 확인된 항목)

- `spec/conventions/node-output.md:90`(`meta.memory` = `ai_agent` 전용, IE 는 echo 안 함) — 원문과 draft 서술 완전 일치.
- `spec/4-nodes/3-ai/3-information-extractor.md:163`(및 `:694` 부근) — `memoryState.lastExtractionTurnSeq` (I12) + 구 평면 키 폴백 서술 — draft 서술과 완전 일치.
- 4개 spec frontmatter (`0-common.md`/`1-ai-agent.md`/`17-agent-memory.md`/`conversation-thread.md`) 의 현재 `status`/`pending_plans` 값이 draft 의 "현 pending_plans" 표와 정확히 일치.
- `spec/5-system/17-agent-memory.md §7` — "실현됨(v2)" 5건 + "남은 로드맵" 사용자 식별자 연동 1건이라는 draft 서술이 실제 §7 본문과 정확히 일치.
- target draft 자체의 frontmatter(`worktree`/`started`/`owner`/`spec_impact` 리스트 형식)는 `spec-impl-evidence.md` §5 Gate C 규약(리스트, bare string 아님)을 정확히 준수 — 오히려 모범 사례.
- `spec/2-navigation/16-agent-memory.md`(`id: nav-agent-memory`) vs `spec/5-system/17-agent-memory.md`(`id: agent-memory`) — `spec-impl-evidence.md §2.1` 이 예시로 든 basename 충돌 회피 선례가 이미 정확히 적용돼 있고 target 은 이를 건드리지 않는다(무관 확인).
- 명명·출력 포맷·API 문서(OpenAPI/Swagger) 규약 — target 은 DTO/엔드포인트/이벤트 페이로드를 신설하지 않는 순수 frontmatter/plan 정리이므로 해당 관점은 적용 대상 없음(N/A).

## 요약

target spec draft 는 `spec/conventions/spec-impl-evidence.md` 의 `status` 라이프사이클·`pending_plans` 역방향 링크 규약, 그리고 `.claude/docs/plan-lifecycle.md` §5 Gate C 의 `spec_impact` 리스트/`none` 스키마를 draft 자신의 frontmatter 에서는 정확히 준수하고 있으며, 인용한 모든 spec 본문 상태(node-output.md, 3-information-extractor.md, 17-agent-memory.md §7)도 실측과 일치해 사실관계 오류가 없다. 다만 draft 가 동봉하기로 결정한 `webchat-widget-refactor.md` 의 `git mv` 단계는 그 plan 의 기존 `spec_impact: []` 를 그대로 둔 채 진행하도록 서술돼 있어, Gate C build guard(`spec-plan-completion.test.ts`)가 실제로 fail 할 조합이다 — 이는 plan-lifecycle.md 문서 자신이 "흔한 실패형"으로 이미 경고한 패턴을 그대로 재현하는 것이라 CRITICAL 로 분류했다. 그 외 발견은 INFO 수준의 선택적 보강·인용 명확화에 그친다.

## 위험도

MEDIUM
