# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 의존성 없음 — 기존 의존성의 메이저 버전 업이며 필요성이 문서화됨
  - 위치: `codebase/backend/package.json:44` (`"@nestjs/typeorm": "^12.0.1"`)
  - 상세: 신규 패키지가 아니라 기존 `@nestjs/typeorm` 을 `^11.0.3` → `^12.0.1` 로 올린 것. `plan/in-progress/deps-typeorm12.md` §A 가 막혀 있던 dependabot PR(`#1339`)의 peer 를 패키지 단위로 재검증해 `@nestjs/common`/`@nestjs/core` ^10||^11||^12 를 모두 허용함을 확인했고, 이는 `pnpm-lock.yaml` 의 실제 `peerDependencies` 항목과 정확히 일치한다(아래 참조). 필요성·근거가 명확하다.
  - 제안: 없음(양호).

- **[INFO]** 버전 고정(pinning) 방식 — 기존 관례와 일치
  - 위치: `codebase/backend/package.json:44`
  - 상세: `^12.0.1` caret range. 프로젝트의 다른 모든 `@nestjs/*` 항목도 동일하게 caret 을 쓰고 있어(예: `@nestjs/common: ^11.0.1`) 일관성이 유지된다. `pnpm-lock.yaml` 의 `--strict-peer-dependencies --frozen-lockfile` 통과가 체크리스트에 기록돼 있고, 실제 lockfile diff(`pnpm-lock.yaml:92-96`)도 `specifier: ^12.0.1` / `version: 12.0.1(...)` 로 정확히 반영돼 있음을 확인했다.

- **[INFO]** 라이선스 — MIT, 프로젝트(UNLICENSED, private)와 충돌 없음
  - 위치: `pnpm-lock.yaml:2543-2549` (신규 `'@nestjs/typeorm@12.0.1'` 리졸루션 블록)
  - 상세: 실제 설치된 패키지(`node_modules/.pnpm/@nestjs+typeorm@12.0.1_.../package.json`)를 직접 열어 `"license": "MIT"` 를 확인했다. 이전 버전(11.0.3)도 MIT였으므로 라이선스 변경 없음.

- **[WARNING]** ESM 전용 패키지를 CJS 런타임에 편입 — 검증은 됐으나 향후 Node 버전 하향 시 재파손 가능
  - 위치: `pnpm-lock.yaml:2543-2545` (`'@nestjs/typeorm@12.0.1'` 블록의 `engines: {node: '>=20.19.0'}`), `codebase/backend/package.json:132-134` (`"engines": {"node": ">=24"}`)
  - 상세: 실제 설치본을 열어 확인한 결과 `@nestjs/typeorm@12.0.1` 은 `"type": "module"` (순수 ESM, `main: ./dist/index.js`, CJS 빌드 산출물 없음)이다. 반면 이 저장소의 백엔드는 `nest build` 로 **CJS** 산출물을 유지하는 것이 방침이다(`plan/.../nestjs-v12-coordinated-upgrade.md` §D). CJS 코드가 `require('@nestjs/typeorm')` 로 이 패키지를 로드하려면 Node 의 네이티브 "synchronous `require(esm)`" 지원이 필요하고, 그 기능이 stable/unflagged 로 들어온 최소 버전이 바로 패키지가 요구하는 `node >=20.19.0` 이다. 프로젝트 `engines.node: ">=24"` 는 이 요구를 넉넉히 만족하며, plan 체크리스트의 `build PASS (Docker 포함)` · `e2e 380 PASS` 가 실제 런타임 로드까지 검증했다는 증거다. 다만 이 조합(ESM 전용 의존성 + CJS 런타임)은 Node 최소 버전을 낮추는 미래 변경이 있으면 조용히 깨질 수 있는 암묵적 결합이므로, `engines.node` 하향 시 이 사실을 재확인해야 한다는 점을 기록해 둔다.
  - 제안: `engines.node` 를 낮추는 별도 PR이 생기면 그 PR의 검증 항목에 "`@nestjs/typeorm` require(esm) 로드 확인"을 명시적으로 추가할 것.

- **[WARNING]** `pnpm-lock.yaml` diff 가 plan 의 "한 줄" 서술보다 넓다 — 무관한 optional 패키지 메타데이터가 대량으로 변경됨
  - 위치: `pnpm-lock.yaml` 여러 곳 — 예 1241행·1798행·2328행·2596행·3334행·3963행 부근(게이트 있는 컨텍스트 줄) 각각의 `@css-inline/*`, `@img/sharp-libvips-*`/`@img/sharp-*`, `@napi-rs/canvas-*`, `@next/swc-*`, `@parcel/watcher-*` 블록
  - 상세: 실측(`git diff origin/main -- pnpm-lock.yaml`)으로 확인한 결과, 의도한 의존성 변경(`@nestjs/typeorm` specifier/resolution/peerDependencies)을 제외한 나머지 **63줄이 전부 `libc: [glibc]` / `libc: [musl]` 필드 삭제**였다. 해당 optional 플랫폼 패키지들은 버전·integrity 해시가 전혀 바뀌지 않았는데도 이 필드만 사라졌다 — 즉 실제로 재해석(re-resolve)된 패키지가 아니라 lockfile 메타데이터만 갱신된 것이다. `pnpm --version` 이 저장소가 고정한 `packageManager: pnpm@10.23.0` 과 일치함을 확인했으므로 pnpm 버전 드리프트가 원인은 아니며, 레지스트리 캐시 메타데이터가 설치 시점에 따라 달라진 부수 효과로 보인다(pnpm 이 optional dependency 의 `cpu`/`os`/`libc` 필드를 매 install 마다 레지스트리에서 다시 미러링하는 것으로 알려진 동작). 기능적 영향은 낮아 보인다 — plan 체크리스트의 Docker build·e2e 380 통과가 실제 설치 결과가 정상 동작함을 보여준다. 그러나 "이 PR 은 한 줄이다"(`plan/in-progress/deps-typeorm12.md:28`)라는 서술은 lockfile 수준에서는 정확하지 않고, 검토자가 실제 diff 를 보지 않으면 놓칠 수 있는 대량의 무관한 변경이 섞여 있다는 점은 기록해 둘 가치가 있다.
  - 제안: 향후 유사 PR 에서 `pnpm-lock.yaml` diff 를 `git diff --stat`/`numstat` 으로 미리 확인해, 의도한 패키지 외에 재해석된 항목이 있는지 plan 문서에 한 줄이라도 남기는 습관을 권장. 기능 검증(빌드/e2e)이 이미 통과했으므로 이번 PR 자체를 막을 사유는 아님.

- **[INFO]** 취약점 — 알려진 CVE 없음
  - 위치: `codebase/backend/package.json:44`
  - 상세: `@nestjs/typeorm` 은 NestJS 공식 TypeORM 통합 wrapper 로 코드량이 작고, 실 데이터 접근 로직을 갖는 `typeorm` 본체(`0.3.31`, 이번 PR에서 불변)와 분리돼 있다. 이번 버전업 자체가 보안 취약점 패치 목적은 아니며, 조사 범위 내에서 12.0.1 에 특정된 알려진 취약점은 확인되지 않았다.

- **[INFO]** 불필요한 의존성 여부 — 해당 없음
  - 상세: 표준 라이브러리나 기존 의존성으로 대체 가능한 신규 패키지가 아니라, 이미 필수적으로 쓰이는 ORM 통합 계층의 정합 버전업이다.

- **[INFO]** 의존성 크기 / 빌드 시간 영향 — 미미
  - 상세: 동일 패키지의 마이너/메이저 버전 교체이며 번들에 새 트리가 추가되지 않는다. 체크리스트에 `build PASS (Docker 포함)` 이 기록돼 있어 빌드 시간 회귀는 관측되지 않은 것으로 보인다(별도 시간 실측치는 plan 에 없음).

- **[INFO]** 호환성 — peer dependency 정합성 실측·검증됨
  - 위치: `pnpm-lock.yaml:2546-2549`
  - 상세: `@nestjs/typeorm@12.0.1` 의 `peerDependencies` 가 `@nestjs/common`/`@nestjs/core` 에 대해 `^10.0.0 || ^11.0.0 || ^12.0.0` 을 명시하고, 이 저장소는 그 외 `@nestjs/*` 를 전부 11.x 로 유지한다(`codebase/backend/package.json:29-45` 전체 확인, `@nestjs/typeorm` 한 줄만 변경). `--strict-peer-dependencies --frozen-lockfile` 로 clean 하다는 체크리스트 서술이 이 lockfile 실측과 일치한다. `nestjs-v12-coordinated-upgrade.md` 가 별도로 시도했다가 되돌린 전면 12 업그레이드(§0)의 세 가지 벽(`@nestjs-modules/mailer` 타이핑 불가·`@nestjs/throttler` 타이핑 불가·`@nestjs/cli`/`schematics` 의 TypeScript 6 강제)를 이번 PR 범위에서 건드리지 않은 것도 확인했다 — 스코프가 정확히 `@nestjs/typeorm` 한 패키지로 격리돼 있다.

- **[INFO]** 내부 의존성(워크스페이스) — 영향 없음
  - 상세: `@workflow/*` workspace 패키지들(`ai-end-reason`, `chat-channel-validation`, `expression-engine`, `graph-warning-rules`, `masked-markers`, `node-summary`)은 이번 diff 에서 변경되지 않았다. `@nestjs/typeorm` 은 이들 워크스페이스 패키지와 직접적인 의존 관계가 없다.

## 요약

이번 변경은 `@nestjs/typeorm` 단일 패키지를 `^11.0.3` → `^12.0.1` 로 올리는 범위가 명확한 의존성 업그레이드다. peer dependency 호환성(`^10||^11||^12`)을 패키지 단위로 실측해 나머지 `@nestjs/*` 를 11.x 로 유지한 채 진행했고, 그 실측이 lockfile 의 실제 `peerDependencies` 항목과 정확히 일치함을 직접 확인했다. 라이선스(MIT)는 문제없고, 새 의존성도 없으며, 전면 v12 업그레이드에서 실측된 세 가지 진짜 장벽(mailer·throttler 타이핑, TS 6 요구)은 이번 PR 범위 밖으로 정확히 격리돼 있다. 두 가지는 기록해 둘 가치가 있다 — (1) 이 패키지가 순수 ESM(`type: module`)이고 CJS 런타임에서 Node 의 네이티브 `require(esm)` 지원(`engines: node >=20.19.0`)에 의존해 로드되는데, 현재 `engines.node >=24` 로 충분히 커버되지만 향후 Node 버전을 낮추는 변경이 있으면 이 결합이 재검토돼야 한다는 점, (2) `pnpm-lock.yaml` diff 의 상당 부분(63줄)이 의도한 변경과 무관한 다수 optional 플랫폼 패키지의 `libc` 메타데이터 제거였다는 점 — 버전/integrity 는 불변이라 실질 위험은 낮지만 plan 의 "한 줄" 서술보다 실제 diff 범위가 넓다. 두 항목 모두 빌드·e2e 통과로 이미 기능적으로 커버돼 있어 병합을 막을 사유는 아니다.

## 위험도

LOW
