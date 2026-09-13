# Cross-Spec 일관성 검토 — guide-identifier-existence (--impl-done)

## 전제 확인

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- **scope 내 spec 델타는 0개 파일** — 이 브랜치는 `spec/conventions/**` 를 고치지 않았다 (`plan/in-progress/guide-identifier-existence.md` frontmatter `spec_impact: none`). 이는 전제 무효가 아니라 순수 코드/harness PR 의 정상 상태다.
- 실제 변경은 `codebase/frontend/src/lib/docs/__tests__/` 5개 파일(930줄, HEAD 워킹트리에서 직접 실측·확인) — `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 를 삭제하고 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 로 재작성(스코프를 에러 코드→식별자 전반으로 확장, 3번째 판정 축을 문맥-게이팅 산문에서 백틱 전수로 교체, `GUIDE_EXTERNAL_VOCABULARY` 허용목록 도입) + `guide-sanitized-message-parity.test.ts` 의 자매 참조 갱신.
- 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 은 이 diff 의 영향 범위 밖이다(순수 frontend build-time 테스트/스캐너 코드). 아래는 남은 관점인 **문서 SoT 정합성(계층 책임/등재 충돌에 준하는 영역)** 위주로 확인한 결과다.

## 발견사항

- **[WARNING]** `PROJECT.md`/`CHANGELOG.md` 가 가리키는 SoT(`spec/conventions/user-guide-evidence.md §2`)에 신규 가드가 아직 미등재
  - target 위치: `PROJECT.md:300`("SoT: `spec/conventions/user-guide-evidence.md §2`"), `CHANGELOG.md` 신규 항목(`guide-identifier-existence`)
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)" 표) · 동 문서 frontmatter `code:` 목록(7경로) · §2.1 관계표
  - 상세: `PROJECT.md`/`CHANGELOG.md` 는 이번 diff 가 만든 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 를 `user-guide-evidence.md §2` 가 SoT 라고 명시한다. 그러나 실제로 그 절은 여전히 "가드 3건"(`impl-anchor-existence.test.ts` · `integrations-coverage.test.ts` · `triggers-coverage.test.ts`)만 표로 세고, §2.1 관계표에도 새 가드의 행이 없으며, frontmatter `code:` 7개 경로 목록에도 `guide-identifier-scan.ts` · `guide-identifier-existence.test.ts` · `guide-sanitized-message-parity.test.ts` 3개가 빠져 있다. 즉 harness 문서(`PROJECT.md`)가 가리키는 SoT 가 그 내용을 아직 담고 있지 않은 상태다.
  - 이 diff 가 새로 만든 결함은 아니다 — 선행 `#1330`(guide-error-code-existence 도입) 시점부터 이미 있던 gap 이고, 이번 리네임·축 확장이 gap 을 넓히지도 좁히지도 않았다(등재 안 된 파일 수는 3→3 로 동일, 이름만 바뀜). `spec/**` 쓰기는 developer 권한 밖이라 이 PR 은 고칠 수 없고, 실제로 `plan/in-progress/guide-identifier-existence.md` §D #1·#2 와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 명시 등재돼 있다(등재 문구·frontmatter·Rationale 요구 셋을 한 턴에 반영하라는 지시 포함). 즉 절차적으로는 올바르게 처리됐고, 남은 것은 다음 planner 턴의 집행뿐이다.
  - 제안: 별도 조치 불필요(이미 추적됨) — 다음 `project-planner` 턴에서 `user-guide-evidence.md` §2 표(3건→5건) · §2.1 관계표 · frontmatter `code:` 목록(3파일 추가) · `## Rationale`("허용목록 없음" 원칙을 `#1331` 이 실측으로 번복한 근거)을 한 번에 갱신할 것. 그때까지는 `PROJECT.md`/`CHANGELOG.md` 의 "SoT: user-guide-evidence.md §2" 문구가 일시적으로 앞서가는 상태임을 인지.

- **[INFO]** 스코프 내 무관 선재 결함 — `cafe24-api-metadata.md §4` envelope 인용 오류
  - target 위치: 없음(이번 diff 가 건드리지 않음)
  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md §4`("용어 주의" 박스) vs `spec/conventions/node-output.md`(envelope 5필드 정의 SoT)
  - 상세: §4 가 노드 출력 envelope 정의처를 "Principle 7" 로 인용하나 실제 정의는 `node-output.md` 의 **Principle 0** 소유(Principle 7 은 config echo 전용)이고 인용 필드 목록에 `status` 도 빠져 있다. `git log -S` 확인 결과 2026-05-16 작성 시점부터의 오인용이며 이번 PR 과 무관하다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재돼 있다(이번 diff 의 `--impl-prep` 검토가 발견·등재). 추가 조치 불요, 다음 planner 턴에서 함께 처리.

## 확인 후 이상 없음 (참고)

- `codebase/frontend/src/lib/docs/__tests__/` 아래 위치는 `spec/conventions/frontend-layering.md` §서두("`src/test/**` · `src/__tests__/**` 는 의존 축 밖")에 의해 layering 규약 대상에서 명시적으로 제외된다 — 이 diff 가 `codebase/backend/src`/`codebase/packages` 소스를 텍스트로 읽는 것은 계층 책임 충돌이 아니다.
- `spec/conventions/error-codes.md §3` historical-artifact 예외 레지스트리의 `lower_snake_case`/`PascalCase` 코드(`invitation_not_found`, `AbortError` 등)는 신규 `UPPER_SNAKE` 정규식(밑줄 필수)에 애초에 매치되지 않아 오탐 대상이 아니다.
- `spec/` 트리 전체에 `guide-error-code-*` 잔존 참조 0건(grep 확인) — 리네임 후 spec 쪽에 dangling reference 는 없다.

## 요약

이번 diff 는 순수 frontend build-time 테스트/스캐너 코드 재작성이며 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축에서도 다른 spec 영역과 직접 충돌하지 않는다. 유일한 실질 발견은 harness 문서(`PROJECT.md`/`CHANGELOG.md`)가 가리키는 SoT(`user-guide-evidence.md §2`)가 아직 신규 가드를 담지 못한 상태(WARNING)인데, 이는 이번 PR 이 새로 만든 문제가 아니라 선행 PR(`#1330`)부터의 gap 이 이름만 바뀐 채 지속된 것이고, developer 권한 경계에 맞게 planner 항목으로 이미 정확히 등재돼 있다. 함께 발견된 `cafe24-api-metadata.md §4` 오인용도 이번 diff 와 무관한 선재 결함으로 별도 planner 항목화가 이미 돼 있다. 두 건 모두 처리 경로가 확립돼 있어 즉시 차단할 사유는 아니다.

## 위험도

LOW
