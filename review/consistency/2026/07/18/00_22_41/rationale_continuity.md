# Rationale 연속성 검토

## 사전 고지 — payload 결함

`_prompts/rationale_continuity.md` 의 "target 문서" 덤프는 `scope=spec/conventions/`(디렉터리 전체) 를
알파벳 순으로 나열하다 크기 한도에 걸려 `audit-actions.md` → `cafe24-api-catalog/**`(수백 개
field-level 파일) 구간에서 잘렸고, 실제 diff 대상인 `spec/conventions/frontend-layering.md` 본문·
`## 구현 변경 사항` diff 는 payload 에 **전혀 포함되지 않았다** (`grep "frontend-layering\.md"` 0건,
`grep "레이어"` 도 무관한 cafe24 카탈로그 표현 1건뿐). "## 관련 Rationale 발췌" 섹션도 같은 이유로
`spec/2-navigation/4-integration.md` 부근에서 중도 절단됐다.

payload 만으로는 실제 검토가 불가능하다고 판단해, 지시된 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/frontend-layering-types-scope-351061`)를
절대경로로 직접 열어 `git diff 29aa918a6...HEAD`, 현재 `spec/conventions/frontend-layering.md`,
`codebase/frontend/eslint.config.mjs`, `eslint-layering-guard.test.ts`, 삭제/이동된
`plan/in-progress/spec-draft-frontend-layering.md`(→`plan/complete/`), 직전 `/ai-review` 산출물
(`review/code/2026/07/17/23_49_51/**`)을 1차 자료로 재구성해 검토했다.

## 실제 검토 대상 (재구성)

- HEAD 커밋 `00b3b05a4` "fix(frontend): 레이어 가드 스코프를 src/types 로 확장 + spec implemented 승격"
  — base `29aa918a6` "docs(spec): conventions — frontend 레이어 경계 규약 신설" 대비.
- 변경 파일: `spec/conventions/frontend-layering.md`(frontmatter+§4 일부), `eslint.config.mjs`,
  `eslint-layering-guard.test.ts`, `conversation-utils.ts`/`rag-types.ts`(주석만),
  `plan/.../spec-draft-frontend-layering.md`(rename), `review/code/2026/07/17/23_49_51/**`(신규).

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

- **[INFO]** 계획된 Phase 순서와 실제 실행의 완전한 합치
  - target 위치: `spec/conventions/frontend-layering.md` frontmatter(`status: partial`→`implemented`, `pending_plans` 제거) + §4
  - 과거 결정 출처: (구)`plan/in-progress/spec-draft-frontend-layering.md` D4 — "spec 은 `status: partial` 로 착지, `implemented` 승격은 Phase 2 와 동일 커밋"
  - 상세: base 커밋(`29aa918a6`)이 `status: partial` + `pending_plans` 로 착지하고 Rationale 에 "왜 src/types/** 도 규약 범위에 넣었나 (2026-07-17 결정)" 를 **미리** 기록해 둔 뒤, HEAD 커밋이 그 결정대로 `files: ["src/lib/**"]` → `LOWER_LAYERS = ["src/lib/**", "src/types/**"]` 로 코드를 확장하고 같은 커밋에서 spec 을 `implemented` 로 승격했다. `spec-impl-evidence.md` §3 의 "일부 구현 시 `partial`+`pending_plans` 의무" 규약과도 정합 — 승격 시점에 `pending_plans` 대상 plan 이 `plan/complete/` 로 정상 이동(rename, 삭제 아님)됐다.
  - 제안: 조치 불필요. Rationale 연속성 모범 사례로 기록.

- **[INFO]** §4/§4.1 의 PR 번호 각주 보존 정책 불일치 (기존 ai-review INFO#13 재확인)
  - target 위치: `spec/conventions/frontend-layering.md` §4 (규칙 표 아래 "PR #969" 유지) vs §4.1 ("전부 실제 mutation 으로 탐지 확인됨" 문구에서 "— PR #969" 삭제)
  - 과거 결정 출처: 없음 (신규 관찰) — `review/code/2026/07/17/23_49_51/SUMMARY.md` INFO #13 이 이미 지적, "조치 불필요" 로 처분됨
  - 상세: 결정 자체의 번복은 아니고 각주 보존 여부의 사소한 비일관. Rationale 실질 내용에는 영향 없음.
  - 제안: 이미 처분(조치 불필요)된 사안이므로 재조치 불요. 원한다면 두 곳 모두 PR 각주 제거로 통일.

검토한 핵심 Rationale 정합 지점 (위반 없음 확인):
1. **"관측된 역전 압력에 비례해 가드"** 원칙(§Rationale "왜 `app` 경계는 가드하지 않나") — `src/types/**` 는 위반 0건이지만 "우연한 0"(app 은 "구조적 0")이라는 구분을 근거로 예외적으로 가드에 포함시킨다는 논리가 코드 변경(`LOWER_LAYERS` 확장)과 정확히 일치.
2. **"규칙 2종 조합"** 원칙(경계 쌍 1개 한정 시 `no-restricted-imports`+`no-restricted-syntax` 유지, 2쌍 이상 시 zone 기반 도구로 재평가) — 이번 변경은 `{lib,types}→components` 라는 **동일 1쌍**의 `files:` glob 확장이지 새 경계 쌍 추가가 아니므로 재평가 트리거 조건 미충족. 원칙 위반 아님.
3. **"types→lib 는 규약에만 있고 가드가 없다"** Rationale — 이번 변경은 `{lib,types}→components` 방향만 확장했고 `types→lib` 방향은 손대지 않아 별개 결정과 충돌 없음.
4. **기각된 대안 재도입 여부** — base 커밋 Rationale 의 "기각: `src/types/transform.ts` 를 `src/lib/types/` 로 통합"은 HEAD 커밋에서도 재도입되지 않음 (해당 이동은 수행되지 않았고 언급도 없음).
5. **plan 이관 규약** — 파일이 `git mv`(rename, 삭제 아님)로 `plan/complete/`에 도착, "완료 시 `plan/complete/`로 이동" 지시와 합치.

## 요약

payload 자체는 실제 diff·target 문서를 담지 못한 결함이 있었으나, 워킹트리를 직접 재구성해 검토한
결과 이번 변경(`fix(frontend): 레이어 가드 스코프를 src/types 로 확장 + spec implemented 승격`)은
직전 spec 커밋이 미리 기록해 둔 Rationale("2026-07-17 결정")을 그대로 실행에 옮긴 것으로, 기각된
대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 것도 발견되지 않았다. spec 상태 승격
절차(`spec-impl-evidence.md`)·plan 라이프사이클(rename→`plan/complete/`)도 모두 규약대로 처리됐다.

## 위험도
NONE
