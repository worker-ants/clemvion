# Code Review 통합 보고서

## 전체 위험도
**LOW** — 애플리케이션 로직 변경 없는 순수 의존성 버전 상향(audit 25건→0건) PR. Critical 없음. 유일한 WARNING 은 override 재해소 부수효과로 버전 불변 패키지들의 `libc:` 메타데이터가 조용히 삭제된 문서화 갭(기능 영향은 낮음으로 판단됨). forced(router_safety) whitelist 8개 reviewer 전원 정상 실행·결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프 | `pnpm-lock.yaml` 재해소 과정에서 이번 override/직접의존 상향 대상이 아닌, **버전이 전혀 바뀌지 않은** 패키지들의 `libc:` 메타데이터 필드가 조용히 삭제됨. scope reviewer 는 5종(`@css-inline/*`·`@napi-rs/canvas-*`·`@rolldown/binding-*`·`@tailwindcss/oxide-*`·`@unrs/resolver-binding-*`, 총 19개 플랫폼 변형)을 특정했고, dependency reviewer 는 더 넓은 집합(`lightningcss-linux-*` 등 포함 총 57곳)에서 같은 현상을 관측 — 같은 원인(override 편집 후 `pnpm install` 전체 재해소)의 서로 다른 표본. CHANGELOG/plan 의 "버전 하향 0건" 감사는 버전 번호만 비교하므로 이 종류의 변화를 포착하지 못한다. | `pnpm-lock.yaml` (예: `@css-inline/css-inline-linux-arm64-musl@0.20.0`, `@napi-rs/canvas-linux-arm64-musl@0.1.80`, `@rolldown/binding-linux-arm64-musl@1.0.3`, `@tailwindcss/oxide-linux-arm64-musl@4.3.3`, `@unrs/resolver-binding-linux-arm64-musl@1.12.2`, `lightningcss-linux-*-{gnu,musl}` 등 각 블록) | 패키지명 자체에 `-gnu`/`-musl` 가 인코딩돼 있어 pnpm 의 실제 optional-dependency 선택에는 기능 영향이 낮아 보이나, (1) CHANGELOG/plan 의 "전수 대조 결과 버전 하향 0건" 서술에 이 사례를 추가하거나 (2) 동일 pnpm 버전(`10.23.0`)으로 재현성(비결정적 재작성 여부)을 확인 후 "이 패키지들은 override 대상이 아니며 재해소 부수효과"라는 한 줄을 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 / 의존성 | `@next/mdx` (`^16.2.12`)는 `next` 코어의 critical CVE 패치 상향(`^16.2.12→^16.3.3`, frontend·channel-web-chat 양쪽)과 별개로 구버전에 그대로 핀. 해당 CVE 대상이 아니고 peer 충돌·audit 실패 없어 기능 결함은 아니나, CHANGELOG 문구가 "next 계열 전부 정리됐다"로 오독될 여지 | `codebase/frontend/package.json:23` | CHANGELOG 문구를 "next(코어)"로 한정하거나, `@next/mdx` 동반 상향 여부를 후속 정기 업데이트 항목으로 등재 |
| 2 | 요구사항 | `qs` override 근거 서술(주석/plan/CHANGELOG)이 소비 경로를 "express(prod)·superagent(dev) 두 곳"으로만 서술하나, 실측하면 `express` 자신이 의존하는 `body-parser@2.3.0`(`qs: ^6.15.2`)도 세 번째 소비처. `^6.16.0` 이 이 범위도 만족해 결과 오류는 없음(범위를 더 넓게 만족) | `pnpm-workspace.yaml:85-92`, `plan/in-progress/deps-audit-floor-refresh-2026-09.md:60-66`, `CHANGELOG.md:44-47` | 조치 불요. 향후 `qs` override 재상향 시 `body-parser` 경로도 확인 대상에 포함 |
| 3 | 부작용 | `next` 마이너 버전 상향은 정적 diff 로는 드러나지 않는 프레임워크 런타임 동작(라우팅/캐싱/미들웨어 기본값 등) 변경 표면. build/e2e(playwright 51 passed) 통과로 상당 부분 실측 커버되었으나 Next 자체 changelog(breaking/behavior) 대조는 plan 에 명시 안 됨 | `codebase/frontend/package.json:52`, `codebase/channel-web-chat/package.json:17` | 향후 Next 마이너 상향 시 릴리스 노트 breaking/behavior 섹션 대조를 plan 체크리스트 항목으로 추가 |
| 4 | 부작용 | 신설 `qs` override 가 `pnpm-workspace.yaml` 상 scope 미지정(unscoped)이라 워크스페이스 전체 `qs` 소비자에 전역 적용됨. 현재는 실제 소비자(express·body-parser·superagent)만 존재함을 실측 확인해 문제 없으나, 향후 다른 워크스페이스가 `qs` 의존을 추가하면 리뷰 없이 조용히 이 override 가 적용됨(pnpm override 의 일반적 설계, 이 PR 의 결함 아님) | `pnpm-workspace.yaml` (qs override 신설 줄) | 조치 불요, 참고 기록 |
| 5 | 유지보수성 | `CHANGELOG.md` 바닥 침식 표의 "→" 열이 `js-yaml` 두 행만 `js-yaml@>=4.0.0 <4.3.2: ^4.3.2` 형태의 `키: 값` 복합 문자열을 담아, 단순 버전만 담는 다른 6행과 열 의미가 어긋남. 같은 PR 안의 plan 문서(`§1(a)`)는 "→" 열은 값만 두고 설명은 표 아래 산문으로 분리해 이 문제를 피함(더 나은 패턴이 이미 존재) | `CHANGELOG.md:38-39` (대조: `plan/in-progress/deps-audit-floor-refresh-2026-09.md` §1(a)) | plan 문서와 같은 패턴으로 "→" 열은 값만 두고 키 상한 변경 설명은 표 아래 산문(이미 `CHANGELOG.md:41-43` 에 존재)에만 맡길 것 |
| 6 | 테스트 | 이 PR 이 직접 편집하는 `EXPECTED_OVERRIDES` baseline 을 가진 `scripts/check-pnpm-security-config.py` 에 전용 단위 테스트가 없음. 형제 스크립트 `scripts/check-override-floors.py` 는 정확히 같은 실패 클래스(값 약화·키 부재·비-dict 타입·YAML 파싱 실패 등)를 고정한 669줄 테스트 스위트(`test_override_floors.py`)를 보유하는데 비대칭. `main()` 은 `overrides` 가 dict 아닌 극단 케이스에 대한 타입 검증 없이 바로 순회함. 이번 diff 가 만든 회귀는 아니고 사전 존재 구조적 갭 | `scripts/check-pnpm-security-config.py` (`main()` 함수) | 이 PR 범위 밖. `check-override-floors.py` 의 fail-closed 테스트 패턴을 참고해 별도 plan 항목으로 등재 검토 |
| 7 | 테스트 | `test_override_floors.py::test_real_workspace_yaml_covers_scoped_range_keys` 는 실제 `pnpm-workspace.yaml` 에 결합돼 있고 `js-yaml` 키 존재 개수만 확인 — 이번 PR 의 값 변경 자체는 감지하지 못함. 테스트 설계 의도(추출 로직 검증)와 일치하므로 결함 아님 | `.claude/tests/test_override_floors.py` (`OverrideTargetExtractionTest`) | 참고용, 조치 불요 |

## 참고 — "문제 없음" 으로 확인된 항목 (실질 결함 아님, 별도 분류)

- **security**: 하드코딩 시크릿/인증/인젝션/에러 노출 해당 없음(diff 에 실행 코드 경로 없음). `auditConfig.ignoreCves` 미변경 확인 — audit 실패를 숨기는 우회 없음. `js-yaml` scope 키+값 동시 상향으로 기존 함정(#1038 유형) 재발 없음. `qs`/`next` override 가 상위 패키지 semver 계약을 깨지 않음을 실측 확인.
- **requirement**: `pnpm audit`·`check-override-floors.py`·`check-pnpm-security-config.py`·`check-unmet-peers.py` 4개 가드 전부 재실행 exit 0, CHANGELOG/plan 서술과 정량 일치.
- **maintainability**: `pnpm-workspace.yaml` override 변경과 `check-pnpm-security-config.py` `EXPECTED_OVERRIDES` 2-place 편집 규약 정확히 동반 갱신 확인.
- **testing**: 회귀 스위트(`test_override_floors.py` 39 passed, `test_dependabot_npm_coverage.py` 14 passed) 재실행 무회귀. plan 의 backend 454 suites/9,521 tests·e2e 305 tests·playwright 51 passed 수치를 로그(`_test_logs/*.log`) 직접 대조해 실측 일치 확인.
- **documentation**: 문서 주장 5개 정량 항목(pnpm audit, override-floors, security-config baseline 개수, unmet-peers, 조치 건수 8+1+4)을 전부 직접 재실행 대조해 일치 확인. override 인라인 주석 관례(값만 바뀌는 일반 케이스는 주석 생략)는 기존 정립된 설계 결정을 그대로 따름 — 결함 아님. 리뷰 중 `pnpm-lock.yaml` 일시적 삭제를 관측했으나 다른 reviewer 의 병렬 mutation-then-restore 로 추정되며 최종 상태는 clean(본 reviewer 는 어떤 파일도 mutate 하지 않음).
- **dependency**: 신규 외부 패키지 도입 0건(전부 기존 패키지 버전 상향), 라이선스 우려 없음, 버전 핀 정책(`PROJECT.md`) 준수, unmet-peers 신규 충돌 0건, 981줄 lockfile diff 전수 대조 결과 다운그레이드 의심 0건.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 취약점 패치 완결성 실측 확인(3개 가드 exit 0), ignoreCves 우회 없음, override 정합성 확인 |
| requirement | NONE | plan/CHANGELOG 서술-실측 1:1 대응. INFO 2건(@next/mdx 미동반, qs 3번째 경로 서술 누락) |
| scope | **LOW** | `libc:` 메타데이터 5종(19블록) 조용히 삭제 — 감사 프록시가 포착 못하는 종류의 변화 (WARNING) |
| side_effect | LOW | next 마이너 런타임 동작 표면, qs unscoped override 전역 적용(둘 다 INFO) |
| maintainability | NONE | CHANGELOG 표 열 일관성 미세 흠(INFO), 2-place 편집 규약 정확 준수 |
| testing | NONE | 회귀/실측 로그 전부 일치. check-pnpm-security-config.py 전용 테스트 부재(구조적 갭, INFO) |
| documentation | NONE | 문서-실측 정량 대조 5건 전부 일치, override 주석 관례 준수 |
| dependency | NONE | 신규 패키지 도입 없음, 버전 정책 준수, dedup 981줄 중 다운그레이드 0건 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원 최소 1건 이상의 INFO/WARNING 발견을 보고함(Critical 은 전원 0건).

## 권장 조치사항

1. `pnpm-lock.yaml` 재해소로 삭제된 `libc:` 메타데이터(5~57개 블록, 버전 불변 패키지)에 대해 동일 pnpm 버전 재실행으로 비결정성 여부를 확인하고, 기능 영향 없음이 확인되면 CHANGELOG/plan 에 "override 대상 아님, 재해소 부수효과" 한 줄을 남길 것 (WARNING #1).
2. `CHANGELOG.md` 바닥 침식 표의 `js-yaml` 두 행을 plan 문서와 동일한 패턴("→" 열은 값만, 키 상한 변경은 표 아래 산문)으로 정리 (INFO #5).
3. (선택, 이 PR 범위 밖) `scripts/check-pnpm-security-config.py` 에 `check-override-floors.py` 수준의 fail-closed 단위 테스트를 후속 plan 항목으로 등재 검토 (INFO #6).
4. (선택) `@next/mdx` 를 `next` 코어와 함께 정기 업데이트 시 동반 상향 검토 (INFO #1).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency` (8명, 전원 success + 전문 확보)
  - **강제 포함(router_safety)**: `dependency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명 — forced whitelist 전원이기도 함) — **forced 전원 결과 확보 확인됨**, 강제 화이트리스트 미이행 없음.
  - **제외**: 아래 표 (6명, router 산출물에 개별 사유 미제공 — 이번 diff 가 애플리케이션 로직·아키텍처·DB·동시성·API 계약·사용자 가이드 영역을 건드리지 않는 순수 의존성 버전 상향이라는 변경 특성상 해당 카테고리 리뷰 대상이 희박했던 것으로 추정)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 사유 미제공(router 산출물에 없음) |
  | architecture | 사유 미제공(router 산출물에 없음) |
  | database | 사유 미제공(router 산출물에 없음) |
  | concurrency | 사유 미제공(router 산출물에 없음) |
  | api_contract | 사유 미제공(router 산출물에 없음) |
  | user_guide_sync | 사유 미제공(router 산출물에 없음) |
