# Plan 정합성 검토 — `spec/conventions/` (guide-identifier-existence)

## 조사 방법

- target scope(`spec/conventions/`) 델타는 실제로 0파일 — 이 PR 은 spec 을 고치지 않는다.
  실제 diff 는 `codebase/frontend/.../guide-error-code-*` → `guide-identifier-*` 리네임 +
  `PROJECT.md` 가드 카탈로그 1행 + `plan/in-progress/guide-identifier-existence.md`(신규,
  이 PR 자신의 plan) + `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커) 편집.
- `plan/in-progress/guide-identifier-existence.md`(이 작업 자신의 plan), 그 plan 이 편집한
  트래커 `spec-draft-nullable-notation-followups.md` 의 diff, 그리고 target 인
  `spec/conventions/user-guide-evidence.md` / `cafe24-api-metadata.md §4` / `error-codes.md`
  를 워크트리 절대경로로 직접 대조했다. 관련 가능성이 있는 다른 in-progress plan
  (`cafe24-backlog-residual.md`, `spec-conventions-engine-error-code-surface.md`,
  `node-output-redesign/README.md`, `harness-env-value-subpattern-dedup.md`) 도 확인했다.

## 발견사항

- **[INFO]** SoT 등록 갭은 이미 정확히 추적되어 있고 이번 PR 이 확대만 함 — 신규 조치 불요
  - target 위치: `spec/conventions/user-guide-evidence.md §2` (Build-time 가드 3건 표) — 실측: `impl-anchor-existence` · `integrations-coverage` · `triggers-coverage` 3건만 등재, `guide-identifier-existence`/`guide-sanitized-message-parity` 미등재(합치면 5건이어야 함)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §"가이드가 적는 식별자..." 항목(체크 완료, `[x]`) 및 그 밑 "해소 — `#1331`" 각주 + 신설 `cafe24-api-metadata.md §4` planner 항목
  - 상세: `PROJECT.md` 는 `guide-identifier-existence.test.ts` 를 "SoT: `spec/conventions/user-guide-evidence.md §2`" 라고 여전히 가리키는데, 그 SoT 문서엔 이 가드가 없다. 이는 `#1330` 때부터 있던 기존 갭이며 이번 PR 이 파일명만 바꿔 그대로 이어받았다. developer 는 `spec/` 쓰기 권한이 없으므로 직접 고치지 않고 트래커에 "planner 항목"으로 정확히 등재해 두었다(체크리스트 "planner 등재 갱신"). 정책 번복("허용목록 없음"→"방어적 허용목록") 근거도 같은 트래커에만 있고 spec Rationale 엔 없는데, 이 또한 같은 planner 항목에 **한 턴으로 묶어야 한다**는 경고까지 plan 안에 명시돼 있다(§D #1·#2 주석) — 두 번 나눠 쓰는 과거 실수(§2.1 서술만 고치고 frontmatter 를 빠뜨렸던 것) 재발 방지 조치가 이미 들어가 있다.
  - 제안: 조치 불요. 다음 planner 턴이 `user-guide-evidence.md §2`(표+frontmatter `code:`)와 신규 Rationale 을 한 번에 갱신하면 종결된다. 이 checker 는 이미 존재하는 정합한 백로그 항목을 재확인했을 뿐이다.

- **[INFO]** 무관한 선재 결함(`cafe24-api-metadata.md §4` Principle 7→0 오인용)을 이 PR 이 방치한 것은 올바른 처분
  - target 위치: `spec/conventions/cafe24-api-metadata.md §4` "용어 주의" 박스(`node-output.md` Principle 참조)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 신규 항목 "`cafe24-api-metadata.md §4` 가 노드 출력 envelope 정의처를 오인용한다"
  - 상세: 실측 결과 워크트리의 `spec/conventions/cafe24-api-metadata.md`(§4)는 여전히 "Principle 7" 을 인용하고 `status` 필드 언급도 빠져 있다 — 즉 developer 가 이 결함을 **고치지 않았다**. `spec/conventions/node-output.md` 를 대조하면 5필드 불변식은 실제로 Principle 0 소유(Principle 7 은 config echo 전용)이므로 지적은 타당하지만, `spec/**` 수정 권한이 없는 developer 가 이를 고치지 않고 planner 항목으로만 등재한 것은 역할 경계상 옳다.
  - 제안: 조치 불요 — 별도 planner 턴에서 처리.

## 요약

이 PR 의 spec/conventions 델타는 0이며, 실제 코드/plan 변경(가드 리네임·범위 확대·과거 트래커 항목 종결)은 "developer 가 spec 을 직접 고칠 수 없다"는 경계를 정확히 지켰다 — 미해결 spec 등록 갭(`user-guide-evidence.md §2`)과 무관한 선재 결함(`cafe24-api-metadata.md §4`)을 모두 **planner 트랙 항목으로만 등재**하고 직접 손대지 않았으며, 같은 SoT 를 겨냥하는 두 등록 항목을 한 planner 턴으로 묶으라는 경고까지 남겨 이 가드 계열이 반복해 온 "두 번 나눠 써서 두 번 미완결" 패턴 재발을 막았다. 원 트래커 항목(`가이드가 적는 식별자...`)의 처분 제안은 취소선 + 반증 근거로 정정됐고 체크박스도 `[x]`로 정확히 갱신됐다. 다른 in-progress plan(`cafe24-backlog-residual`, `spec-conventions-engine-error-code-surface`, `node-output-redesign`)과의 충돌·전제 미해소·후속 누락은 발견되지 않았다. 남은 항목(SoT 등재)은 이미 정확한 위치에 정확한 문구로 등재되어 있어 이번 검토가 추가로 지적할 CRITICAL/WARNING 은 없다.

## 위험도
NONE
