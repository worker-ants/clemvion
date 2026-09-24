# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** lockfile 변경 범위가 plan 문서의 "한 줄" 서술보다 넓다 — `@nestjs/typeorm` 과 무관한 패키지들의 메타데이터가 재기록됨
  - 위치: `pnpm-lock.yaml` (게이트 1241~4133 구간의 다수 `libc:` 라인 삭제, 게이트 16569·16626·16666 부근의 `eslint-plugin-import` resolution 라인)
  - 상세: `git show 58cc6361c -- pnpm-lock.yaml` 로 확인한 결과 이 커밋 하나가 `pnpm-lock.yaml` 을 84줄(11 삽입/73 삭제) 변경했다. 그중 실제 `@nestjs/typeorm` specifier·version·peer 변경은 소수이고, 나머지는 `@css-inline/*`·`@img/sharp-*`·`@napi-rs/canvas-*`·`@parcel/watcher-*`·`@rolldown/binding-*`·`@tailwindcss/oxide-*`·`@next/swc-*`·`@unrs/resolver-binding-*`·`lightningcss-*` 등 typeorm 과 무관한 optional native 패키지 63건의 `libc: [glibc|musl]` 필드 삭제, 그리고 `eslint-plugin-import` 의 peer 해석 그래프가 self-referential 중첩 구조로 바뀐 것(2곳 importer + 1곳 snapshot 키)이다. `deps-typeorm12.md` 는 "`codebase/backend/package.json` 의 `@nestjs/typeorm`: `^11.0.3` → `^12.0.1`... 그래서 이 PR 은 한 줄이다" 라고 서술하는데, 이는 `package.json` 기준으로는 정확하지만 실제로 커밋된 `pnpm-lock.yaml` diff 는 그보다 넓다 — `pnpm install` 의 전체 재해석이 무관한 패키지들의 lockfile 표현까지 건드린 부수효과다.
  - 제안: 기능적 영향은 없어 보인다(제거된 `libc` 필드는 optional 바이너리 선택 힌트일 뿐이고, `eslint-plugin-import` 버전 자체는 불변). 다만 "한 줄" 이라는 서술이 리뷰어의 기대를 좁혀 이 넓은 lockfile 변경을 건너뛰게 할 위험이 있으므로, plan 문서에 "lockfile 상 무관 패키지의 메타데이터 재기록(pnpm 재해석 부수효과, 기능 영향 없음)" 한 줄을 덧붙이는 편이 안전하다. 이미 `--frozen-lockfile` 로 검증했다고 적혀 있으므로 기능적 결함 가능성은 낮다.

- **[INFO]** `@nestjs/typeorm` major 범프의 소비 표면이 넓음(dependency surface, 코드 시그니처 변경 아님)
  - 위치: `codebase/backend/package.json:44` (specifier 변경), 소비처는 `grep -l "@nestjs/typeorm" codebase/backend/src -r` 로 확인한 13개+ 모듈(`app.module.ts`, `statistics/*`, `chat-channel/*`, `schedules/*`, `workspaces/*`, `alerts/*`, `dashboard/*`, `integrations/*`, `workflow-assistant/*`, `workflow-versions/*` 등)
  - 상세: 이 저장소 자신의 함수/클래스 시그니처는 바뀌지 않았지만, 외부 라이브러리의 major 버전 범프이므로 `TypeOrmModule.forFeature`·`@InjectRepository` 등을 쓰는 모든 모듈이 새 런타임 구현 위에서 도는 것으로 바뀐다. plan 문서(§C, TEST WORKFLOW)가 build(Docker 포함)·backend unit 473스위트/9950(불변)·e2e 380 PASS 로 이 표면을 이미 검증했다고 기록했으므로 추가 조치는 불요로 보이나, "소비 표면이 넓다" 는 사실 자체는 부작용 리뷰 관점에서 기록해 둘 가치가 있다.

- **[INFO]** `@nestjs/typeorm@12.0.1` 이 `engines.node >= 20.19.0` 을 새로 요구
  - 위치: `pnpm-lock.yaml` (게이트 2544 부근 `engines: {node: '>=20.19.0'}` 신규 추가), `codebase/backend/package.json:133` (`engines.node: >=24`)
  - 상세: 저장소의 `engines.node` (`>=24`)가 이미 이 요구를 상회하므로 충돌 없음. 향후 이 패키지의 요구 버전이 더 올라가면 저장소 `engines` 와 별개로 어긋날 수 있는 지점이라 기록만 해 둔다. 조치 불요.

review/consistency/2026/09/24/17_31_27/** 의 9개 신규 산출물(SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)은 `spec/`·`codebase/` 에 어떤 상태 변경도 일으키지 않는 read-only 검토 산출물이며, 규약이 정한 `review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 위치에 정확히 생성됐다. 부작용 관점에서 우려할 점 없음.

## 요약

이번 변경은 `codebase/backend/package.json` 의 `@nestjs/typeorm` 단일 specifier 범프(`^11.0.3` → `^12.0.1`)와 그에 따른 `pnpm-lock.yaml` 갱신, 그리고 plan/review 문서 추가로 구성된다. 저장소 자체 코드의 함수/클래스 시그니처·전역 변수·환경 변수·네트워크 호출·이벤트/콜백 경로에는 변경이 없다. 유일하게 눈에 띄는 부작용은 `pnpm-lock.yaml` 이 `@nestjs/typeorm` 과 무관한 다수 optional 패키지의 `libc` 메타데이터와 `eslint-plugin-import` 의 peer 해석 그래프까지 재기록한 것인데, 이는 `pnpm install` 재해석의 알려진 부수효과이고 기능적 회귀 가능성은 낮다(plan 문서가 build/unit/e2e 전 계층 통과를 이미 실측). plan 문서가 이 lockfile 변경 범위를 "한 줄" 로 서술한 것은 실제 diff 크기와 다소 어긋나므로 문서 정확도 차원에서만 지적한다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
