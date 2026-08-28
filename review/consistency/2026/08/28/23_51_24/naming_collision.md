# 신규 식별자 충돌 검토 — naming_collision

## 스코프 정정 (선행 확인)

prompt payload 는 `--impl-done`(scope=`spec/5-system/`, diff-base=`origin/main`)로 `spec/5-system/*`
전체를 번들해 왔으나, 실측 결과 이번 PR 의 diff 는 `spec/5-system/` 을 **전혀 건드리지 않는다**:

```
git -C <worktree> diff origin/main -- spec/5-system/   →  (출력 없음, 0 hunks)
git -C <worktree> diff origin/main --stat              →  아래 16개 파일만 변경
  codebase/frontend/eslint.config.mjs
  codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts   (신규)
  codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts   (신규)
  plan/in-progress/deps-peer-gating-and-eslint10.md
  review/code/2026/08/28/23_20_05/*.md, meta.json, _retry_state.json         (직전 코드리뷰 산출물)
```

즉 실제 target 은 eslint 9→10 상향 차단자 감시 가드(frontend repo-guards)이며, `spec/5-system/`
은 이번 세션과 무관한 번들 스코프 leftover 다(과거 알려진 impl-done 번들 오탐 패턴과 동일 —
prompt grep 0건 확인 후 BYPASS 처리, 근거는 위 diff stat). 이하 신규 식별자 충돌 분석은
**실제로 변경된 코드/plan** 을 대상으로 수행했다.

## 발견사항

검토 대상 신규 식별자 (신규 파일 `eslint10-unblock-guard.ts` / `eslint10-unblock.test.ts`):

- 값: `LOCKFILE`, `BLOCKERS`, `BLOCKER_NAMES`
- 타입: `BlockerKind`, `Blocker`, `PeerEntry`
- 함수: `readPeerRanges`, `termMajorFloor`(비-export), `allowsEslint10`, `readLockfile`

repo 전수 grep(`codebase/`, `spec/`, `plan/`) 결과 위 식별자들은 신규 파일 2개 바깥에서
**전혀 재사용되지 않는다** — 동일 이름의 기존 정의·다른 의미의 기존 사용처가 없다.

- `ROOT` 는 새로 만들지 않고 형제 파일들과 동일하게 `./_shared` 에서 import — 기존 컨벤션
  (`masked-marker-mirror-guard.ts`, `internal-package-registration-guard.ts` 도 동일 패턴으로
  `ROOT` re-export)과 일치, 충돌 아님.
- 파일 경로/명명 컨벤션: `<주제>-guard.ts` + `<주제>.test.ts` 쌍 배치는 같은 디렉터리의 기존
  3쌍(`masked-marker-mirror-*`, `typescript-toolchain-*`, `internal-package-registration-*`)과
  동일한 규약을 그대로 따름 — 컨벤션 이탈 없음, 기존 파일과 경로 중복도 없음(신규 파일).
- ENV var·config key: 이번 diff 는 `pnpm-workspace.yaml`/`pnpm-lock.yaml` 을 건드리지 않는다
  (diff stat 확인). `eslint-plugin-react-hooks: 7.0.1` 핀은 기존 값을 문서·주석에서 재확인만
  했을 뿐 신규 키가 아니다.
- API endpoint·이벤트명·요구사항 ID: 이번 diff 범위(eslint 설정 주석 + 신규 가드 테스트 +
  plan 문서 갱신)에 해당 카테고리의 신규 식별자 도입 자체가 없음.
- plan 문서(`deps-peer-gating-and-eslint10.md`) 갱신분은 기존 서술을 취소선(`~~~~`)으로 보존한
  채 정정 섹션을 추가하는 형태 — 새 ID/식별자 도입 없음, 기존 체크리스트 항목의 상태만 갱신.

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 번들 스코프와 실제 diff 불일치
  - target 신규 식별자: 없음(해당사항 아님)
  - 기존 사용처: N/A
  - 상세: 이번 세션의 `_prompts/naming_collision.md` 가 `spec/5-system/` 전체(1-auth.md 등 다수
    `@bundle-file`)를 첨부했지만 실제 diff 는 `codebase/frontend/src/lib/repo-guards/__tests__/`
    와 `plan/in-progress/deps-peer-gating-and-eslint10.md` 뿐이다. 다음 라운드에서 동일 패턴이
    재발하면(예: consistency-checker orchestrator 의 target 문서 추론 로직) 오탐 소지가 있다.
  - 제안: orchestrator 쪽에서 diff-base 대비 실제 변경 파일 경로로 스코프를 산정하도록
    재확인 권장(기능적 버그는 아니며 본 세션은 이미 실제 diff 기준으로 우회 처리함).

## 요약

이번 PR(eslint 9→10 상향 차단자 감시)이 신규로 도입하는 식별자(`BLOCKERS`, `BLOCKER_NAMES`,
`Blocker`, `BlockerKind`, `PeerEntry`, `readPeerRanges`, `allowsEslint10`, `readLockfile`,
`LOCKFILE`)와 신규 파일 경로(`eslint10-unblock-guard.ts`/`eslint10-unblock.test.ts`)는 전수
grep 결과 기존 코드베이스·spec·plan 어디에도 다른 의미로 이미 쓰이고 있지 않으며, 파일 배치도
같은 디렉터리의 기존 guard/test 쌍 컨벤션을 그대로 따른다. `spec/5-system/` 에는 이번 PR 의
diff 가 전혀 없어(실측 확인) 해당 영역 기준 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV
충돌도 원천적으로 해당사항이 없다. 신규 식별자 충돌 관점에서 이 PR 은 깨끗하다.

## 위험도

NONE
