# Plan 정합성 검토 — spec/2-navigation/ (folder-depth-cycle-guard, --impl-done)

## 발견사항

없음 (구조적 정합성 위반 미검출).

### 확인한 근거

- 이번 변경(`folder-depth-cycle-guard` 브랜치)은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 **V-04** 항목(폴더 `update()` 경로의 깊이·cycle·workspace 검증 부재)을 정확히 해소한다. 해당 plan 문서는 2026-06-13 시점에 이미 "결정 옵션" 섹션에서 V-04 를 "코드 구현 채택(spec §2.5 가 SoT)"으로 **권장**해 두었고, 본 PR 은 그 권장을 그대로 실행한 뒤 plan 항목을 `[x]` 완료로 갱신했다 (커밋 `e274d8beb`, plan 파일도 diff 에 포함되어 `origin/main` 대비 갱신됨).
  - plan 텍스트: "**권장**: 코드 구현. cycle→무한루프는 잠재 DoS 결함이라 dormant API 라도 가드 필요. spec §2.5 가 SoT." (`plan/in-progress/spec-code-cross-audit-2026-06-10.md:49`)
  - 완료 기록: "**V-04**(folder update() cycle/depth 미검증, major) — `folder-depth-cycle-guard` 브랜치(본 PR)에서 코드 구현(plan 권장 채택)... spec `1-data-model §2.5`·`2-navigation/1-workflow-list §3.1`·controller Swagger 문서화. TEST WORKFLOW(e2e 235)+ai-review(Critical 0)+impl-done." (같은 파일 34행)
  - 즉 target 문서(`spec/1-data-model.md` §2.5, `spec/2-navigation/1-workflow-list.md` §3.1)의 변경 내용과 plan 의 "코드 구현" 결정·완료 표시가 1:1 로 대응한다. **미해결 결정을 우회하거나 일방적으로 뒤집은 사례가 아니다** — 오히려 plan 이 명시한 유일한 열린 결정을 그대로 이행하고 plan 자체도 같은 커밋에서 동기화했다.
- `spec/2-navigation/1-workflow-list.md` frontmatter 의 `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]` 도 함께 확인했다. 이 plan 은 태그 필터 UI·폴더 필터 UI·빈 상태 마켓플레이스 링크(모두 frontend 잔여, §2.3/§2.7)만 미해결로 남겨두고 있으며, 폴더 깊이·cycle 검증(백엔드 §3.1 API 계약)과는 무관한 항목이다 — 본 PR 의 변경과 충돌하거나 이 plan 의 후속 항목을 무효화하지 않는다.
- `plan/in-progress/` 전체에서 "folder" 관련 텍스트를 가진 문서는 위 두 건뿐이며(grep 확인), 둘 다 이번 변경과 정합한다. 다른 in-progress plan 이 폴더 계층·깊이·cycle 관련 가정을 전제로 하는 사례는 발견되지 않았다.
- `review/spec-coverage/**` 의 과거 audit 스냅샷 문서는 본 PR 에서 수정되지 않았다(정상 — 해당 폴더는 시점 고정 historical 산출물이며 살아있는 SoT 가 아니다).

## 요약

본 변경은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 가 2026-06-13 에 이미 열어둔 V-04 결정("코드 구현 vs spec 하향")을 plan 이 권장한 방향대로 이행하고, 같은 커밋에서 plan 체크박스를 완료로 갱신했다. target spec(`1-data-model.md` §2.5, `2-navigation/1-workflow-list.md` §3.1)의 변경 내용과 plan 의 완료 기록이 서술 내용(같은 workspace parent 검증·self/자손 cycle 차단·깊이 5 서브트리 높이 포함)까지 정확히 일치한다. 다른 in-progress plan(`spec-sync-workflow-list-gaps.md`) 의 미해결 항목(태그/폴더 필터 UI, 마켓플레이스 링크)은 frontend 잔여 UI 갭으로 이번 백엔드 검증 로직 변경과 별개 트랙이라 영향받지 않는다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 관점에서도 위반이 발견되지 않았다.

## 위험도
NONE
