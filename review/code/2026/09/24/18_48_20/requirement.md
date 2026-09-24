# 요구사항(Requirement) 리뷰 — `deps-typeorm12` 2라운드 (1라운드 RESOLUTION 검증)

## 검증 방법

이번 changeset 은 코드 변경(0줄) 자체가 아니라 **1라운드 리뷰(`18_22_23`)의 Warning 3건에 대한
조치 결과물**(PROJECT.md·plan 문서·lockfile 축소·round-1 산출물 커밋)이 대부분이다. 저장소를
건드리는 뮤테이션 없이, 실제 저장소 상태를 `Read`/`Grep`/`git diff origin/main` 으로 대조해
plan·RESOLUTION 의 주장을 재검증했다.

- `codebase/backend/package.json:44` — `"@nestjs/typeorm": "^12.0.1"` 실재 확인.
- `git diff origin/main --stat -- pnpm-lock.yaml` → **15줄(8+/7-), 1 file changed** — 전문을
  읽어 8곳 hunk 가 **전부 `@nestjs/typeorm` 관련**(specifier/version/resolution/engines/
  peerDependencies/snapshot)임을 확인. `libc:` 필드·`eslint-plugin-*` peer 문자열 변경은
  **0건** — RESOLUTION.md W1 "15줄, 전부 typeorm" 주장과 정확히 일치. 1라운드 requirement.md
  가 지적한 63줄 `libc:` 노이즈는 **실제로 사라졌다.**
- `PROJECT.md:88` — "Node 지원 floor" 줄에 `@nestjs/typeorm@12` ESM-only/`require(esm)`/
  `engines >=20.19.0` 결속 문장이 실재. `codebase/backend/package.json:132-134` 의
  `engines.node: ">=24"` 와 대조해 현재 floor 가 그 결속을 충족함을 확인 — W3 조치 실재.
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md` frontmatter `worktree: (unstarted)` 아래
  블록인용문이 그 값을 쓴 이유(형제 plan 워크트리 소유, 머지 후 소멸 시 stale 방지)를 명시 —
  W2 조치 실재.
- `spec/5-system/1-auth.md:807` — `^11.0.1` 인용 실재 확인. 문맥상 이 인용은 `@nestjs/common`
  의 caret range 를 가리키고, 이번 diff·round-1 diff 모두 `@nestjs/common` 을 건드리지 않았다
  (`package.json` 상 `^11.0.1` 그대로) — "이 PR 은 여전히 참" 이라는 plan `후속` 절 판단이
  타당함을 재확인. 정정은 `@nestjs/common` 자체가 12로 오를 때 필요하며 그건 `spec/` 쓰기라
  planner 턴 — 프로젝트 규약(`developer` 는 spec read-only, 자기-반증형 소정정 예외는 조건
  불충족: 이 문장을 `developer` 가 쓴 것도 아니고 아직 반증되지도 않음)과 정합.
- `git status --short` — 이 리뷰 세션 자신의 출력 디렉터리 외 잔여 변경 없음. 1라운드 SUMMARY
  INFO #10 이 관측한 `workspace.decorator.ts` 미원복 뮤턴트는 현재 **clean** — 재발 없음.
- `review/consistency/2026/09/24/17_31_27/_retry_state.json` 의 `agents_pending`(5개 전부)·
  `agents_success: []` 스냅샷은 SUMMARY.md 및 1라운드 requirement.md INFO 가 이미 "평문
  Agent fan-out 경로의 알려진 동작, `meta.json` 은 정상" 으로 설명·처분한 것과 동일 사안 —
  재지적 불필요.

## 발견사항

없음. 1라운드 Warning 3건(lockfile 범위 초과, frontmatter 모순, ESM/CJS 암묵 결속) 모두
**코드·문서 수준에서 실제로 조치됐음을 독립 재검증**했고, 새로 발생한 요구사항 충족 관점
결함은 발견되지 않았다.

- **[INFO]** 이번 changeset 은 애플리케이션 코드(`src/**`) 변경이 0줄이라 "엣지 케이스·
  에러 시나리오·데이터 유효성·비즈니스 로직·반환값" 관점은 판단 대상 표면이 없다. 이는
  결함이 아니라 변경 성격(순수 의존성 범프 + 문서/리뷰 산출물)에서 기인한다.
  - 위치: `codebase/backend/package.json:44`, `pnpm-lock.yaml`(8 hunks)
  - 제안: 해당 없음.

## 요구사항 충족 관점 평가

`@nestjs/typeorm` `^11.0.3` → `^12.0.1` 단일 의존성 범프이며, 1라운드에서 지적된 Warning
3건(lockfile diff 범위 초과·plan frontmatter 모순·ESM/CJS 암묵 결속 미문서화)은 이번
changeset 에서 전부 실측 가능한 형태로 조치됐다 — lockfile 은 15줄(전부 typeorm)로 좁혀졌고,
frontmatter sentinel 사유가 본문에 명시됐으며, `PROJECT.md` 의 Node floor 규약 자리에 결속이
기재됐다. spec 인용(`1-auth.md:807` 의 `^11.0.1`)은 이번 PR 이 `@nestjs/common` 을 건드리지
않아 여전히 참이므로 정정 불요라는 판단이 재검증으로 확인됐고, 정정 필요 시점(동반 업그레이드)
과 담당 turn(planner)도 올바르게 지정돼 있다. 저장소에는 리뷰 검증용 잔여 뮤테이션이 없다.
코드 변경이 없어 엣지 케이스·에러 시나리오 등 대부분의 점검 관점은 적용 대상이 없으며, 이는
변경 성격상 정상이다.

## 위험도

NONE
