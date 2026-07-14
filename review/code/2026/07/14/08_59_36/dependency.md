# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 추가 없음 (긍정 확인)
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts`, `execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`
  - 상세: deep-import(`@nestjs/swagger/dist/interfaces/open-api-spec.interface`)를 대체하며 `openapi3-ts` 같은 신규 패키지를 추가하지 않고 이미 공개된 `ApiResponseSchemaHost['schema']`에서 타입을 파생시켰다. `node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.d.ts`에서 `ApiResponseSchemaHost extends Omit<ResponseObject, 'description'>`이고 `ResponseObject.schema?: SchemaObject | ReferenceObject`임을 직접 확인했다 — 파생이 구조적으로 유효하다. 또한 실제 설치된 `@nestjs/swagger@11.4.5/package.json`의 `exports` 맵이 `"."`, `"./plugin"`, `"./package.json"`만 허용해 기존 deep-import 경로가 실제로 차단됨을 확인했다 (npm registry 메타데이터 비교 결과 `exports` 필드는 11.4.3부터 도입되어 11.4.0~11.4.2/11.2.7/11.3.0에는 없었음 — "11.4.x부터 차단"이라는 서술이 정확).
  - 제안: 없음 (모범적 처리 — 향후 유사 상황에서 "신규 의존성보다 공개 API 파생"을 우선 검토하는 참고 사례로 남길 만함).

- **[INFO]** 버전 고정(override 핀) 제거가 canonical 위치까지 정확히 반영됨
  - 위치: `pnpm-workspace.yaml`(overrides 블록), `pnpm-lock.yaml`(overrides + importers.codebase/backend.dependencies)
  - 상세: `git show`로 확인한 결과 `pnpm-workspace.yaml`의 `overrides` 블록에서 `"@nestjs/swagger": 11.2.7`(및 그 사유를 설명하던 `# swagger-pin:` 주석)이 함께 제거되었고, `pnpm-lock.yaml`의 top-level `overrides:` 목록에서도 동일하게 제거되었다. 두 파일이 어긋나지 않아 "정규 위치(pnpm-workspace.yaml)에 남은 고아 override"가 없다. 새 range `^11.4.5`는 같은 `package.json` 안의 다른 `@nestjs/*` 패키지들(`^11.0.1`, `^11.1.17` 등)과 동일하게 caret range를 쓰는 프로젝트 관례를 따른다 — exact-pin이 아니라 정상적인 semver 추종으로 복귀했다.
  - 제안: 없음.

- **[INFO]** 라이선스 호환성 문제 없음
  - 위치: `codebase/backend/package.json` (`@nestjs/swagger` ^11.2.7 → ^11.4.5), `pnpm-lock.yaml` (`swagger-ui-dist` 5.32.2 → 5.32.8, 전이)
  - 상세: 설치된 `node_modules/@nestjs/swagger/package.json`은 `"license": "MIT"`, `node_modules/swagger-ui-dist/package.json`은 `"license": "Apache-2.0"`으로 버전 변경 전후 라이선스 계열이 동일하다. 백엔드는 `"license": "UNLICENSED"`(private)이므로 두 라이선스 모두 사용에 문제 없다.
  - 제안: 없음.

- **[INFO]** 알려진 취약점 관점: 이번 버전 변경 자체가 특정 CVE를 해소하는 것은 아님
  - 위치: `@nestjs/swagger` 11.2.7 → 11.4.5
  - 상세: `pnpm audit`(현재 lockfile 기준)을 실행한 결과 `@nestjs/swagger`·`swagger-ui-dist` 관련 advisory는 0건이었다. 즉 커밋 메시지의 "보안 패치 영구 차단 해소"는 활성 CVE를 직접 고친다는 뜻이 아니라, exact-pin override 때문에 향후 나올 보안 패치를 구조적으로 못 받는 상태를 없앤다는 예방적 조치로 해석하는 것이 정확하다. 이 프레이밍은 타당하다.
  - GitHub Releases(11.3.0~11.4.5) 확인 결과 이 구간에는 "BREAKING CHANGE"로 명시된 항목이 없고 버그 수정·기능 추가 위주였다(`js-yaml`/`swagger-ui-dist` 전이 의존성 보안 패치 포함: 11.4.5 changelog에 "fix(deps): update dependency js-yaml to v4.2.0 [security]" 존재 — swagger 자신의 전이 의존성 취약점 해소).
  - 제안: 없음 (참고 정보).

- **[WARNING]** "lockfile churn은 swagger + swagger-ui-dist뿐" 서술이 실제 diff와 불일치
  - 위치: 커밋 `3f1df0dcd` 메시지 및 태스크 설명 — "lockfile churn 은 swagger 11.2.7→11.4.5 + swagger-ui-dist 5.32.2→5.32.8(전이)만"
  - 상세: `pnpm-lock.yaml` diff를 직접 대조한 결과 다음의 **swagger와 무관한** 추가 변경이 존재한다.
    - `js-yaml@3.14.2 → 3.15.0` (소비자: `@istanbuljs/load-nyc-config` — jest coverage 설정 로더, swagger와 무관. 참고로 이 범위(<3.15.0)는 실제로 `pnpm audit`에서 moderate CVE-2026-53550(GHSA-h67p-54hq-rp68, js-yaml merge-key 이차 DoS)로 잡히지만, 그 취약점이 남아있는 실제 소비처는 `codebase/frontend > gray-matter > js-yaml@3.14.2`이고 이번 diff에서 그쪽은 그대로 3.14.2로 남아있어 이 CVE는 사실상 해결되지 않았다 — 아래 별도 INFO 참고)
    - `cosmiconfig`용 `js-yaml@4.2.0 → 4.3.0` (두 스냅샷: `cosmiconfig@8.3.6`, `cosmiconfig@9.0.2` — swagger의 자체 `js-yaml@4.1.1→4.3.0`과는 별개 소비처)
    - `@napi-rs/wasm-runtime@1.1.5 → 1.1.6`, 신규 `@tybys/wasm-util@0.10.3`(기존 0.10.2 병존), 신규 `nanoid@3.3.16`(기존 3.3.13 병존), 신규 `picomatch@4.0.5`(기존 4.0.4 병존), 신규 `postcss@8.5.19` — 모두 `vite@8.0.16` 스냅샷이 `picomatch: 4.0.4→4.0.5`, `postcss: 8.5.15→8.5.19`로 갱신되며 딸려온 것으로, `rolldown`/`vite` 빌드 툴체인 계열이며 swagger 그래프와 무관하다.
  - 신규 top-level 패키지나 major 버전 점프는 아니며 전부 기존에 선언된 semver range 내 patch/minor 재해석으로 보인다(락파일 전체 재생성 시 pnpm이 "만족하는 최신"을 다시 골라 생긴 부수 효과로 추정). 기능적 위험은 낮지만, "이 변경 하나만 churn했다"는 검증 서술 자체는 부정확하다.
  - 제안: (a) 커밋 메시지의 사실관계를 정정하거나, (b) 이 워크트리의 base가 최신 main과 정합한지 재확인할 것(`.claude/docs`에 기록된 "ensure-worktree stale base" 사례처럼, stale base에서 lockfile을 재생성하면 무관한 해석 변경이 섞여 들어올 수 있음). 최소한 리뷰 기록에는 "swagger 외 vite/jest-coverage 계열 patch bump 동반, 신규 패키지·major 점프 없음"으로 정확히 남길 것을 권장.

- **[INFO]** (본 diff 범위 밖, 참고용) `gray-matter → js-yaml@3.14.2`에 moderate CVE 잔존
  - 위치: `codebase/frontend`의 전이 의존성 `gray-matter@4.0.3 → js-yaml@3.14.2`
  - 상세: `pnpm audit` 결과 CVE-2026-53550(GHSA-h67p-54hq-rp68, js-yaml merge-key 이차 복잡도 DoS, moderate, patched: >=3.15.0)이 이 경로에 남아 있다. 이번 PR과 무관하고 이번 diff가 만들지도, 고치지도 않았지만(같은 lockfile 안에 `js-yaml@3.15.0`이 다른 소비처용으로 이미 존재하는 것을 보고 혼동하지 않도록 명시), 백로그로 별도 추적할 가치가 있다.
  - 제안: 별도 티켓/백로그 항목으로 `gray-matter` 업데이트 또는 `js-yaml` override 검토(이 PR 범위에 포함시키지 말 것).

- **[INFO]** 내부 의존성 — 버전 호환 shim 타입이 3곳에 중복 선언됨
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts:210`, `.../execution-status-response.dto.spec.ts:463`, `.../interact-ack-response.dto.spec.ts:679`
  - 상세: `type SchemaObject = ApiResponseSchemaHost['schema'];`와 그 설명 주석이 세 파일에 동일하게 복붙되어 있다. `api-wrapped.ts`가 이미 이 shim의 원 출처인데, 두 spec 파일은 이를 import하지 않고 재선언한다. 향후 swagger 버전이 또 바뀌어 이 파생 방식을 수정해야 할 때 세 곳을 모두 손봐야 하는 유지보수 부담이 생긴다.
  - 제안: `api-wrapped.ts`에서 `SchemaObject`를 `export type`으로 내보내고 두 spec 파일은 그것을 import하도록 정리(또는 공용 `swagger-test-types.ts` 같은 얇은 공유 모듈로 추출). 기능에는 영향 없는 사소한 개선이라 이번 PR 블로킹 사유는 아님.

- **[INFO]** peerDependencies 호환성 확인
  - 위치: `@nestjs/swagger@11.4.5`의 `peerDependencies`
  - 상세: 설치된 `node_modules/@nestjs/swagger/package.json`을 직접 확인한 결과 `@nestjs/common: ^11.0.1`, `@nestjs/core: ^11.0.1`, `reflect-metadata: ^0.1.12 || ^0.2.0`, `class-transformer/class-validator: '*'`로 11.2.7 시절과 동일한 요구조건이며, 워크스페이스에 고정된 `@nestjs/*@11.1.27` 계열과 완전히 호환된다. 버전 상향으로 인한 peer 충돌 없음.
  - 제안: 없음.

## 요약

핵심 변경(exact-pin override 제거 + `@nestjs/swagger` ^11.2.7→^11.4.5 상향 + deep-import를 공개 타입 파생으로 교체)은 기술적으로 건전하고 검증도 충실하다: 신규 의존성 없음, 라이선스 동일(MIT/Apache-2.0), peerDependencies 불변·호환, 활성 CVE를 직접 고치는 변경은 아니지만 향후 보안 패치가 영구 차단되던 구조적 문제를 해소하는 타당한 예방 조치이며, `plan/in-progress/pnpm-migration-followups.md` §2에 이미 추적되던 항목을 원래 검토안(openapi3-ts 신규 추가)보다 더 나은 방식(공개 API 파생)으로 완료했다. 다만 커밋 메시지가 주장하는 "lockfile churn은 swagger 관련뿐"이라는 검증 서술은 실제 diff와 다르다 — vite/rolldown 빌드 툴체인 및 jest coverage 계열의 무관한 patch 버전들(js-yaml, picomatch, postcss, nanoid, @napi-rs/wasm-runtime, @tybys/wasm-util)이 함께 재해석되어 들어갔다. 신규 패키지나 major 점프는 없어 기능적 리스크는 낮지만, 검증 주장과 실제 결과의 불일치이므로 기록을 정정하거나 base 정합성을 재확인할 것을 권장한다. 그 외 3개 파일에 중복 선언된 shim 타입은 사소한 유지보수 개선 여지다.

## 위험도

LOW
