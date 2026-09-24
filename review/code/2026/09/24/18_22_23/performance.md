# 성능(Performance) 리뷰 — `@nestjs/typeorm` 11→12 (deps-typeorm12)

## 발견사항

- **[INFO]** 실행 코드 변경 없음 — 순수 의존성 버전 범프
  - 위치: `codebase/backend/package.json:44`, `pnpm-lock.yaml:94-97,2542-2551`
  - 상세: 이번 diff 는 `@nestjs/typeorm` 를 `^11.0.3` → `^12.0.1` 로 올리는 `package.json`/`pnpm-lock.yaml` 변경과 그 결정 과정을 기록한 `plan/in-progress/*.md` 문서, 그리고 `review/consistency/2026/09/24/17_31_27/` 하위 리뷰 산출물로만 구성된다. 애플리케이션 소스(`codebase/backend/src/**`)에는 변경이 없어 알고리즘 복잡도·N+1·캐싱·블로킹 I/O·자료구조·지연 로딩 등 실행 경로에 영향을 줄 수 있는 코드 자체가 diff 에 존재하지 않는다.
  - 제안: 해당 없음 (정보성).

- **[INFO]** 실제 쿼리 실행/커넥션 계층(`typeorm` 코어)은 버전 고정 — 런타임 성능 영향 표면이 제한적
  - 위치: `pnpm-lock.yaml:94-97` (`@nestjs/typeorm` 의존 트리 내 `typeorm@0.3.31` 그대로), `codebase/backend/package.json:89` (`"typeorm": "^0.3.31"`, 미변경)
  - 상세: `@nestjs/typeorm` 는 `TypeOrmModule`·데코레이터·DI 배선을 제공하는 얇은 통합 레이어이고, 커넥션 풀링·쿼리 빌더·트랜잭션 등 실제 쿼리 실행 로직은 `typeorm` 코어 패키지가 담당한다. 이 PR 은 `typeorm` 코어 버전을 건드리지 않으므로(고정 `^0.3.31`), 쿼리 실행 경로·커넥션 풀 설정·N+1 유발 여부에 실질적 변화가 생길 가능성은 낮다. `plan/in-progress/deps-typeorm12.md` 가 이미 peer 호환성(§A)과 reflection 보안 회귀(§C, 성능 아님)를 실측했지만, 성능 회귀 여부에 대한 실측은 문서에 없다.
  - 제안: 필수는 아니나, 배포 전 스테이징에서 대표 쿼리 경로(특히 워크스페이스 스코프 쿼리)의 응답 시간을 업그레이드 전/후로 한 번 비교해 두면 §C 의 "전/후 실측" 관례와 일관되고 회귀를 조기에 배제할 수 있다.

- **[INFO]** `@nestjs/typeorm@12.0.1` 의 신규 `engines: {node: '>=20.19.0'}` 요구사항
  - 위치: `pnpm-lock.yaml:2544-2545` (`'@nestjs/typeorm@12.0.1': ... engines: {node: '>=20.19.0'}`)
  - 상세: v11 에는 없던 `engines` 제약이 v12 에 추가됐다. 저장소 `codebase/backend/package.json:133` 의 `"engines": {"node": ">=24"}` 가 이를 상회하므로 현재 CI/런타임 환경에서는 문제가 되지 않는다. 성능 이슈는 아니지만 향후 Node 버전 하향 시 체크포인트로 남긴다.
  - 제안: 없음 (참고용).

- **[INFO]** `pnpm-lock.yaml` 의 다수 `libc:` 필드 제거는 이번 변경과 무관한 lockfile 재포맷 노이즈
  - 위치: `pnpm-lock.yaml` 전반 (`@img/sharp-*`, `@napi-rs/canvas-*`, `@next/swc-*`, `@parcel/watcher-*`, `@rolldown/binding-*` 등 다수 optional binary 패키지 항목에서 `libc: [glibc]`/`[musl]` 줄 삭제)
  - 상세: 이 줄들은 `@nestjs/typeorm` 의존 트리와 무관한 optional native binding 패키지들이며, pnpm 버전/lockfile 포맷 변경에 따른 부수 diff 로 보인다. 성능에 영향은 없으나(설치 시 플랫폼 필터링 메타데이터일 뿐, 런타임 미개입) diff 노이즈가 크므로 리뷰 시 실제 의존성 변경(`@nestjs/typeorm` 한 줄)과 섞여 오독될 여지가 있다는 점만 기록한다.
  - 제안: 성능 관점에서는 조치 불필요.

## 요약

이번 변경은 `@nestjs/typeorm` 패키지를 11.0.3 → 12.0.1 로 올리는 의존성 범프이며, 실행 코드(`codebase/backend/src/**`)는 전혀 수정되지 않았다. 실제 쿼리 실행·커넥션 풀링을 담당하는 `typeorm` 코어는 `^0.3.31` 로 고정된 채 변경이 없어, 알고리즘 복잡도·N+1·캐싱·블로킹 I/O·메모리·자료구조·지연 로딩 등 이 리뷰의 점검 관점 대부분에 해당하는 코드 표면 자체가 diff 에 존재하지 않는다. `plan/in-progress/deps-typeorm12.md`·`nestjs-v12-coordinated-upgrade.md` 는 peer 호환성과 reflection 보안 회귀를 실측 기반으로 꼼꼼히 검증했지만 성능 실측은 다루지 않으며, 이 diff 의 성격상 필수도 아니다. `pnpm-lock.yaml` 의 대량 `libc:` 필드 제거는 무관한 lockfile 재포맷 노이즈로, 성능에는 영향이 없다.

## 위험도

NONE
