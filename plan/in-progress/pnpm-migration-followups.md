---
worktree: pnpm-migration-followups-b97d48
started: 2026-06-20
owner: developer
---

# pnpm 마이그레이션 — 후속 과제

> npm → pnpm workspace 전환 PR(`build(deps): npm → pnpm workspace 모노레포 전환`)에서
> 핵심 전환(매니페스트·lockfile·Docker·CI·하니스·문서)을 완료하고 build/unit/e2e 로 검증했다.
> 아래는 그 PR 의 `/ai-review`(0 Critical / 10 Warning) 에서 **별도 PR 로 분리하기로 결정한**
> 항목들이다. 마이그레이션의 정합성·동작에는 영향이 없으나 최적화·정리 성격.

## 1. backend 프로덕션 이미지 devDependencies 제거 (review WARNING #1, 우선)

`codebase/backend/Dockerfile` runner 가 `COPY --from=builder /app ./` 로 빌드 산출물
전체(devDeps 포함)를 옮긴다 — **정합성 위해 단순 채택**했으나 이미지 크기·공격 표면 증가.

- 옵션 A: `pnpm deploy --filter backend --prod <dir>` (단 gitignored `dist` 제외 문제 — `files` 필드 또는 deploy 후 dist 별도 처리 필요).
- 옵션 B: 전용 prod-deps 스테이지에서 `pnpm install --prod --frozen-lockfile --filter "backend..."` 후 dist + prod node_modules 만 COPY.
- frontend 는 이미 Next standalone 으로 pruned (해당 없음).
- 검증: docker build + e2e + 이미지 크기 before/after.

**완료(2026-07-12, PR pnpm-migration-followups)**: 옵션 B 변형 — 신규 `prod-deps` 스테이지(`FROM builder` + `CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)에서 devDeps 를 prune 한 뒤 runner 가 통째 COPY. `pnpm install --prod` 가 modules 를 재구성하므로 `--ignore-scripts` 없이 native(bcrypt/isolated-vm)·내부 패키지 prepare 를 재빌드(빌드툴은 deps 스테이지 존재), 비대화형이라 `CI=true`. hoisted node_modules layout(root + backend 로컬 `@workflow` 링크)·built dist 보존. 검증: docker build 성공 + e2e(253) 무회귀 + 이미지 **1.4GB → 1.23GB**.

> **스코프 정직화(ai-review 23_21_17 실측)**: 이 170MB 절감은 **backend 자신의 devDeps(jest/eslint/ts-jest 등)** 제거분이다. **더 큰 덩어리는 남아 있다** — `node-linker=hoisted` 가 워크스페이스를 단일 flat `node_modules` 로 구체화해, `--filter "backend..."` 설치인데도 **프런트엔드 스택(`next` 169MB·`@next` 238MB(native SWC 포함)·webpack·react-dom ≈ 415MB, 최종 이미지의 ~33%)이 backend 이미지에 잔존**한다(typescript/ts-node 도 hoist 로 잔존). 본 diff 회귀 아님(구 builder 동일) — hoisted 특성. 원본 TS 소스 전체도 runner 에 잔존(dist 선별 COPY 안 함).
>
> **후속(별도)**: (a) **프런트엔드 스택·원본소스 제거** — §3(`node-linker=hoisted`→`strict` 전환)으로 backend node_modules 에서 타 프로젝트 deps 격리, 또는 기각됐던 옵션 A(`pnpm deploy --filter backend --prod <dir>`)로 self-contained prod dir 생성. 이미지 크기의 대부분을 좌우해 우선순위 높음. (b) **devDeps 부재 CI 스모크 가드** — 이미지 내 `node_modules/jest` 부재 assert 등으로 prod-deps 우회·오변경 자동 포착(현재 1회성 수기 검증뿐, ai-review testing WARNING).

## 2. @nestjs/swagger 11.2.7 핀 제거 + deep-import 정리 (review WARNING #6 / INFO #3,#18)

`codebase/backend/src/common/swagger/api-wrapped.ts` 가 `@nestjs/swagger/dist/interfaces/open-api-spec.interface`
(`SchemaObject`) **deep-import** 을 쓰는데 swagger 11.4.x 의 `exports` 가 이 내부 경로를 차단한다.
마이그레이션은 버전 중립성 위해 루트 `pnpm.overrides` 로 11.2.7 에 핀했다(보안 패치 영구 차단 위험).

- deep-import 를 공개 경로로 교체 (SchemaObject 공개 re-export 없음 → openapi3-ts 등 대체 타입 소스 조사).
- 교체 완료 시 `pnpm.overrides["@nestjs/swagger"]` 핀 제거 (= **이 작업의 명시적 완료 조건**).
- 11.2.7 → 11.4.x changelog 의 보안 수정 여부 확인해 우선순위 결정.

**조사(2026-07-12, defer)**: 실측 — `@nestjs/swagger` 11.2.7 은 `SchemaObject` 를 root 로 공개 export 하지 않고(`'SchemaObject' in require('@nestjs/swagger')` = false) openapi3-ts 를 의존하지도 않는다(미설치). 완료하려면 (a) `openapi3-ts` **신규 devDep 추가** + deep-import 3곳(`api-wrapped.ts` + EIA 응답 DTO spec 2곳: `execution-status-response.dto.spec.ts`·`interact-ack-response.dto.spec.ts`) 교체 + 타입 호환 검증, (b) 핀 제거 → 11.2.7→11.4.x **버전 bump** 의 `SwaggerModule.createDocument` 출력 회귀 검증. 신규 의존성 + 버전 bump 리스크(DTO 스키마 회귀 테스트 다수 의존)라 별 focused PR 로 분리한다. 보안 측면(11.2.7 핀이 패치 영구 차단)에서 우선순위는 있음.

## 3. node-linker=hoisted → strict 점진 전환 (review INFO #9)

`.npmrc` 가 NestJS/Next standalone·native dep 호환을 위해 `node-linker=hoisted`(flat) 로 출발했다.
green 안정 후 strict isolation 으로 좁혀 phantom-dependency 위생을 강제하는 것을 검토.

## 4. 기타 (low)

- Docker `COPY codebase/packages` 패키지별 분리(INFO #4) — 캐시 효율 vs 복잡도 트레이드오프.
- playwright-runner 사전 빌드 이미지로 매 실행 `pnpm install` 제거(INFO #5).
- js-yaml moderate accept 의 CVE ID·영향 경로 문서화(INFO #2,#16) — `pnpm why js-yaml` 추적.
