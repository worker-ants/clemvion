# Scope Review — orphan i18n runResults tab keys 제거

- Worktree: `/Volumes/project/private/clemvion/.claude/worktrees/orphan-i18n-runresults-6b8175`
- Commit: `4764dbeda` (`refactor(i18n): 실행내역 orphan tab 키 제거 (V-05 후속)`)
- Diff base: `origin/main...HEAD`

## 변경 파일 (전량)

```
codebase/frontend/src/lib/i18n/dict/en/executions.ts | 4 ----
codebase/frontend/src/lib/i18n/dict/ko/executions.ts | 4 ----
plan/in-progress/spec-code-cross-audit-2026-06-10.md | 2 +-
```

## 검증 결과

### 1. `executions.tabPreview/tabInput/tabOutput/tabError` 잔여 참조 = 0
- `grep -rn "executions\.tab" codebase/frontend/src` → 매치 없음.
- 동적 키 구성 패턴(`executions.${...}`)도 검색 — 매치 없음.
- `t(\`executions...` 백틱 템플릿 검색에서 유일한 히트는 `editor-toolbar.tsx:747`의 `t(\`executions.triggerSource.${ex.triggerSource}\`)` — 이는 `tab*`과 무관한 별개 키(`triggerSource`)이므로 오탐 아님, 이번 삭제 범위와 무관.
- 삭제된 4키는 `Dict["executions"]` 타입 정의(`en/executions.ts`의 export 타입) 쪽에도 잔존 선언이 없음 — dict 파일 자체가 타입 소스라 별도 타입 파일 갱신 불요, 실제로도 그런 파일 없음 확인.

### 2. `editor.runResults.tab*` 키 — 변경 없음, 여전히 사용 중
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` / `en/editor.ts` 의 `tabPreview/tabInput/tabOutput/tabError` 는 diff에 등장하지 않음 (git diff에 해당 파일 없음 — 파일 자체가 changeset 밖).
- `components/editor/run-results/result-detail.tsx` 에서 `t("editor.runResults.tabPreview")` 등 11개 탭 라벨이 실사용 중임을 확인. 의도한 대로 온전히 보존됨.

### 3. ko/en 대칭 제거 (parity)
- 두 파일 모두 정확히 동일한 4개 키(`tabPreview/tabInput/tabOutput/tabError`)를 동일 위치(`noNodeExecutions` 다음, `backgroundRun` 앞)에서 제거. 라인 수도 `-4/-4`로 대칭.
- 한쪽만 남기거나 순서가 어긋나는 등의 비대칭 없음.

### 4. 범위 외 변경 없음
- `git status --porcelain` clean, `git diff --numstat` 상 정확히 3개 파일만 변경(`0/4`, `0/4`, `1/1`).
- 세 번째 파일(`plan/in-progress/spec-code-cross-audit-2026-06-10.md`)은 체크박스 `[ ]` → `[x]` 전환 + 완료 근거 서술 1줄 교체뿐. 다른 plan 섹션·다른 체크박스는 unchanged.
- plan 원본 항목에는 "키 제거" + "`components/editor/run-results` 폴더 rename 검토"가 함께 명시돼 있었으나, 커밋은 rename을 수행하지 않고 그 사유(blast radius 39파일·외부 importer 5·`interaction-type-registry.md` 문자열 경로 재-ripple 비용 대비 낮은 이득)를 완료 노트에 명시적으로 기록하며 "사용자 override 없으면 미실시"로 스코프를 좁혔음. 이는 스코프 확장이 아니라 보수적 축소이며, 실제 코드에서도 폴더/파일 rename·move가 전혀 발생하지 않음(diff에 rename 없음) — 문서와 실제 상태가 일치.
- 포맷팅/공백/주석/import 변경, 무관 리팩터링, 기능 추가 없음. 순수 4-라인 dict 삭제 2건 + plan 메타 갱신 1건.

## 발견사항

- **[INFO]** plan 항목 중 "폴더 rename 검토" 서브태스크는 이번 커밋에서 수행되지 않고 평가 후 skip으로 문서화됨.
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (V-05 후속 체크리스트 항목)
  - 상세: 원 항목은 "키 제거 + rename 검토" 2가지를 포함했으나 실제 diff는 키 제거만 수행. rename 미수행 사유가 완료 노트에 근거와 함께 명시되어 있고, 코드 diff에도 어떤 rename/move 흔적이 없어 문서-코드 정합성은 유지됨.
  - 제안: 별도 조치 불요(사용자가 rename을 원할 경우 별도 PR로 진행 권장, 이미 노트에 그렇게 기록되어 있음).

## 요약

이번 변경은 설명된 스코프(고아가 된 `executions.tab*` i18n 4키를 ko/en 양쪽에서 대칭 제거 + 해당 plan 체크박스 갱신)에 정확히 부합한다. 코드베이스 전역 검색으로 삭제 대상 키에 대한 잔여 참조가 전혀 없음을 확인했고, 여전히 활성 사용 중인 `editor.runResults.tab*` 키는 손대지 않았음을 확인했다. 삭제는 ko/en 완전 대칭이며, 변경 파일은 정확히 3개(diff 2 + plan 메타 1)로 제한되어 포맷팅·리팩터링·무관 수정·기능 확장 등 스코프 이탈 징후가 없다. plan 노트에 언급된 "폴더 rename 검토"는 의도적으로 skip되었고 그 근거가 문서에 남아 있어 실제 변경 범위와 문서 서술이 일치한다.

## 위험도

NONE
