# 정식 규약 준수 검토 — `plan/in-progress/web-chat-loader-iframe-position.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-26

---

## 발견사항

### [WARNING] 체크박스(태스크 항목) 없음 — plan gate 작동 불가

- target 위치: plan 문서 전체 본문 (`# 배경` ~ `# 무관 확인`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2`, `§3 PR 전 plan 갱신·이동 강제(push gate)`
- 상세: plan-lifecycle §2 는 "미체크 체크박스(`[ ]`), 'TODO', '남은 작업' 등이 하나라도 있으면 `in-progress/`" 로 분류한다고 규정하며, §3 push gate 는 "branch 가 `codebase/**` 를 바꿨는데 연결된 in-progress plan 이 갱신·이동 흔적이 전혀 없으면 push 거부" 한다. 현재 문서에는 체크박스(`[ ]`/`[x]`) 가 전혀 없어 plan gate 의 "완료 판정"(모든 체크박스 `[x]`) 및 push gate 의 "갱신 흔적" 판단이 사실상 작동하지 않는다. 구현 완료 후 `spec_impact` 선언 + `complete/` 이동을 빠뜨릴 위험이 있다.
- 제안: 수정 항목을 체크박스로 명시한다. 예시:
  ```
  ## 작업 체크리스트
  - [ ] bridge.ts: BridgeDeps 에 position/zIndex 추가 + WidgetBridge 생성자 코너 고정 적용
  - [ ] index.ts: boot() 에서 appearance.position/zIndex 를 WidgetBridge 로 전달
  - [ ] bridge.spec.ts: position/zIndex 스타일 적용 단위 테스트
  - [ ] index.spec.ts: boot → WidgetBridge appearance 전달 단위 테스트
  ```

---

### [INFO] `related_spec` 필드 — 스키마 외 필드 (허용, 명시 확인용)

- target 위치: frontmatter `related_spec:` 키
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — 규약 필수 필드는 `worktree`/`started`/`owner` 3개이며 "추가 필드는 허용"
- 상세: `related_spec` 는 공식 스키마에 없는 추가 필드다. 규약이 "허용" 으로 명시했으므로 위반은 아님. 단, 이 필드가 build 가드(`plan-frontmatter.test.ts` 등)에서 검증되거나 cross-link 로 활용되는 것은 아니며, 현재 규약 문서 어디에도 `related_spec` 키 의미가 정의되지 않았다.
- 제안: 현 상태 유지 가능(위반 아님). 팀 내 일관성을 위해 관례화가 필요하다면 plan-lifecycle §4 에 "권장 추가 필드" 로 등재하는 방안 검토.

---

### [INFO] `spec_impact` 미선언 — in-progress 단계에서는 정상

- target 위치: frontmatter 전체
- 위반 규약: `.claude/docs/plan-lifecycle.md §5 Gate C`, `spec/conventions/spec-impl-evidence.md §4.2`
- 상세: `spec_impact` 는 plan 이 `complete/` 로 이동할 때만 선언이 의무화된다. 현재 `in-progress/` 상태이므로 미선언은 정상. 다만 `# spec` 섹션("변경 없음 — 순수 impl 수정")이 이미 intent 를 명시하고 있으므로, 완료 이동 시 `spec_impact: none` 을 쓰는 데 어려움이 없을 것이다.
- 제안: 완료(`complete/`) 이동 시 frontmatter 에 `spec_impact: none` 추가 필수.

---

## 요약

`plan/in-progress/web-chat-loader-iframe-position.md` 의 frontmatter 는 규약 필수 3필드(`worktree`·`started`·`owner`)를 모두 포함하고 형식도 정확하다. 파일 명명·위치도 규약에 부합한다. 유일한 실질 우려는 체크박스가 없어 plan-lifecycle push gate 의 "갱신·완료 판정"이 작동하기 어렵다는 점(WARNING)이다. 구현 착수 전에 작업 체크리스트를 추가해 gate 를 정상 작동시킬 것을 권장한다. `related_spec` 추가 필드와 `spec_impact` 미선언은 각각 규약 허용 범위와 in-progress 단계 정상 상태다.

---

## 위험도

LOW
