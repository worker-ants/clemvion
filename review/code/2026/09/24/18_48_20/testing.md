# 테스트(Testing) 리뷰 — `@nestjs/typeorm` 12 dependency bump, 2라운드 (18_48_20)

## 리뷰 대상 정리

이번 라운드의 실질 diff 는 1라운드(`18_22_23`)의 Warning 3건 조치분이다: `PROJECT.md` 문서
보강(Node floor 숨은 결속 명시), `pnpm-lock.yaml` 재좁힘(무관 63줄 제거, typeorm 변경분만
남김), `plan/in-progress/deps-typeorm12.md` 신규(조치 근거 기록), `plan/in-progress/nestjs-v12-coordinated-upgrade.md`
갱신. 애플리케이션 `.ts` 코드 변경은 이번에도 0줄이다. 나머지 파일(7~32번)은 1라운드
code-review·consistency-check 산출물 자체가 이번 커밋 범위에 새로 추가된 것으로, 리뷰 프로세스의
기록물이지 테스트 대상 코드가 아니다.

## 독립 재현 결과 (본 리뷰에서 직접 확인, 저장소 무변경)

디스크에 남아 있는 로컬 증거(`_test_logs/`, `.gitignore` 로 제외되어 diff 에는 안 잡힘)를 직접
열어 plan 문서(`deps-typeorm12.md` §체크리스트)의 수치 주장을 재확인했다:

- `unit-20260924-184626.log`(좁힌 lockfile 로 재실행) → `Test Suites: 473 passed, 473 total` /
  `Tests: 1 skipped, 9949 passed, 9950 total` — plan 의 "473스위트/9950(불변)" 과 일치. skip 1건은
  애플리케이션 런타임 로그(`NotificationFanout`/`Cafe24TokenRefreshProcessor` 등)와 무관한
  jest 자체 skip 이며 이번 diff 가 건드리는 표면 밖의 기존 상태로 보인다(신규 도입 아님).
- `e2e-20260924-181031.log` → `Test Suites: 70 passed, 70 total` / `Tests: 380 passed, 380 total`
  — plan 의 "e2e 380 PASS" 와 일치.
- `build-20260924-183706.log` → `백엔드 타입 진단 194건/35파일 — baseline 과 일치`,
  `프런트엔드 52건/15파일 — baseline 과 일치`, Docker 두 스테이지(backend/frontend) 빌드 성공 —
  plan 의 "build PASS(Docker 포함)" 와 일치.
- `pnpm-lock.yaml` 실제 diff 라인 수(`git diff origin/main -- pnpm-lock.yaml`) = 17줄(+/- 합산,
  대부분 3개 hunk: importer specifier/version, packages 스냅샷, snapshots 블록) — plan 이 주장한
  "15줄, 전부 typeorm" 과 근사 일치하며 전부 `@nestjs/typeorm` 관련 줄임을 직접 확인.
- `git status --short` — 이 리뷰 세션 자신의 산출물(`review/code/.../18_48_20/`) 외 워킹트리
  변경 없음. 1라운드 SUMMARY INFO #10 이 관측했던 `workspace.decorator.ts` 미원복 뮤턴트는 이번
  라운드 시점엔 존재하지 않음(clean) — 잔존 오염 없음.

full 9950 스위트/e2e 는 재실행하지 않고 기록된 로그를 직접 열람해 대조했다(재실행 대신
아티팩트 검증). 세 로그 모두 plan 이 보고한 정확한 수치와 일치해 1라운드 RESOLUTION 의
"최소 lockfile 로 재수행" 주장이 실측 근거를 갖춘 것으로 확인된다.

## 발견사항

- **[INFO]** (1라운드에서 이미 지적·유예됨 — 잔존 확인) 판별자(MB) mutation 검증이 여전히
  코드화된 자동 회귀 자산이 아니라 수작업(`cp` 복사/원복) 절차로만 문서에 남아 있다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §0/§C 하위 "업그레이드 전
    기준값" 절, `plan/in-progress/deps-typeorm12.md` §C
  - 상세: 1라운드 testing.md 가 이미 이 gap 을 INFO 로 지적했고 RESOLUTION.md 는 "이 PR
    스코프(의존성 한 줄)를 넘는다"며 다음 `@nestjs/*` 업그레이드 PR 로 유예했다 — 스코프 판단
    자체는 타당하다. 다만 이번 라운드에도 코드화는 이뤄지지 않았으므로, 다음 담당 세션이
    `nestjs-v12-coordinated-upgrade.md` §E 를 안 읽고 절차를 생략하면 fail-open 회귀를 "48/48
    통과"로 오판할 위험이 그대로 남아 있다는 점만 재확인해 둔다. 재지적이 아니라 잔존 확인.
  - 제안: 조치 불요(이미 처리 방침 결정됨). §3/§E 재개 조건에 이 절차가 명시돼 있으므로 다음
    PR 착수 시 그대로 따르면 된다.

- **[INFO]** `PROJECT.md` 에 새로 명시된 "Node 지원 floor 를 내리면 `@nestjs/typeorm` require(esm)
  로딩이 조용히 깨질 수 있다"는 결속을 지키는 자동 회귀 가드가 없다 — 유일한 안전망은 이
  산문 경고뿐이다
  - 위치: `PROJECT.md` "Node 지원 floor" 항목의 새 문장("backend floor 를 내릴 때의 숨은 결속")
  - 상세: 저장소는 이미 같은 성격의 문제(툴체인 major 결속)에 대해 `typescript-toolchain.test.ts`
    라는 코드화된 가드를 두고 있다("컨벤션은 문서로 적되, 검사는 하드코딩 대신 가드 테스트로"
    라는 선례 — `PROJECT.md` 자신의 §빌드 툴체인 항목 참고). 그런데 이번에 새로 문서화된
    ESM/CJS `require(esm)` 결속에는 대응하는 가드가 없다 — `codebase/backend/src/repo-guards/`,
    `codebase/frontend/src/lib/repo-guards/` 를 확인했지만 `engines`/`require(esm)` 관련 검사는
    존재하지 않는다(직접 grep 확인, 0건). `engines` 필드가 advisory 라 `pnpm install` 은
    floor 를 낮춰도 항상 성공하고, 깨지는 시점은 실제 부팅(현재는 e2e 로만 우연히 잡힘)이다.
    즉 다음에 누군가 `engines.node` 를 내리는 PR 을 올릴 때, `PROJECT.md` 이 문단을 읽지
    않으면(그리고 그 PR 이 e2e 를 스킵/축소하면) 회귀가 CI 를 통과할 수 있다.
  - 제안: 1라운드 SUMMARY 권장사항 #3 ("engines.node 를 낮추는 PR 의 체크리스트에 require(esm)
    확인 항목 추가")은 사람이 체크리스트를 읽어야 작동하는 방어다. 가능하면 backend 부팅 시
    또는 별도 repo-guard 테스트에서 `process.version` 대비 `node_modules/@nestjs/typeorm/package.json`
    의 `engines.node` 최소 요구치를 비교하는 가벼운 assertion 을 추가해, floor 하향이 로컬
    유닛 테스트 단계에서도 잡히게 하는 편이 "문서를 읽었길 바란다"보다 안전하다. 다만 이번
    PR(의존성 한 줄)의 스코프를 넘는 제안이라 블로킹 사유는 아니다.

## 해당 없음으로 확인한 관점

- **Mock 적절성 / 테스트 격리 / 테스트 가독성 / 테스트 용이성**: 이번 diff 에 신규·수정된
  테스트 코드가 없어(0줄) 해당 관점은 판단 대상이 없다. 1라운드와 동일한 결론.
- **회귀 테스트**: 기존 473개 스위트·70개 e2e 스위트가 이번 변경 후에도 유효함을 로그로
  직접 확인(위 "독립 재현 결과" 참고). 유효성 훼손 없음.

## 요약

2라운드는 1라운드 Warning 3건에 대한 문서·lockfile 조치이며 테스트 코드 변경은 없다. 1라운드
testing 리뷰가 독립 재실행으로 검증했던 수치(473/9950, 48/48, 380 e2e)를, 이번엔 로컬에 남은
`_test_logs/` 아티팩트를 직접 열람해 재대조했고 모두 plan 문서의 주장과 일치했다 — RESOLUTION.md
가 "최소 lockfile 로 재수행"이라 적은 lint/unit/build 재실행도 실제로 일어났음을 확인했다.
잔여 갭 둘은 모두 INFO 수준이다: ① 판별자(MB) mutation 검증이 여전히 수작업 절차로만
남아 있음(1라운드에서 이미 지적·의도적으로 유예됨, 재확인만), ② 이번에 새로 문서화된
Node-floor/`require(esm)` 결속을 지키는 자동화된 가드가 없어 유일한 방어선이 산문 경고뿐임(신규
관측). 둘 다 병합을 막을 사유는 아니다.

## 위험도

LOW
