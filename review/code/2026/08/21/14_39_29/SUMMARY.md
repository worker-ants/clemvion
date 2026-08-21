# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 급 신규 결함 없음. 유일한 WARNING(spec/ 직접 편집)은 3라운드에 걸쳐 팀이 "내용 정확, 되돌리지 않음" 으로 이미 명시 결정한 사안의 재확인이며 이번 라운드의 새 발견이 아니다. forced whitelist(8개 reviewer) 전원 실행·전문 확보 완료 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SCOPE / 권한경계 | `spec/` 편집이 `developer`/code-review RESOLUTION 세션에서 project-planner 위임 없이 직접 실행됨(CLAUDE.md 상 `spec/` 는 read-only). 내용 자체는 구현과 정확히 일치하고 SPEC-DRIFT 아님 — 3라운드(4·5·9)에 걸쳐 "되돌리지 않는다, CLAUDE.md 예외 조항 추가는 별도 project-planner 턴" 으로 반복 명시 결정됨 | `spec/5-system/14-external-interaction-api.md:1625` + frontmatter `code:` 목록, 커밋 `bf0618a7d` | 이 PR 에 대한 추가 조치 불요(기결정 재확인). "code-review RESOLUTION 이 사소한 spec 텍스트 오류를 직접 정정할 수 있는 예외 조건"을 CLAUDE.md 에 명시하는 것은 이 PR 과 무관한 별도 project-planner 턴으로 남김 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성/scope | `pnpm-lock.yaml` 의 `eslint-config-next` peer-dependency variant 재해석이 목표와 무관하게 포함됨. 버전(`16.3.0` 등) 자체는 불변, `pnpm install` 이 신규 workspace 추가로 peer 그래프를 재계산한 부수효과 | `pnpm-lock.yaml` importers/`snapshots:` 섹션 | 조치 불요(9라운드 연속 동일 확인, 불가피한 부산물) |
| 2 | scope | 리뷰 산출물 `rationale_continuity.md` 최상단에 sub-agent 중간 추론 문장이 잔존 | `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1-3` | 조치 불요(target 코드와 무관, 생성 아티팩트 후처리 이슈) |
| 3 | side_effect | frontend `MASKED_MARKERS` 런타임 타입이 `ReadonlySet<string>` → `readonly string[]` 로 변경. 전체 소비처가 `isMaskedMarker()` 또는 스프레드만 사용해 파손 없음 확인(`.has(` 소비처 0건) | `codebase/frontend/src/lib/utils/masked-markers.ts:56` | 조치 불요 |
| 4 | side_effect | 미러 재발 가드 캐너리가 `os.tmpdir()` 임시 fixture 사용 — `try/finally` 로 완전 정리되어 실제 파일시스템 부작용 없음 | `masked-marker-mirror.spec.ts`(backend)/`.test.ts`(frontend) | 조치 불요 |
| 5 | maintainability | backend/frontend 미러 가드의 `SOT_DIR` 선언 방식이 비대칭(슬래시 리터럴 vs `path.join`+사후 정규화). 동작은 POSIX(CI) 환경에서 동일 | `masked-marker-mirror-guard.ts` backend:29 / frontend:21,144 | 다음 편집 기회에 frontend 를 슬래시 리터럴로 통일 고려. 비차단 |
| 6 | maintainability | frontend 미러 가드 spec 파일에만 이중 빈 줄 2곳 잔존(포맷 드리프트) | `masked-marker-mirror.test.ts:69-70,86-87` | 선택 사항, 비차단 |
| 7 | maintainability | `index.ts` JSDoc 과 `README.md` 가 "왜 공유 패키지인가" 서사를 손으로 중복 서술, 대조 가드 없음 | `codebase/packages/masked-markers/src/index.ts:1-24` vs `README.md:18-28` | 다음 편집 기회에 한쪽으로 요약/위임 고려. 비차단 |
| 8 | maintainability | `masked-markers/package.json` 의 `prepare` 스크립트가 저장소 내 8개 타 내부 패키지와 동일 인라인 JS 를 9번째로 복제 | `codebase/packages/masked-markers/package.json:9` | 이번 PR 범위 아님. 10번째 패키지 추가 전 공유 스크립트 추출 검토 가치 유효 |
| 9 | testing | backend `deepRedactSecrets` 의 깊이 경계 테스트가 정확한 값(10)을 고정하지 않음(`not.toThrow()` 만 확인) — frontend 정밀 경계 테스트가 같은 PR 워크플로에서 함께 돌아 실질 위험 낮음, plan 에 이미 등재 | `sanitize-error-message.spec.ts:239-244` | 조치 불요(이미 추적 중, 이 PR 이 만든 갭 아님) |
| 10 | testing | 미러 가드의 탐지 스코프(선언 노드만) 반대편(비-SoT 모듈 재export, 구조분해 선언)을 겨냥한 부정 테스트 부재 — 의도된 설계로 JSDoc 에 명시 | `masked-marker-mirror-guard.ts` backend:100-108 / frontend:104-108 | 조치 불요(설계 의도) |
| 11 | testing | `resolveScanDirs` 의 방어적 조기 반환 분기(경로 미존재)를 겨냥한 단위 테스트 부재 — 도달 가능성 낮은 방어 코드 | `masked-marker-mirror-guard.ts` (backend/frontend) | 조치 불요 |
| 12 | dependency | `frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 추가 — 워크스페이스 설치 범위는 불변, job 트리거 범위만 확장(3번째 스택까지 미러가드 커버) | `.github/workflows/frontend-checks.yml:48` | 조치 불요(의도된 CI 경로 게이팅 갭 해소) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 정규식·판정 로직 값·동작 무변경(import 출처만 이동). repo-guard 는 저장소 로컬 파일만 읽는 CI 전용 스캐너로 사용자 입력/네트워크 표면 없음. 오히려 이 PR 이 기존 CI 경로 게이팅 fail-open 갭을 닫는 방향 |
| requirement | NONE | plan 이 명시한 6개 SoT 심볼 전부 값 변경 없이 이관, 소비처 동작 무변경. 미러 소멸 가드가 backend/frontend 대칭. CI 배선 8곳·spec R17·plan 체크리스트 전부 실제 상태와 일치 |
| scope | LOW | 실질 변경 25개 파일 전부 "마스킹 마커 계약 공유 패키지 추출" 단일 목표에 수렴. WARNING 1(spec 권한 경계, 기결정 재확인), INFO 2(무관 lockfile 부산물, 리뷰 산출물 잔존 텍스트) |
| side_effect | NONE | 재export 전환뿐, 시그니처 무변경. 유일한 파일시스템 쓰기(캐너리 tmp fixture)는 `try/finally` 로 완전 정리. 전역상태·네트워크·이벤트 배선 변경 없음 |
| maintainability | NONE | 함수 짧고 책임 단일, 중첩 3~4단 이내. 설계 결정 근거가 근접 주석에 충실. 신규 지적 0건, INFO 4건 전부 이월(carried forward) 재확인 |
| testing | NONE | 이번 라운드 diff 는 JSDoc/테스트명 정정 하나뿐, 정정 내용이 실제 코드 상태와 정확히 일치. 미러가드 캐너리가 실제 회귀를 전부 잠금. CI 배선(test-stages.sh)이 신규 패키지 테스트 실행을 보장 |
| documentation | NONE | 공개 심볼마다 "왜"(설계 근거·기각 대안·실측치)를 담은 JSDoc. README/index.ts/spec R17/plan 체크리스트 전부 실제 상태와 정확히 일치. CHANGELOG 갱신 불요 판단 타당(동작 무변경) |
| dependency | NONE | 신규 외부(비-workspace) npm 패키지 0개. 등록 8곳(test-stages.sh·CI matrix/pathspec·Dockerfile 3곳·package.json 2곳)·lockfile 전부 정합. 런타임 의존 zero 인 순수 값 도메인 패키지 |

## 발견 없는 에이전트

security, requirement, documentation — Critical/Warning/INFO 전혀 없음(완전한 clean).

## 권장 조치사항

1. (선택, 비차단) `masked-marker-mirror-guard.ts` frontend 의 `SOT_DIR` 선언을 backend 와 동일한 슬래시 리터럴로 통일해 `path.join`+사후 정규화 단계를 제거한다.
2. (선택, 비차단) frontend 미러 가드 spec 파일의 이중 빈 줄 2곳을 제거해 backend 쌍둥이와 포맷을 맞춘다.
3. (후속, 별도 PR) `masked-marker-shared-package.md` "후속(이 PR 밖)" 절에 등재된 대로 backend `deepRedactSecrets` 깊이 경계 정밀 테스트(값 10 을 직접 고정)를 추가하고, `masked-markers/package.json` 의 `prepare` 인라인 스크립트를 9개 내부 패키지 공용으로 추출하는 것을 검토한다.
4. (별도 project-planner 턴, 이 PR 비차단) CLAUDE.md 에 "code-review RESOLUTION 이 사소한 spec 텍스트 오류를 직접 정정할 수 있는 예외 조건"을 명시할지 결정한다 — 팀이 이미 3라운드에 걸쳐 "내용 정확, 되돌리지 않음" 으로 결론냈으므로 급하지 않다.
5. 이 PR 자체는 위 항목들이 모두 비차단·기결정 재확인이므로 추가 수정 없이 병합 가능한 상태다.

## 라우터 결정

- `routing=all` (router 미사용 아님 — 전체 8개 reviewer 화이트리스트 강제 실행):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명, 전원) — **forced 전원 결과 확보됨**, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |
