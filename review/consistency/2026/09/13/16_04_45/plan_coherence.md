# Plan 정합성 검토

## 검토 범위 재확인

- target scope `spec/conventions/**` 은 실측(`git diff origin/main -- spec/conventions`) **델타 0** — 이 브랜치는 spec 문서를 바꾸지 않았다.
- 실 diff(`git diff --stat origin/main`): `codebase/frontend/src/lib/docs/__tests__/{guide-error-code-existence.test.ts→guide-identifier-existence.test.ts, guide-error-code-scan.ts→guide-identifier-scan.ts, guide-sanitized-message-parity.test.ts}` + `PROJECT.md` 1줄 + `CHANGELOG.md` — harness 가드 리네임/확장이며 `spec/**` 은 무변경.
- plan 변경분: `plan/in-progress/guide-identifier-existence.md`(신규, 이 작업 자신의 plan) + `plan/in-progress/spec-draft-nullable-notation-followups.md`(백로그 갱신).
- 직전 라운드(`review/consistency/2026/09/13/15_43_24/plan_coherence.md`, 위험도 NONE) 이후 `6b4c03af6`(라운드 4 후속 fix) 커밋이 있었으나 `spec/`·`plan/` 은 건드리지 않았다(`guide-identifier-{existence.test.ts,scan.ts}` 코드만 수정) — 아래 재확인은 그 사실을 전제로 독립 재검증한 결과다.

## 점검 관점별 확인

### 1. 미해결 결정과의 충돌
target(`spec/conventions/**`)이 바뀌지 않았으므로 plan 의 "결정 필요" 항목을 target 이 일방적으로 override 하는 지점은 없다. `guide-identifier-existence.md` §C 는 `#1330`(선행 완료 plan, `plan/complete/guide-error-code-truth.md`)이 세운 "허용목록 없음" 원칙을 실측(과거 결함 `MCP_INSECURE_URL_ALLOWED` 미포착)으로 번복한다고 선언하지만, 그 번복의 **spec Rationale 반영은 코드 주석·plan 에만 있고 spec 문서에는 아직 없다**는 사실을 developer 스스로 `--impl-prep` WARNING#2 로 짚었고, `spec-draft-nullable-notation-followups.md:3535-3567`(원 트래커 항목, 2026-09-12 등재분에 취소선+반증 근거로 갱신)에 정확히 등재돼 있다. `spec/**` 은 developer 권한 밖이라 미리 손대지 않고 planner 로 넘긴 것은 규약대로다 — 충돌 아님.

### 2. 선행 plan 미해소
- `spec/conventions/user-guide-evidence.md` 를 절대경로로 직접 읽어 확인: §2 "Build-time 가드 (3건)" 표·§2.1 관계표·frontmatter `code:` 목록(6경로) 모두 신규 가드 2건(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)과 관련 스캐너(`guide-identifier-scan.ts`)를 아직 반영하지 않고 있다. 이 gap 은 target 이 새로 만든 것이 아니라 `#1330`(선행 완료 PR) 때부터 있던 미등재이고, 이번 리네임이 그 gap 을 **좁히기는커녕 문구 기준을 바꾼다**는 것을 plan 이 자인·등재했다(§D 지적#1). 등재처(`spec-draft-nullable-notation-followups.md:3252-3269`)의 서술도 새 파일명·새 Rationale 요구사항 기준으로 갱신돼 있어 stale 하지 않다. **선행 조건 미해소는 사실이나 방치가 아니라 정상 추적 중** — WARNING 아님.
- `spec/conventions/cafe24-api-metadata.md:441` 의 "CONVENTIONS Principle 7 의 노드 출력 envelope" 오인용도 grep 으로 재확인됨(여전히 "Principle 7" 로 남아 있고 `status` 필드도 목록에서 빠짐). `plan/in-progress/node-output-redesign/cafe24.md:56,186` 을 교차 확인한 결과 "Principle 7" 은 실제로 **config echo**(raw echo)를 가리키는 표현으로 독립 문서에서도 일관되게 쓰이고 있어, cafe24-api-metadata.md 의 인용이 "노드 출력 envelope"(Principle 0 소유)을 가리킨 것은 확실히 오인용이다 — plan(§D#4)의 판단이 맞다. 이 선재 결함은 `spec-draft-nullable-notation-followups.md:3401-3411` 에 "이 작업과 무관한 선재 결함"으로 정확히 신규 등재돼 있고, 다른 in-progress plan(node-output-redesign/cafe24.md)과 중복 등재되지도 않았다.
- 원 트래커 항목(`spec-draft-nullable-notation-followups.md:3535`, "가이드가 적는 식별자... 가드가 없다")을 직접 확인: 체크박스 `[x]`, 처분 제안에 `~~...~~` 취소선 + 반증 근거, `#1331`(리네임 전 `guide-error-code-existence`, 현 `guide-identifier-existence`)로의 해소 기록이 실재 — plan 서술과 정확히 일치.

### 3. 후속 항목 누락
- 리네임된 구 파일명(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`)을 아직 참조하는 다른 **비-역사성** plan/in-progress·코드 문서가 있는지 전수 grep — 남은 참조는 전부 `plan/complete/guide-error-code-truth.md`(완료 이력)·`CHANGELOG.md`·과거 `review/**` 산출물(역사 기록)·현재 코드의 주석형 back-reference(`guide-sanitized-message-parity.test.ts:16`, `guide-identifier-scan.ts:9` — 둘 다 "`#1330` 당시 이름" 형태로 역사 보존)뿐이다. 다른 in-progress plan 이 구 이름에 의존해 깨지는 사례는 0건.
- `PROJECT.md` 가드 카탈로그 행이 새 이름·새 설계(외부 어휘 허용목록 4강제)로 갱신됨을 diff 로 확인.
- `guide-identifier-existence.md` §D 표의 4개 지적사항이 모두 체크리스트에 반영되고, 그중 3건(등재 갱신·frontmatter `spec_impact` 수정·신규 planner 항목)이 실제로 처리·등재된 상태를 재확인했다. 남은 1건(SoT `user-guide-evidence.md` 자체 갱신)은 developer 권한 밖이라 등재만 하는 것이 규약에 맞다.
- 직전 라운드 이후 코드 fix(`6b4c03af6`, 정규식 좌측 경계 보강)는 `spec/`·`plan/` 무변경이므로 이 세 관점에 새로 영향을 주는 변화가 없다.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다. 직전 라운드(`15_43_24`)의 결론과 동일하며, 이번 라운드는 그 사이 코드 fix 가 spec/plan 에 영향을 주지 않았음을 재확인한 것이다.

- **[INFO]** `user-guide-evidence.md` §2/§2.1/frontmatter gap 은 이 PR 이후에도 여전히 열려 있다 (직전 라운드와 동일 관측, 반복 기록)
  - target 위치: `spec/conventions/user-guide-evidence.md` §2 표, §2.1, frontmatter `code:`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3252-3269`(planner, 2026-09-13 갱신, 새 파일명 반영됨)
  - 상세: 신규 가드 2건(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)과 관련 스캐너(`guide-identifier-scan.ts`)가 SoT 표·frontmatter 에 아직 없다. developer 권한 밖이라 이 PR 이 고치지 않은 것은 정책대로다.
  - 제안: 이 항목을 처리할 다음 planner 턴에서 "허용목록 없음→외부 어휘 허용목록(`GUIDE_EXTERNAL_VOCABULARY`)" 원칙 번복의 Rationale 승격과 **함께** 한 번에 반영할 것 — 등재 문구가 이미 그렇게 지시하고 있어 별도 조치 불필요, 향후 세션 참고용 재확인.

## 요약
이번 검토 대상(`spec/conventions/**`)은 실제로 변경되지 않았고, 실 구현 diff(harness 가드 리네임·확장 6파일 + 라운드 4 정규식 경계 보강)는 spec 문서가 아직 반영하지 못한 두 개의 선행 gap(`user-guide-evidence.md §2` SoT 미등재, `cafe24-api-metadata.md §4` Principle 오인용)을 새로 만들거나 방치하지 않는다 — 둘 다 developer 권한 밖으로 정확히 판별돼 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 최신 파일명·근거와 함께 이미 등재돼 있고(각각 planner 트랙 항목으로 존재, 중복 등재 없음), 원 트래커 항목도 취소선+반증 근거로 올바르게 종결돼 있다. `node-output-redesign/cafe24.md` 를 교차 확인해 Principle 7/0 오인용 판단의 근거도 재확인했다. plan 자기 서술(체크리스트)과 실제 저장소 상태(spec 파일 내용, git diff, grep) 사이에 불일치는 발견되지 않았으며, 직전 라운드(`15_43_24`) 이후의 코드 전용 fix 커밋도 이 결론에 영향을 주지 않는다.

## 위험도
NONE
