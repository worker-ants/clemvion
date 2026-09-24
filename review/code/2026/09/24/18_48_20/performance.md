# 성능(Performance) 리뷰 — `@nestjs/typeorm` 11→12 + 1라운드 리뷰 산출물 반영 (deps-typeorm12, 2라운드)

## 발견사항

- **[INFO]** 애플리케이션 실행 코드(`codebase/backend/src/**`) 변경 없음 — 성능 표면 자체가 diff 에 없음
  - 위치: `codebase/backend/package.json:44`(`@nestjs/typeorm`: `^11.0.3` → `^12.0.1`)
  - 상세: 이번 라운드(2라운드) diff 는 (1) `PROJECT.md` 의 Node 지원 floor 서술 보강, (2) `codebase/backend/package.json` 의 `@nestjs/typeorm` 캐럿 한 줄, (3) `pnpm-lock.yaml` typeorm 관련 15줄, (4) `plan/in-progress/*.md` 문서 갱신, (5) 1라운드 `/ai-review`·`/consistency-check` 산출물(`review/code/…/18_22_23/*`, `review/consistency/…/17_31_27/*`)의 커밋으로 구성된다. 알고리즘·N+1·캐싱·블로킹 I/O·메모리·자료구조·지연 로딩 등 이 리뷰의 8개 점검 관점이 대상으로 삼는 실행 경로 코드가 diff 에 존재하지 않는다. 이는 1라운드 performance 리뷰(`review/code/2026/09/24/18_22_23/performance.md`, 위험도 NONE)와 동일한 결론이며 이번 라운드에서도 반증되지 않았다.
  - 제안: 해당 없음 (정보성).

- **[INFO]** lockfile 이 1라운드 지적(W1)대로 typeorm 변경분만으로 좁혀짐 — 이전 라운드에서 지적했던 "무관 optional 패키지 `libc:` 필드 63줄" 노이즈가 이번 diff 에는 나타나지 않음
  - 위치: `pnpm-lock.yaml` (`@nestjs/typeorm` 관련 3개 hunk, 총 15줄)
  - 상세: 1라운드 performance 리뷰는 lockfile 재포맷 노이즈를 "성능 영향 없음"으로 판정하면서도 diff 오독 위험을 INFO 로 남겼다. `plan/in-progress/deps-typeorm12.md` §B 와 `RESOLUTION.md` W1 조치에 따르면 이번 diff 는 opcode 단위로 typeorm 변경분만 채택해 15줄로 좁혔다 — lockfile 파싱·설치 시간에 영향을 주는 무관 메타데이터 변동이 사라졌다는 점에서 (미미하나마) 리뷰·설치 검증 부담이 줄었다. 성능 관점에서 조치 불필요, 개선 확인만 기록.
  - 제안: 없음.

- **[INFO]** `@nestjs/typeorm@12.0.1` 은 ESM-only(`type: module`) — `require(esm)` 경로로 로드되며 콜드스타트 시 미세한 로딩 경로 변화 가능성이 있으나 이번 diff 범위에서 실측 대상 아님
  - 위치: `pnpm-lock.yaml` (`@nestjs/typeorm@12.0.1` 블록, `engines: {node: '>=20.19.0'}`), `PROJECT.md` Node 지원 floor 문단
  - 상세: Node 의 native `require(esm)` 은 CJS `require()` 대비 모듈 로딩 시 약간의 오버헤드가 있을 수 있으나(첫 로드 1회성, 애플리케이션 부팅 시점), DI 배선 레이어 하나의 로딩 비용은 무시할 수준이고 이번 PR 의 `plan/in-progress/deps-typeorm12.md` §C·D 및 1라운드 `RESOLUTION.md` TEST 결과(build/e2e PASS)가 이미 부팅 성공을 실측으로 확인했다. 이는 정확성(부팅 성공 여부) 이슈이지 성능 회귀는 아니므로 별도 성능 조치는 불필요. 이미 dependency 리뷰(W3)가 별도 트랙(engines floor 하향 시 재검증)으로 관리 중이라 이 리뷰에서 중복 지적하지 않는다.
  - 제안: 없음 (dependency 리뷰 W3 조치로 충분).

- **[INFO]** `typeorm` 코어(`^0.3.31`) 및 실제 쿼리 실행·커넥션 풀 로직 불변 — 쿼리 성능·N+1·커넥션 풀 설정에 영향 없음
  - 위치: `codebase/backend/package.json` (`"typeorm": "^0.3.31"`, 미변경), `pnpm-lock.yaml` (`typeorm@0.3.31` 의존 트리 그대로)
  - 상세: `@nestjs/typeorm` 은 `TypeOrmModule.forRoot/forFeature`·`@InjectRepository` 등 DI 배선만 제공하는 얇은 통합 레이어이고, 실제 쿼리 빌더·커넥션 풀·트랜잭션 처리는 `typeorm` 코어가 담당한다. 코어 버전이 고정돼 있으므로 쿼리 실행 경로에 실질적 변화가 없다.
  - 제안: 없음.

- **[INFO]** 신규 커밋된 `review/**` 산출물(리뷰 세션 아카이브)이 저장소 크기를 계속 누적 — 성능 영향은 리포지토리 clone/checkout 규모로 국한, 런타임과 무관
  - 위치: `review/code/2026/09/24/18_22_23/**` (RESOLUTION.md·SUMMARY.md·14개 reviewer 산출물·`_retry_state.json` 등), `review/consistency/2026/09/24/17_31_27/**`
  - 상세: 이 라운드에서 새로 diff 에 포함된 파일의 다수가 1라운드 리뷰/consistency-check 산출물이다. 프로젝트 규약(`CLAUDE.md`)상 정상적인 저장 위치이며 애플리케이션 런타임 성능과는 무관하다 — repo clone 크기 증가라는 부수 효과만 있고, 이는 CI/개발자 워크플로 차원의 문제로 이 리뷰(애플리케이션 성능) 스코프 밖이라 조치 불요.
  - 제안: 없음 (참고용, 조치 불필요).

## 요약

이번 diff 는 `@nestjs/typeorm` `^11.0.3` → `^12.0.1` 의존성 범프(코드 변경 0줄)와 1라운드 `/ai-review`·`/consistency-check` 산출물 커밋, 관련 plan 문서 갱신으로만 구성된다. 애플리케이션 실행 코드(`src/**`)·쿼리 실행 계층(`typeorm` 코어)·커넥션 풀 설정이 전혀 변경되지 않아 알고리즘 복잡도, N+1, 캐싱, 블로킹 I/O, 메모리 할당, 자료구조, 지연 로딩 등 8개 점검 관점 모두 해당 코드 표면이 diff 에 존재하지 않는다. 1라운드에서 지적됐던 lockfile 노이즈(무관 optional 패키지 `libc:` 필드 63줄)는 이번 라운드에서 typeorm 변경분(15줄)으로 정리되어 사라졌음을 확인했다 — 이는 개선이지 새로운 위험이 아니다. `@nestjs/typeorm@12` 의 ESM `require(esm)` 로딩 경로 전환은 부팅 성공 여부의 문제로 이미 실측·문서화됐고 dependency 리뷰 트랙(W3)에서 별도 관리되므로 성능 리스크로 재분류하지 않는다. 전반적으로 순수 인프라성 변경이며 성능 관점에서 우려할 사항이 없다.

## 위험도

NONE
