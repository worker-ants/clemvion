### 발견사항

- **[WARNING]** 자기-반증형 소정정의 필수 게이트(`--impl-done spec/conventions/`)가 이 PR 의 편집에 대해 사후 실행된 기록이 없다
  - target 위치: `spec/conventions/conversation-thread.md` §8.4 정정 블록 (커밋 `e6a017a18`) — `plan/complete/node-output-envelope.md` frontmatter `spec_impact` 두 번째 블록("자기-반증형 소정정 — 이 한 파일에만")
  - 관련 plan: `plan/complete/node-output-envelope.md` 자신의 `## 작업` 체크리스트, 그리고 선례 `plan/complete/sse-nodeoutput-allowlist.md` (같은 파일에 같은 예외를 먼저 원용한 PR)
  - 상세: CLAUDE.md 「자기-반증형 소정정」 절은 "**게이트**: `--impl-done` 을 그 spec 파일이 포함되는 scope 로 반드시 돌린다"고 명시한다. 이 PR 의 frontmatter 주석도 스스로 "게이트는 `--impl-done spec/conventions/` (조건 5)"라고 적어 이 의무를 인지하고 있다. 그런데 오늘(2026-08-24) 실행된 `--impl-done` 스코프 검토는 `spec/5-system/`(`00_51_50`·`10_44_28`(impl-prep)·`12_02_30`(본 실행)) 뿐이고, `spec/conventions/` 스코프로 돈 유일한 실행(`review/consistency/2026/08/24/00_26_17/meta.json`, `target_path: spec/conventions/`)은 이 PR 이 시작(`started: 2026-08-24`)하기 전, 그리고 이 파일을 건드린 이 PR 의 커밋(`e6a017a18`, `2026-08-24T10:50:13+09:00`)보다 훨씬 앞선 시점이다. `node-output-envelope.md` 의 `## 작업` 체크리스트에는 `--impl-prep`(spec/5-system 스코프) 한 줄만 있고 `--impl-done spec/conventions/` 실행 기록이 없다. 대조적으로 바로 앞 선례(`sse-nodeoutput-allowlist.md`)는 같은 예외를 원용하면서 체크리스트에 `00_26_17 (--impl-done, BLOCK: NO)`을 **명시적으로 인용**해 게이트 실행을 증거로 남겼다 — 이번 PR 은 그 증거가 없다.
  - 제안: 병합 전에 `spec/conventions/`(또는 `conversation-thread.md` 포함 스코프)로 `--impl-done` 을 1회 더 돌려 BLOCK 여부를 확인하고, 그 라운드 ID 를 `plan/complete/node-output-envelope.md` 체크리스트에 인용해 게이트 이행 증거를 남길 것. 이미 같은 오케스트레이션의 다른 패스에서 그 스코프가 돌고 있다면(현재 이 checker 가 볼 수 없는 병렬 실행) 그 결과를 이 문서에 소급 인용하는 것으로 충분하다.

### 요약

target 변경(`execution.node.completed`/`.failed` 의 `envelope.output` 을 fail-closed allowlist 로 닫는 것)은 plan 정합성 관점에서 전반적으로 매우 탄탄하다. 정본 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)의 해당 CRITICAL 항목이 `[x]` 로 정확히 닫혔고 반증된 유예 근거(`{}` 측정은 맞았으나 "그 객체가 outputData 가 된다"는 전제가 틀렸다는 것)를 `<details>` 로 이력 보존하며 정정했으며, 이 정정을 참조하는 형제 문서 3곳(`spec-draft-eia-62-waiting-payload.md`, `plan/complete/sse-nodeoutput-allowlist.md`, `spec/conventions/conversation-thread.md`) 모두 취소선+각주로 동기화되어 "envelope.output 잔여"라는 stale 서술이 어디에도 남아 있지 않다(전수 grep 확인). 이 작업이 새로 발견한 파생 위험(`finalAdapted ?? nodeOutputCache` flat-view 폴백, `background:run:{id}` 채널이 §3.2 표에서 누락)도 각각 완료 처리하지 않고 정본 트래커에 미체크 항목으로 정직하게 등재되어 있어 "후속 항목 누락" 문제는 없다. 유일한 발견은 이 PR 이 (선례와 동일하게) 원용한 "자기-반증형 소정정" 예외의 필수 후행 게이트(`--impl-done spec/conventions/`)가 이번 PR 의 편집 이후 실행된 증거가 plan 문서에도, review 디렉터리에도 없다는 절차적 공백이다 — 선례 PR 은 이 증거를 명시적으로 남겼기 때문에 대비가 뚜렷하다.

### 위험도
LOW
