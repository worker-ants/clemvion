# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `Makefile` — `e2e-up` / `e2e-test` / `e2e-test-full` 에 `--build` 플래그 추가로 Docker BuildKit 레이어 캐시 재평가 발생
  - 위치: `Makefile` L40, L51, L56, L59, L61
  - 상세: `--build` 는 `docker compose up` 및 `docker compose run` 실행 시 이미지 재빌드를 강제하는 플래그다. 이는 의도된 변경이며 명시된 부작용(stale 이미지 문제 해결)이다. 단, CI/CD 환경에서 `make e2e-up` 을 직접 호출하는 스크립트가 있다면 빌드 시간이 늘어날 수 있다. plan 문서에 "CI 는 매번 fresh container 라 영향 없음" 으로 명시되어 있어 CI 쪽 부작용은 낮다고 판단된다.
  - 제안: 현재 변경 자체는 적절하다. 다만 `make e2e-up` 을 CI 에서 직접 호출하는 워크플로가 있다면, 빌드 시간 증가 여부를 한 번 확인하는 것을 권장한다.

- **[INFO]** `Makefile` — `e2e-test-full` 의 `playwright-runner` 에도 `--build` 추가
  - 위치: `Makefile` L61
  - 상세: `playwright-runner` 는 e2e 테스트 실행 컨테이너이며 소스 코드 변경과 직접 연동된다. 소스 변경 시 항상 rebuild 하는 것은 올바른 동작이다. 단, playwright 이미지 자체의 레이어가 많다면 첫 실행 빌드 비용이 높을 수 있다.
  - 제안: 허용 가능한 수준의 부작용으로 별도 조치 불필요.

- **[INFO]** `third-party-oauth.controller.spec.ts` — 타입 어설션 범위 좁히기 (`unknown` → `string`)
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85~88
  - 상세: `Record<string, unknown>` 에서 `Record<string, string>` 으로 타입이 좁혀졌고, `String(contentType ?? '')` 에서 `contentType ?? ''` 로 변경되었다. 런타임 동작에 변화가 없으며 타입 안정성이 개선되었다. 테스트 파일이므로 공개 API 영향 없음.
  - 제안: 문제 없음.

- **[INFO]** `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — 신규 파일 추가 (파일시스템 부작용)
  - 위치: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`
  - 상세: plan 문서 신규 생성은 프로젝트 규약에 정의된 정상 절차이다. frontmatter 에 `worktree`, `started`, `owner` 가 올바르게 기재되어 있으며 `plan/in-progress/` 에 위치하는 것도 규약에 부합한다. REVIEW WORKFLOW 체크박스 `[ ]` 가 미완으로 남아 있어 `in-progress/` 에 있는 것이 맞다.
  - 제안: 문제 없음.

- **[INFO]** `review/consistency/2026/05/16/09_13_51/SUMMARY.md` — 신규 파일 추가 (파일시스템 부작용)
  - 위치: `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
  - 상세: consistency-checker 산출물로, 규약에 정의된 경로(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`)에 정확히 위치한다. 부작용 없음.
  - 제안: 문제 없음.

## 요약

이번 변경에서 부작용 관점의 실질적 위험 요소는 발견되지 않았다. `Makefile` 의 `--build` 플래그 추가는 Docker BuildKit 레이어 캐시 재평가를 유발하지만 이는 의도된 부작용(stale 이미지 방지)이며 plan 문서에 근거와 범위가 명시되어 있다. 타입 어설션 변경은 테스트 파일 내부에 국한되어 공개 API나 인터페이스에 영향이 없다. 신규 생성된 문서 파일들은 모두 프로젝트 규약에 정의된 경로와 포맷을 준수한다. 전역 변수, 환경 변수, 네트워크 호출, 이벤트/콜백 변경은 포함되지 않는다.

## 위험도

NONE
