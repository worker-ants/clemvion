# 요구사항(Requirement) 리뷰 — `17221ecb9` (backend lint warning 46→21, 25건 처분)

대상: `plan/in-progress/backend-lint-gate-broken-on-main.md` 잔여 항목 "남은 backend lint
warning 47건 — ratchet 으로 바닥 걸지, 처분할지 별도 판정" 중 **처분(B)** 결정의 부분 집행
(3파일 25건). 커밋 `17221ecb9` (parent `336525805`), 변경 파일:
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`,
`codebase/backend/src/modules/triggers/triggers.service.ts`,
`codebase/backend/src/scripts/migrate-node-output-refs.ts`.

## 실측 결과 (직접 재측정, 지시대로 `git stash` 미사용)

**방법**: `git worktree add --detach <scratch> 17221ecb9^` 로 부모 커밋을 별도 경로에
체크아웃(현재 워크트리 파일은 전혀 건드리지 않음), `node_modules` 심볼릭 링크로 재사용,
`npx eslint "{src,apps,libs,test}/**/*.ts" -f json` 을 양쪽에서 각각 실행 후 JSON 집계.
측정 후 `git worktree remove` 로 정리 완료.

| | BEFORE (`336525805`) | AFTER (`17221ecb9`, HEAD) |
|---|---|---|
| errors | 0 | 0 |
| warnings | **46** | **21** |

파일별 delta (다른 파일은 0 변화 — diff 범위와 정확히 일치):

| 파일 | before → after |
|---|---|
| `migrate-node-output-refs.ts` | 17 → 0 |
| `triggers.service.ts` | 6 → 0 |
| `execution-engine.service.ts` | 2 → 0 |
| **합계 처분** | **25** |

→ 커밋 메시지의 주장("lint errors 0 / warnings 46 → 21")과 **정확히 일치**한다. 46−25=21,
남은 21건도 산수가 맞는다.

`check-backend-typecheck-ratchet.py` 를 HEAD(`17221ecb9`)에서 직접 실행:

```
OK: backend 타입 진단 199건 / 38파일 — baseline 과 일치.
```

`scripts/backend-typecheck-baseline.json` 의 `"total": 199` 와도 일치. **증가·감소 모두
없음** — 이 커밋이 타입을 깨지 않았다는 주장도 실측으로 확인됐다.

## 발견사항

- **[INFO]** plan 의 "잔여 warning 47건"과 실측 46건 사이 1건 불일치 — plan 이 낡았을 가능성.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (`## 잔여 warning 47건 —
    처분 방침` 절, "`no-unsafe-*` 45 + 기타 2" 문구)
  - 상세: 이번 실측(BEFORE, 부모 커밋)의 규칙별 분해는 `no-unnecessary-type-assertion` 1 +
    `no-unsafe-assignment` 20 + `no-unsafe-call` 2 + `no-unsafe-member-access` 8 +
    `no-unsafe-argument` 8 + `no-unsafe-return` 7 = **46**. `no-unsafe-*` 합은 45로 plan 의
    "45" 와는 일치하지만, plan 이 더한 "기타 2" 는 실측상 `no-unnecessary-type-assertion`
    잔존 1건뿐이라 46이 맞고 47은 1건 과다 계상으로 보인다. 본 커밋이 만든 차이는 아니다
    (이 커밋의 diff 는 `no-unsafe-*` 계열 25건만 손댔고 `no-unnecessary-type-assertion` 은
    건드리지 않았다 — before/after 모두 1로 불변).
  - 제안: 코드 fix 대상 아님. 다음에 이 plan 항목을 마무리(21건 처분 완료 시점)할 때 "47"
    표기를 실측치로 정정할 것. `project-planner` 권한.

- **[INFO]** plan 체크박스가 열려 있는 것은 정당함.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:373` (`- [ ] 남은 backend
    lint warning 47건 …`)
  - 상세: 커밋 자체가 `wip(backend): lint warning 46→21` 이라는 제목과 "아직 미완 — 21건
    남음" 을 커밋 본문에 명시한 부분 작업이다. 21건이 아직 남아 있으므로 체크박스 미완료
    상태가 실제 상태와 일치한다(메모리 규약: "plan 체크박스 = 실제 상태").
  - 제안: 조치 불요.

- **[INFO]** 처분 범위가 요구를 넘어서지 않음 — scope creep 없음.
  - 위치: 커밋 `17221ecb9` 전체 diff (3파일, +44/−11)
  - 상세: diff 전체를 확인한 결과 모든 hunk 가 콜백/변수 시그니처에 명시 타입을 붙이거나
    (`String.replace` replacer 파라미터, `let result: SetupResult`, `m.query<{id:string}[]>`)
    `any` 값을 좁히는 캐스트(`Object.getPrototypeOf(trigger) as object`) 뿐이다.
    `eslint-disable` 주석·TODO/FIXME/HACK·로직 분기 변경·테스트 파일 변경·plan/spec 변경은
    전무하다(grep 확인). "처분(B)" 결정과 정확히 부합 — 억제가 아니라 타입 보강으로
    해소했고, 판단 조건(SQL 결과 shape·adapter 반환 타입)이 실제 사용부와 일치하는지도
    확인했다(`RETURNING id` → `rows.length`/`{id:string}[]` 일치, `SetupResult` 는
    `ChannelAdapter.setupChannel` 의 실제 반환 타입과 동일 — `chat-channel/types.ts:487`).
  - 제안: 조치 불요.

- **[INFO]** spec 관련 문서 없음 — 해당 없음.
  - 상세: 이 변경은 `spec/` 이 정의하는 제품 동작이 아니라 내부 코드 품질(lint warning
    처분) 작업이며 런타임 동작 변경이 전혀 없다(타입 주석만). `spec/conventions/` 를
    검색했으나 backend lint/`no-unsafe-*` 처분 규약을 규정하는 spec 문서는 없다 — 판단
    기준은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 자체다.

## 요약

커밋이 주장하는 두 핵심 수치(lint warning 46→21, errors 0 유지 / 타입체크 ratchet
199건·38파일 baseline 일치)는 **둘 다 부모 커밋 대비 직접 재측정으로 확인**됐으며 정확했다.
처분한 25건은 diff 범위와 파일별 delta가 정확히 일치하고, 전부 라이브러리 경계의 `any` 누수에
타입 주석/제네릭/좁히기 캐스트만 추가한 것으로 런타임 동작 변경이 없다(SQL 결과 shape·adapter
반환 타입 모두 실제 사용부와 대조해 정확함을 확인). eslint-disable·TODO·로직 변경·테스트
변경 등 처분 범위를 넘어서는 것은 없다. plan 체크박스가 열려 있는 것은 21건 잔존을 정직하게
반영한 것으로 정당하다. 유일한 발견은 plan 문서의 "47건" 표기가 실측 46건과 1건 어긋난다는
점인데, 이 커밋이 만든 차이가 아니며 코드 결함도 아니다(plan 문서의 사소한 stale 표기, 후속
정정 권장). 억지로 만든 발견사항 없음 — CRITICAL/WARNING 대상 없음.

## 위험도

NONE

STATUS: OK
