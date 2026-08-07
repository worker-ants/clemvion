# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 의존성/보안 override 상향(undici, hono, fast-uri, js-yaml, socket.io-parser 등) + baseline 가드(`check-pnpm-security-config.py`) 동기화. CRITICAL 없음, WARNING 1건(사전부터 죽어있던 CVE 근거 커밋 해시 참조가 이번 변경으로 재노출). requirement 리뷰어가 override-floors 가드·audit·`--frozen-lockfile` install·39개 unit test 를 직접 재실행해 자체 정합성을 실증했다. forced reviewer(dependency, documentation) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 오버라이드 블록의 CVE 근거 추적용 커밋 해시(`b2bbb49e`)가 로컬 저장소 어디에도 존재하지 않는 커밋을 가리킴. `git log -S`로 추적한 결과 pnpm 전환 커밋(`4dfd59e8c`, #646) 이후 문구만 이어지고 해시는 한 번도 갱신된 적 없는 사전 존재 결함이나, 이번 diff 가 바로 그 블록이 관리하는 `fast-uri`/`hono`/`js-yaml`/`undici` 항목 값을 실제로 바꾸므로 CVE 근거 재구성이 막히는 상태가 실질적으로 노출된다. `check-pnpm-security-config.py` 는 값의 동일성만 검증하고 이 서술형 참조는 검증하지 않아 코드로 잡히지 않는다 | `pnpm-workspace.yaml:24` (`# audit 커밋(b2bbb49e) 참조.`) | `b2bbb49e` 를 실제 근거 커밋(예: 이번 diff 의 `c8ad8de6b`)으로 교체하거나, 커밋 메시지에 이미 있는 실측표(패키지·구버전·필요버전·근거) 방식으로 주석을 자체완결시킨다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 | `@aws-sdk/core@3.977.4` 가 deprecated 로 표기됨("Document number parsing bug in JSON") — 버전 자체는 안 바뀌었고 lockfile 재생성 시 registry 메타데이터가 처음 반영된 것. 이번 PR 목적과 무관하며 `pnpm audit`에도 안 걸리는 종류(취약점이 아닌 버그 공지) (security·requirement·dependency 공통 지적) | `pnpm-lock.yaml:907-909` | 이번 PR 범위 아님. 추후 `@aws-sdk/client-s3` 업그레이드 시 함께 해소하도록 별도 트래킹 권장 |
| 2 | 의존성/보안 | 신규 `socket.io-parser: ~4.2.7` override — 다른 항목과 달리 `^` 대신 `~`를 사용해 `socket.io@4.8.3` 의 peer 계약(`~4.2.4`)을 깨지 않도록 한 의도적 설계. GHSA-2m8v-j782-fhvr(high) 패치 근거가 인라인 주석에 명시되고 lockfile 실제 해소값(4.2.7)과 일치 (security·architecture·side_effect·maintainability·dependency·requirement 공통 확인 — 모범 사례) | `pnpm-workspace.yaml:34-37` | 조치 불요. socket.io 관련 e2e(연결/재연결) CI green 확인만 권장 |
| 3 | 성능/부작용 | `undici` 6.x(direct, `^6.21.3→^6.28.0`)/7.x(transitive override) 동시 상향 — 패치/마이너 레벨이라 API 파괴적 변경 가능성은 낮으나 커넥션 재사용·타임아웃 등 HTTP client 내부 동작에 미세한 차이가 발생할 수 있음. 이 diff 만으로 런타임 성능·동작 영향은 판단 불가 | `codebase/backend/package.json:89`, `pnpm-workspace.yaml:46` | 별도 코드 수정 불요. 외부 API 호출 경로의 기존 통합/e2e 가 이번 lockfile 이후에도 통과하는지 확인 권장, 표준 모니터링으로 충분 |
| 4 | 아키텍처/유지보수성 | 보안 override baseline 이 `pnpm-workspace.yaml`(overrides) 과 `scripts/check-pnpm-security-config.py`(`EXPECTED_OVERRIDES`) 두 곳에 값까지 중복 — 일반적으론 drift 위험이지만 pnpm 10.23 이 `package.json#pnpm` 필드를 더는 읽지 않게 되며 `--frozen-lockfile` 만으로는 override 약화를 못 잡는 문제(#1038)를 막기 위한 의도적 2-place 가드. 이번 diff 는 그 동시 편집 규약을 정확히 준수함(값까지 1:1 일치, `check-pnpm-security-config.py` 실행 exit 0 확인) | `scripts/check-pnpm-security-config.py:37-68`, `pnpm-workspace.yaml` overrides | 현행 유지 권장(DRY 통합 대상 아님). 항목 수가 크게 늘면 데이터/코드 분리 고려 가능 |
| 5 | 테스트 | `check-pnpm-security-config.py` 의 비교 로직(`_check_set`, `main()`) 자체에는 전용 unit test 없음 — sibling 가드(`check-override-floors.py`)는 39건 테스트로 커버되는데 이 스크립트만 빠져 있음. 다만 `plan/in-progress/deps-guard-hardening.md` 에 10차 리뷰·뮤턴트 검증을 거친 의도적 설계로 이미 기록돼 있고, 이번 diff 는 데이터(`EXPECTED_OVERRIDES` 값)만 갱신했을 뿐 로직은 건드리지 않음 | `scripts/check-pnpm-security-config.py` | blocking 아님. 향후 스크립트 로직 자체를 건드리는 PR 에서 `test_override_floors.py` 패턴 이식 권고 |
| 6 | 유지보수성 | `pnpm-workspace.yaml` 의 `socket.io-parser` override 키만 따옴표로 감싸져 있어(YAML 상 불필요) 다른 단순 식별자 키(`fast-uri`, `hono` 등)와 스타일 불일치 | `pnpm-workspace.yaml:37` | 사소한 스타일 이슈, 조치 불요(원하면 따옴표 제거로 통일 가능) |
| 7 | 스코프 | override 대상이 아닌 부수 전이 패키지(`postcss` 8.5.25→8.5.26, `nanoid` 3.3.16→3.3.17)가 lockfile 재생성 과정에서 함께 갱신됨 — EXPECTED_OVERRIDES 대상도 CVE 목록에도 없음 | `pnpm-lock.yaml` (postcss/nanoid 항목) | 실제 위험 낮음(override 미지정 전이 의존성이 `pnpm install` 재해석 시 상류로 자연 이동하는 일반 동작). 커밋 메시지에 "선택 항목 + 연동 전이 트리" 임을 명시하면 향후 감사 시 혼선 감소 |
| 8 | 문서화(spec) | 이번 변경은 CI/의존성 보안 설정 영역으로 관련 spec 문서가 없으며, `plan/in-progress/deps-guard-hardening.md` 도 `spec_impact: none` 을 명시해 라우팅 규약과 일치 | 해당 없음 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 override 상향 자체가 취약점 패치 목적, 신규 취약점 도입 없음. `@aws-sdk/core` deprecated 는 INFO |
| performance | NONE | 알고리즘/DB/I/O 변경 없음, HTTP client 버전 상향 영향은 실측(부하테스트) 영역이라 INFO |
| architecture | NONE | 코드 구조 변경 없음. overrides 이중 소스는 의도된 drift-detection 가드, 2-place 동기화 준수 확인 |
| requirement | NONE | override-floors 가드·audit·frozen-lockfile install·39개 unit test 직접 재실행으로 정합성 실증. spec 대상 아님(정상) |
| scope | NONE | 4개 파일 모두 단일 목적(override 하한 정정)에 부합. 부수 patch 버전 변경은 pnpm 일반 동작 |
| side_effect | LOW | socket.io-parser 워크스페이스 전역 override, undici 6.x/7.x 상향에 따른 런타임 동작 미세 변화 가능성(코드 레벨 부작용은 없음) |
| maintainability | NONE | 스타일 사소한 지적(quoting), 설계된 2-place 중복은 의도적 |
| testing | NONE | 애플리케이션 로직 테스트 대상 없음. sibling 가드 unit test 부재는 기존에 기록된 의도적 결정 |
| documentation | LOW | 존재하지 않는 CVE 근거 커밋 해시(`b2bbb49e`) 참조 — WARNING 1건 |
| dependency | LOW | 신규 외부 패키지 없음, 전량 patch/minor 상향+override. `@aws-sdk/core` deprecated, 2-place 동기화 드리프트 없음 확인 |
| database | NONE | 해당 없음 — DB 관련 코드 변경 없음 |
| concurrency | NONE | 해당 없음 — 동시성 로직 변경 없음 |
| api_contract | NONE | 해당 없음 — API 계약 관련 코드 변경 없음 |
| user_guide_sync | NONE | doc-sync-matrix 20개 trigger 전건 대조, 매칭 0건 |

## 발견 없는 에이전트

- database — DB 엔티티/마이그레이션/쿼리/트랜잭션 등 관련 코드 없음
- concurrency — 락/뮤텍스/async/이벤트루프 등 관련 코드 없음
- api_contract — REST/GraphQL/DTO/라우팅 등 API 계약 관련 코드 없음
- user_guide_sync — doc-sync-matrix trigger 매칭 0건

## 권장 조치사항
1. `pnpm-workspace.yaml:24` 의 존재하지 않는 커밋 해시(`b2bbb49e`) 참조를 실제 근거 커밋(예: `c8ad8de6b`)으로 교체하거나 커밋 메시지의 실측표 방식으로 자체완결형 주석으로 갱신한다 (WARNING).
2. socket.io-parser(GHSA-2m8v-j782-fhvr) 및 undici 관련 기존 WS·통합 e2e 스위트가 이번 lockfile 갱신 이후에도 green 인지 CI 로 확인한다.
3. `@aws-sdk/core@3.977.4` deprecation("Document number parsing bug in JSON")을 후속 이슈로 등록해 `@aws-sdk/client-s3` 업그레이드 시 함께 해소하도록 트래킹한다 (pnpm audit 미포착 종류).
4. (선택, 낮은 우선순위) `check-pnpm-security-config.py` 의 비교 로직을 향후 건드릴 일이 생기면 `test_override_floors.py` 패턴을 이식해 unit test 갭을 메운다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 실행. forced 화이트리스트(dependency, documentation) 결과도 전원 확보됨(누락 없음).