# Rationale 연속성 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 검토 범위

target 은 `1-workflow-list.md` frontmatter/`Rationale §3` 문단, `0-canvas.md` frontmatter 두 곳만 고치는 **북키핑 정정 draft**다(직전
BLOCK: YES 세 라운드 — `20_21_21`·`20_35_40`·`20_45_35` — 가 지적한 시제·경로·frontmatter-evidence 가드 대상 오판을 해소하려는 3번째
iteration). 아래 SoT 를 대조했다:

- `spec/1-data-model.md` §1.1 「참조의 소속」(신설 커밋 `a8bfd1492`) — 이 draft 가 인용하는 규칙 SoT
- `spec/data-flow/12-workspace.md` Rationale 「본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)」 — §1.1 의 근거·기각한 대안 서술
- `spec/2-navigation/1-workflow-list.md` Rationale §3 「폴더 계층 무결성은 생성·부모 변경 양쪽에서 강제 (2026-07-05)」
- `spec/3-workflow-editor/0-canvas.md` §11.2.2 「같은 워크플로의 노드만」
- `spec/conventions/spec-impl-evidence.md` §1 `EXCLUDE_BASENAMES`/§2.1 R-5(`pending_plans` 의무)

## 발견사항

### [INFO] 이전 3라운드 Critical 을 정확한 근거로 해소 — 신규 위반 없음

- target 위치: `## 변경안` 1~3, `## Rationale` 전체
- 과거 결정 출처: `1-workflow-list.md` §3 Rationale(2026-07-05) · `spec-impl-evidence.md` §1 `EXCLUDE_BASENAMES` · R-5(`pending_plans` 의무)
- 상세:
  1. **§1.1 규칙 자체와 충돌 없음.** `1-data-model.md` §1.1 이 이미 "폴더 생성 `parentId` 도 워크스페이스 검사 대상"이라고
     선언하고, `1-workflow-list.md` §3.1 API 표(POST `/api/folders`)도 2026-07-05 결정 이후 줄곧 "생성 시 같은 워크스페이스가
     아니면 400"이라고 서술해 왔다. Rationale §3 의 "(2026-09-27 정정)" 단락이 말하는 것은 **그 결정이 뒤집혔다는 뜻이 아니라
     코드가 결정을 따르지 않고 있었다(깊이만 검사)는 drift 발견**이다. target 은 이 drift 를 고치는 구현(`plan/in-progress/cross-workspace-refs.md`)의 시제·경로 인용만 정정할 뿐, §3(2026-07-05)이 이미 세운 "생성·부모변경 양쪽 강제" 원칙을 새로 도입하거나 되돌리지 않는다.
  2. **frontmatter-evidence 관례(R-5)와 일치.** `status: partial` 문서(`1-workflow-list.md`·`0-canvas.md`)의 미구현 surface 를
     `pending_plans` 로 추적하라는 R-5 원칙을, target 의 변경안 1·2 가 정확히 그대로 적용한다(경로도 `plan/in-progress/`
     실존 표기, `spec-pending-plan-existence.test.ts` 의 in-progress→complete 치환 규칙과 부합).
  3. **`1-data-model.md` 를 건드리지 않는 결정이 규약과 일치.** `spec-impl-evidence.md` §1 은 `1-data-model.md` 를
     `EXCLUDE_BASENAMES` 로 명시 등재해 4개 frontmatter-evidence 가드 전부가 이 파일을 순회하지 않는다(직전 라운드
     `20_45_35` Critical 이 "§3 이 가드로 승격을 강제한다"는 **반증된 근거**를 지적했는데, 이번 draft 는 그 근거 문장을 빼고
     대신 §처방(구현 plan)에 §1.1 추적을 맡기는 쪽으로 정정했다 — R-11 의 "가드가 보지 않는 방향은 판정 근거를 커밋에 남긴다"
     패턴과 결이 맞는다).
  4. **plan 경로를 마크다운 링크로 걸지 않는 이유(백틱 유지)** — `spec-impl-evidence.md` §4.2 표의 `spec-link-integrity.test.ts`
     항목이 이미 "spec 이 쓴 `plan/**` 링크는 plan 이 `complete/` 로 이동하면 build 가 깨진다"고 명시한 사실과 정합한다.
     target Rationale 의 대응(W1 처분: 백틱 + `pending_plans` 이 추적을 대신함)은 이 저장소 관례를 신설하는 것이 아니라
     **그대로 따르는 것**이다.
  5. **marketplace 선례 오인용 철회** — 직전(`20_35_40`) INFO 로 지적된 부정확한 선례 인용(라벨+`pending_plans` 병용 사례를
     "pending_plans 단독 선례"로 잘못 씀)을 이번 draft 가 스스로 지웠다(Rationale 마지막 불릿). 근거 없는 선례 재활용을 막았다는
     점에서 오히려 Rationale 연속성에 유리한 방향.
- 제안: 없음 — 조치 불요. 다만 `2-trigger-list.md`/`3-schedule.md`/`9-user-profile.md` 의 §1.1 미러 누락(W3)은 이 draft 가 이미
  트래커(`spec-draft-nullable-notation-followups.md`)로 명시 이관했으므로, 후속 라운드에서 "누락됐다"고 재지적하지 말 것 — 의도된
  지연이지 결정 번복이 아니다.

## 요약

target 은 새로운 설계 결정을 도입하지 않는다 — `1-data-model.md` §1.1(참조의 소속) 이라는 이미 확정된 규칙을 구현 코드가 아직
못 따라간 상태(drift)를 정확한 시제·경로로 기록하고, 그 추적을 `spec-impl-evidence.md` R-5 관례(`pending_plans`)에 맡기는
북키핑 정정이다. 대조한 다섯 개 Rationale/컨벤션 출처(§1.1 신설, workspace.md 의 근거 절, 1-workflow-list.md §3 2026-07-05 결정,
0-canvas.md §11.2.2, spec-impl-evidence.md §1/§4.2) 중 어느 것도 이 draft 가 기각한 대안을 재도입하거나, 합의된 원칙을
위반하거나, 근거 없이 결정을 번복한 지점을 보이지 않는다. 오히려 직전 세 라운드가 지적한 "완료형 과잉 주장"·"거짓 가드 근거" 를
모두 근거를 대며 정정했다.

## 위험도
NONE
