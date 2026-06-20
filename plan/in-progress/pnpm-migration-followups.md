---
worktree: (unstarted)
started: 2026-06-20
owner: developer (TBD)
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

## 2. @nestjs/swagger 11.2.7 핀 제거 + deep-import 정리 (review WARNING #6 / INFO #3,#18)

`codebase/backend/src/common/swagger/api-wrapped.ts` 가 `@nestjs/swagger/dist/interfaces/open-api-spec.interface`
(`SchemaObject`) **deep-import** 을 쓰는데 swagger 11.4.x 의 `exports` 가 이 내부 경로를 차단한다.
마이그레이션은 버전 중립성 위해 루트 `pnpm.overrides` 로 11.2.7 에 핀했다(보안 패치 영구 차단 위험).

- deep-import 를 공개 경로로 교체 (SchemaObject 공개 re-export 없음 → openapi3-ts 등 대체 타입 소스 조사).
- 교체 완료 시 `pnpm.overrides["@nestjs/swagger"]` 핀 제거 (= **이 작업의 명시적 완료 조건**).
- 11.2.7 → 11.4.x changelog 의 보안 수정 여부 확인해 우선순위 결정.

## 3. node-linker=hoisted → strict 점진 전환 (review INFO #9)

`.npmrc` 가 NestJS/Next standalone·native dep 호환을 위해 `node-linker=hoisted`(flat) 로 출발했다.
green 안정 후 strict isolation 으로 좁혀 phantom-dependency 위생을 강제하는 것을 검토.

## 4. 기타 (low)

- Docker `COPY codebase/packages` 패키지별 분리(INFO #4) — 캐시 효율 vs 복잡도 트레이드오프.
- playwright-runner 사전 빌드 이미지로 매 실행 `pnpm install` 제거(INFO #5).
- js-yaml moderate accept 의 CVE ID·영향 경로 문서화(INFO #2,#16) — `pnpm why js-yaml` 추적.
