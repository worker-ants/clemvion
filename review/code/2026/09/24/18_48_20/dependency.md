# 의존성(Dependency) 리뷰

이 라운드(`18_48_20`)는 1라운드(`review/code/2026/09/24/18_22_23`)의 dependency WARNING 2건에 대한
조치(`RESOLUTION.md`)가 실제로 반영됐는지를 `origin/main` 대비 실측으로 재확인하는 재검토다.
핵심 코드 변경은 여전히 `codebase/backend/package.json` 의 `@nestjs/typeorm` 단일 캐럿 범위
`^11.0.3` → `^12.0.1` 한 줄이며, 이번 라운드에 추가된 파일들은 대부분 1라운드 리뷰 산출물
(`SUMMARY.md`/`RESOLUTION.md`/에이전트별 `.md`/`_retry_state.json`)과 consistency-check 산출물이라
그 자체는 애플리케이션 의존성이 아니다.

## 발견사항

- **[INFO]** 새 의존성 없음 — 기존 패키지의 메이저 버전 업
  - 위치: `codebase/backend/package.json:44` (`"@nestjs/typeorm": "^12.0.1"`)
  - 상세: 신규 외부 패키지가 아니라 이미 쓰던 `@nestjs/typeorm` 의 메이저 범프. `plan/in-progress/deps-typeorm12.md` §A 가 peer 를 패키지 단위로 재검증해 필요성을 문서화했다.
  - 제안: 없음.

- **[INFO]** 버전 고정 — 기존 caret 관례 유지, frozen-lockfile 검증됨
  - 위치: `codebase/backend/package.json:44`, `pnpm-lock.yaml:95-96`
  - 상세: 다른 `@nestjs/*` 항목(`codebase/backend/package.json:34-45,97-99` — common/core/config/jwt/passport/platform-express/platform-socket.io/swagger/throttler/websockets/cli/schematics/testing)과 동일한 caret 패턴. 직접 확인한 결과 나머지는 전부 `11.x` 로 유지돼 있고 `@nestjs/typeorm` 만 12 로 올라 있다.
  - 제안: 없음.

- **[INFO]** 라이선스 — MIT, 프로젝트(비공개)와 충돌 없음
  - 위치: `pnpm-lock.yaml:2569` (신규 `'@nestjs/typeorm@12.0.1'` resolution 블록)
  - 상세: 워크트리에 실제 설치된 `node_modules/.pnpm/@nestjs+typeorm@12.0.1_.../package.json` 을 직접 열어 `"license": "MIT"` 확인. 이전 버전(11.0.3)과 동일 라이선스라 변경 없음.

- **[INFO]** 취약점 — 조사 범위 내 알려진 CVE 없음
  - 위치: `codebase/backend/package.json:44`
  - 상세: `@nestjs/typeorm` 은 DI/모듈 배선만 담당하는 얇은 wrapper 이고, 실제 쿼리 실행 계층인 `typeorm` 코어(`^0.3.31`)와 DB 드라이버는 이번 diff 에서 불변이다.

- **[INFO]** 호환성 — peer range 실측이 lockfile 과 정확히 일치
  - 위치: `pnpm-lock.yaml:2572-2574` (`peerDependencies: '@nestjs/common': ^10.0.0 || ^11.0.0 || ^12.0.0`, `'@nestjs/core'` 동일)
  - 상세: 이 저장소는 `@nestjs/common`/`@nestjs/core` 를 `11.1.27` 로 유지한 채(package.json 전체 확인) `@nestjs/typeorm` 만 12 로 올렸다. peer range 가 `^10||^11||^12` 이므로 충돌 없음 — `pnpm --version` 이 고정본(`packageManager: pnpm@10.23.0`)과 일치함도 확인했다.

- **[INFO]** 의존성 크기 / 빌드 영향 — 미미
  - 상세: 같은 패키지의 in-place 교체이며 새 의존성 트리가 추가되지 않는다. `deps-typeorm12.md` 체크리스트에 `build PASS (Docker 포함)` 기록.

- **[INFO]** 내부 의존성(workspace) — 영향 없음
  - 상세: `@workflow/*` 워크스페이스 패키지들은 이번 diff 에서 변경되지 않았고 `@nestjs/typeorm` 과 직접 의존 관계도 없다.

- **[검증됨 — 1라운드 WARNING 1 해소 확인]** lockfile 스코프가 실제로 typeorm 변경분만으로 좁혀졌다
  - 위치: `pnpm-lock.yaml:92-99`(importers specifier/version), `pnpm-lock.yaml:2565-2576`(packages resolution/engines/peerDependencies), `pnpm-lock.yaml:12444-12450`(snapshots)
  - 상세: 1라운드 dependency.md 는 `libc:` 필드 63줄 삭제 + `eslint-plugin-import` peer 문자열 교환 2곳이 무관하게 섞여 있다고 지적했다(WARNING). `RESOLUTION.md` 는 원인(dependabot pnpm ↔ 고정 pnpm 진동)을 규명하고 opcode 단위로 typeorm 변경분만 재구성했다고 주장한다. 이를 신뢰하지 않고 직접 `git diff origin/main -- pnpm-lock.yaml` 로 재현했고, **실측 결과는 정확히 3-hunk·41줄(±약 15줄 실질 변경)이며 전부 typeorm 관련**이다 — `libc:` 변경도 `eslint-plugin-*` 변경도 0건. RESOLUTION 의 서술("15줄, 전부 typeorm")보다도 더 깨끗하다(RESOLUTION 은 최소화 "이전" lockfile 대비 서술이었고, 현재 상태는 origin/main 대비로도 순수하다). 조치가 실효적임을 독립 재현으로 확인.

- **[검증됨 — 1라운드 WARNING 3 해소 확인]** ESM-only 패키지의 CJS `require(esm)` 암묵 결합이 정확한 위치에 문서화됨
  - 위치: `PROJECT.md:88`
  - 상세: 1라운드는 `@nestjs/typeorm@12.0.1` 이 순수 ESM(`"type": "module"`, `engines: {node: ">=20.19.0"}`)이고 CJS 런타임이 Node 의 native `require(esm)` 에 의존해 로드한다는 점, 그리고 이것이 향후 `engines.node` 하향 시 "설치는 성공하고 부팅에서만 깨지는" 조용한 재파손 위험이라고 지적했다(WARNING). 조치는 이 사실을 "Node 지원 floor" 절 자체에 실측치(현재 floor 24, e2e 부팅 확인 2026-09-24)와 함께 박아 넣었다 — 미래에 그 floor 를 낮추려는 사람이 정확히 보게 될 자리다. 설치된 패키지 직접 확인(`"type": "module"`, `engines: {"node": ">=20.19.0"}`)으로 근거 수치도 재확인했다.

- **[INFO]** 별도 dependency-hygiene 이슈가 스코프 밖으로 정확히 분리·등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (약 5133-5159행 부근, 신규 체크박스 항목)
  - 상세: `libc:` 필드가 dependabot 이 쓰는 pnpm 과 저장소가 고정한 pnpm(`10.23.0`) 사이에서 진동하는 기존 결함(5개 커밋 방향 실측 — dependabot 은 항상 넣고 사람은 항상 뺌)을 이번 PR 의 스코프가 아니라고 판단해 백로그에 등재했다. 이번 PR 자체는 그 진동에 편입되지 않도록 opcode 단위로 걸러냈음을 위에서 확인했으므로 스코프 분리가 적절하다.

- **[INFO, 경미]** e2e 재검증은 lockfile 최소화 **이전** 결과(380 PASS)로 남아 있음
  - 위치: `review/code/2026/09/24/18_22_23/RESOLUTION.md` TEST 결과 표
  - 상세: lint/unit/build 는 최소화된 lockfile 로 재실행돼 PASS 했지만 e2e 는 재실행되지 않았다. 다만 위에서 확인했듯 최소화는 원본 대비 diff 를 "줄이기만" 했을 뿐(추가 변경 0) — 최소화 후 lockfile 은 최소화 전(e2e 가 실제로 검증한 상태)의 **부분집합**이라 새로운 미검증 표면은 없다. 위험은 낮다.

## 요약

핵심 변경은 `@nestjs/typeorm` `^11.0.3` → `^12.0.1` 단일 의존성 범프이며 신규 외부 패키지·라이선스 충돌·알려진 취약점이 없다. peer range(`^10||^11||^12`)와 lockfile 실측이 정확히 일치해 나머지 `@nestjs/*` 를 11.x 에 묶어 둔 "부분 메이저 범프" 도 호환성 문제가 없다. 1라운드에서 지적한 두 WARNING — (1) lockfile diff 가 무관한 63줄(optional 패키지 `libc:` + eslint-plugin peer 문자열)을 끌고 온 점, (2) ESM-only 패키지의 CJS `require(esm)` 암묵 결합이 문서화되지 않은 점 — 은 이번 라운드에서 각각 `pnpm-lock.yaml`(`git diff origin/main` 으로 재현: 이제 typeorm 관련 3-hunk 만 남음)과 `PROJECT.md:88`(Node 지원 floor 절에 실측치와 함께 명시)에 실효적으로 반영됐음을 독립적으로 재현·확인했다. 추가로 발견된 별도 dependency-hygiene 이슈(dependabot ↔ 고정 pnpm 사이 `libc:` 필드 진동)는 이번 PR 스코프 밖으로 적절히 분리돼 백로그에 등재됐다. 신규 Critical/Warning 없음.

## 위험도

LOW
