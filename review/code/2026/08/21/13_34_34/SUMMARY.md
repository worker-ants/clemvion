# Code Review 통합 보고서

## 전체 위험도
**LOW** — 6라운드째 리뷰에서도 CRITICAL/신규 WARNING 없음. `scope`/`side_effect`/`maintainability`/`testing` 이 각각 저위험 INFO 위주 관찰을 냈고, `maintainability` 만 신규 WARNING 1건(문서 비대칭, 기능 영향 없음)을 냈다. forced whitelist(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 라운드5 가 "탐지 로직 중복은 구멍을 만들지 않는다"는 절대 서술을 조건부 서술로 정정하며 frontend 쌍둥이 파일에만 새 "대칭 캐너리 규칙" 문단을 추가하고 backend 쌍둥이(`masked-marker-mirror.spec.ts`)에는 넣지 않아 두 파일 문서 정보량이 다시 어긋남 — 이 PR 이 반복 지적해 온 비대칭 패턴의 문서판(기능 영향 없음) | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:29` vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:39-47` | backend spec.ts 에 frontend 와 동일 취지의 "판정 분기 고칠 때 양쪽에 대칭 캐너리를 함께 넣는다" 문단 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 두 스택의 미러 소멸 가드가 탐지 알고리즘(약 140줄)을 문자 그대로 복제 — 의도된 CI 게이팅 우회 설계지만 이미 2회 결함(비대칭)의 근원이었고, 알고리즘 진화 시 대칭을 사람이 재보증해야 하는 구조적 부담이 남음 | `codebase/backend/.../masked-marker-mirror-guard.ts` vs `codebase/frontend/.../masked-marker-mirror-guard.ts` | `resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 를 공유 패키지 또는 내부 패키지로 추출해 사본을 1개로 축소 검토(차단 사유 아님, 기존 defer) |
| 2 | architecture | `SOT_DIR` 정규화 방식이 backend(슬래시 리터럴)와 frontend(`path.join`+런타임 정규화)에서 서로 다른 기법 — 기능은 동일하나 "비대칭이 반복 결함 원인"이라는 이 PR 의 교훈과 맞물린 사소한 비일관성 | `masked-marker-mirror-guard.ts` backend:29 / frontend:21,144 | 여유 있을 때 한쪽 기법으로 통일 |
| 3 | maintainability | WARNING #1 의 부산물로 backend JSDoc 한 줄이 파일 내 최장 라인의 약 1.3배로 비정상적으로 김 | `codebase/backend/.../masked-marker-mirror.spec.ts:29` | frontend 처럼 문장 중간에서 줄바꿈 |
| 4 | testing | backend `deepRedactSecrets` 깊이 상한 테스트가 `not.toThrow()` 만 봐서 경계값을 못박지 않음 (기존 파일, 이미 plan 에 후속으로 등재) | `codebase/backend/.../sanitize-error-message.spec.ts` (`caps recursion depth`) | 값싼 후속 PR 에서 `MAX_REDACT_DEPTH`/`+1` 경계 테스트 추가 |
| 5 | testing | frontend 깊이 경계 테스트가 `MAX_MASK_DEPTH` import 대신 리터럴 `10`/`11` 을 계속 사용 (RED 로 죽으므로 vacuous 아님, 이번 PR 미변경 파일) | `codebase/frontend/.../masked-markers.test.ts` (경계 테스트 2건) | `import { MAX_MASK_DEPTH } from "@workflow/masked-markers"` 로 교체 |
| 6 | testing | backend 미러 가드 spec 의 repoRoot 탐색이 `__dirname` 기준 고정 상대경로(frontend 는 marker 탐색) — 캐너리 백스톱 존재 | `codebase/backend/.../masked-marker-mirror.spec.ts:33` | 다음 수정 기회에 marker 탐색 방식으로 통일 |
| 7 | side_effect | frontend `MASKED_MARKERS` 공개 타입이 `ReadonlySet<string>` → `readonly string[]` 로 변경 — 현재 Set 전용 메서드 소비처 없어 즉시 파손 없음(TS 가 향후 오용 컴파일타임 차단) | `codebase/frontend/src/lib/utils/masked-markers.ts:22-26,56` | JSDoc 에 "이제 `readonly string[]`" 한 줄 명시(선택) |
| 8 | side_effect / scope / dependency | 신규 workspace 패키지 추가로 `pnpm-lock.yaml` 의 `eslint-config-next` peer-dependency 해석 그래프가 재정렬(버전 자체는 불변) — 5라운드 연속 동일 판정, 3개 리뷰어가 독립 재확인 | `pnpm-lock.yaml` | 조치 불요(불가피한 lockfile 재해석 노이즈) |
| 9 | side_effect | `frontend-checks.yml` 트리거가 `codebase/channel-web-chat/**` 로 확장돼 web-chat 전용 PR 도 frontend 잡 전체를 추가로 돎 — 의도된 fail-closed 커버리지 트레이드오프 | `.github/workflows/frontend-checks.yml:44-48` | 조치 불요 |
| 10 | side_effect | backend `sanitize-error-message.ts` 모듈 로드가 새 외부 패키지 resolution 에 의존하게 됨 — 값 불변, 실패 모드가 "틀린 값"에서 "로드 실패"로 변화(별도 빌드 가드로 방어됨) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:10-17,128-176` | 조치 불요 |
| 11 | requirement | backend 에는 깊이 경계를 값으로 고정하는 테스트가 frontend 대비 없음 — plan 에 "후속(이 PR 밖)"으로 이미 의도적 이월 명시 | `plan/in-progress/masked-marker-shared-package.md` 하단 | 조치 불요(추적 중) |
| 12 | scope | `developer` 가 `spec/5-system/14-external-interaction-api.md` 를 직접 편집(R17 SoT 서술 + frontmatter 1행) — CLAUDE.md 상 원칙적으로 planner 위임 대상이나, 이미 2회 독립 리뷰 라운드(requirement·scope)가 "되돌릴 필요 없음"으로 재확인 | `spec/5-system/14-external-interaction-api.md:1622-1631,16` (커밋 `bf0618a7d`) | 조치 불요(반복 시 CLAUDE.md 예외 조항화를 별도 planner 턴에서 검토) |
| 13 | documentation | `CHANGELOG.md` 에 이번 패키지 추출 항목 없음 — 동일 성격 선례(`@workflow/ai-end-reason`)도 미기재, 저장소 관행과 일치 | `CHANGELOG.md` | 조치 불요(선례 일치) |
| 14 | documentation | frontend `masked-markers.ts` 에서 `MASKED_MARKERS` 가 `isMaskedMarker` 전용 JSDoc 아래 함께 export 되어 자체 설명 부재(backend 는 분리돼 있음) — 4라운드째 미변경 유지 | `codebase/frontend/src/lib/utils/masked-markers.ts` | (선택) backend 처럼 `export {}` 분리 + 전용 JSDoc 한 줄 |
| 15 | security/architecture 등 다수 | 신규 미러 소멸 가드의 AST 파싱 대상은 저장소 자신의 커밋된 소스뿐(신뢰 경계 내부), `prepare` 스크립트·devDependency 8종은 기존 8개 형제 패키지와 동일 — 신규 위험 없음 | `codebase/packages/masked-markers/package.json` 등 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 실제 로직(정규식·깊이 walk·정확일치 판정) 값·순서 불변 확인. 하드코딩 시크릿 없음. `MASKED_MARKERS` freeze 가 오히려 강화됨 |
| architecture | NONE | 신규 WARNING 없음. INFO 2건(가드 로직 복제 구조적 부담, `SOT_DIR` 정규화 기법 비대칭) |
| requirement | NONE | 5라운드 수정사항이 소스에 실제 반영됨을 재확인. spec R17·CI 8곳·plan 체크리스트 일치 |
| scope | LOW | 실질 변경 24개 파일 전부 목표와 1:1 대응. INFO 2건(lockfile 노이즈, developer 의 spec 직접 편집) |
| side_effect | LOW | INFO 4건(타입 변경 Set→Array, lockfile 재정렬, CI 트리거 확장, 모듈 로드 의존성 변화) — 전부 저위험 |
| maintainability | LOW | WARNING 1건(backend/frontend 문서 비대칭 재발) + INFO 1건(긴 줄) |
| testing | LOW | 관련 스위트 전수 GREEN(20+89+38+82). INFO 3건 — 전부 기존 파일의 이미 추적된 갭 |
| documentation | NONE | 신규 결함 없음. 이전 라운드 수정사항 전부 실제 반영 확인. INFO 2건(CHANGELOG 미기재, JSDoc 세분도 차이) — 둘 다 기존 판정 유지 |
| dependency | NONE | 신규 devDependency 8종 형제 패키지와 완전 동일. 등록 표면 8곳 상호 정합. lockfile 노이즈만 |
| user_guide_sync | NONE | 20개 trigger 중 `spec-major-change` 만 매칭되고 이미 동반 갱신됨. UI/문서 동기화 갭 없음 |

## 발견 없는 에이전트

security, requirement, documentation, dependency, user_guide_sync — 신규 CRITICAL/WARNING 없음(NONE 등급, INFO 만 있거나 전무).

## 권장 조치사항

1. (선택, 값쌈) `maintainability` WARNING #1 — `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:29` 뒤에 frontend 와 동일한 "대칭 캐너리 규칙" 문단 추가. 기능 영향 없음, 병합을 막을 사유 아님.
2. 나머지 INFO 항목은 전부 기존 라운드에서 이미 저위험/추적 중으로 판정되었거나 이번 라운드에서 재확인된 무해 관찰이므로 즉시 조치 불요. 이 PR 은 병합 가능한 상태.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, user_guide_sync (10명)
  - **제외**: 표 (아래, 4명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 순수 리팩터(값·시그니처 불변), 성능 영향 표면 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 관련 코드 변경 없음 |
  | api_contract | router 판단 — 공개 API 계약 변경 없음 (내부 패키지 재export) |