# Code Review 통합 보고서

## 전체 위험도
**LOW** — 8라운드째 리뷰인 이 PR(`masked-marker-contract-7d2e14`)의 최종 라운드에서 9개 reviewer 전원이 결과를 확보했고(forced 전원 결과 확보됨, 누락 없음), Critical 0건·WARNING 1건(비차단 문서 stale)·다수 INFO(대부분 이전 라운드 처분의 재확인)만 남아 실질적으로 병합 가능한 상태다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 이 PR 이 변경하지 않은 인접 회귀 테스트의 JSDoc 이 이 PR 이 방금 닫은 상태("공유 패키지 추출 선행 필요")를 아직 안 닫힌 것처럼 서술 — 테스트 자체는 GREEN·유효하나 다음 사람을 오도 | `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:13-24` | JSDoc 을 "이제 `@workflow/masked-markers` 를 통해 backend 와 같은 상수를 본다"로 갱신, 트래커 항목 언급을 종결 커밋 참조로 교체 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 미러 소멸 가드의 `SOT_DIR` 접두 경계(`=== SOT_DIR \|\| startsWith(SOT_DIR+'/')`)가 backend/frontend 양쪽 모두 동일하게 수정돼 있음을 재확인(선행 라운드 지적의 최종 해소 확인, 신규 결함 아님) | `masked-marker-mirror-guard.ts` backend:149, frontend:144,151 | 없음(확인 완료) |
| 2 | 부작용 | frontend `MASKED_MARKERS` 타입이 `ReadonlySet<string>` → `readonly string[]` 로 변경. 전수 grep 결과 소비처는 전부 스프레드만 사용해 파손 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts:24,56` | 조치 불요 |
| 3 | 부작용 | 신규 미러 재발 가드 테스트가 실행마다 저장소 전체(`codebase/**/src`, 500+ 파일)를 읽어 I/O 부하 추가. 이미 알려지고 수용된 트레이드오프 | `masked-marker-mirror-guard.ts` backend 139-162, frontend 140-163 | 조치 불요. 파일 수가 크게 늘면 캐싱/스캔 범위 축소 검토 |
| 4 | 부작용 | `frontend-checks.yml` 트리거 pathspec 이 `codebase/channel-web-chat/**` 를 포함하도록 확장 — web-chat 단독 PR 도 이제 이 CI 잡을 유발(CI 시간 증가, 의도된 트레이드오프) | `.github/workflows/frontend-checks.yml:48` | 조치 불요(근거 주석 있음) |
| 5 | 부작용 | 신규 캐너리 테스트 2건이 `os.tmpdir()` 에 파일 생성 — `try/finally` 로 정리 확인, 저장소 트리 밖 | `masked-marker-mirror.spec.ts`/`.test.ts` (backend/frontend) | 없음(확인 목적) |
| 6 | 유지보수성 | backend/frontend 쌍둥이 미러 가드가 `SOT_DIR` 선언 형태가 다름(슬래시 리터럴 vs `path.join`+사후 정규화) — 대칭 유지 규약을 요구하면서 정작 선언 스타일 자체가 처음부터 어긋남 | `masked-marker-mirror-guard.ts` backend:29, frontend:21 | 한쪽 형태로 통일(예: frontend 도 슬래시 리터럴로) 검토 |
| 7 | 유지보수성 | 패키지 JSDoc(`index.ts`)과 `README.md` 가 "왜 공유 패키지인가" 서사를 대조 가드 없이 손으로 중복 서술 | `codebase/packages/masked-markers/src/index.ts:1-24`, `README.md:18-28` | 다음 편집 기회에 통합/링크 고려. 이번 PR 범위 아님 |
| 8 | 유지보수성 | `prepare` 스크립트가 8개 형제 패키지와 동일한 인라인 JS 를 9번째로 복제(이전 라운드에서 이미 "조치 불요" 처분, 재확인) | `codebase/packages/masked-markers/package.json:9` | 이번 PR 범위 아님. 패키지 더 늘면 공유 스크립트 추출 검토 |
| 9 | 테스트 | 미러 가드의 탐지 범위가 "선언 노드"로 명시적으로 좁혀져 있는데, 그 반대편(비-SoT import 재export 등 우회 형태)을 직접 겨냥한 부정 테스트가 없음(문서화된 설계 스코프, 결함 아님) | `masked-marker-mirror-guard.ts` backend:110-136, frontend:110-137 | 여유 있으면 `it.each` 표에 non-SoT import 재export 캐너리 추가 |
| 10 | 문서화 | frontend `masked-marker-mirror.test.ts` 에 backend 쌍둥이엔 없는 연속 빈 줄 2곳 잔존 — 이전 라운드에서 이미 비차단 처분됨, 잔존 재확인 | `masked-marker-mirror.test.ts:69-70, 86-87` | 조치 불요(원하면 빈 줄 제거) |
| 11 | 스코프 | spec R17 정정이 developer 턴에서 직접 이뤄짐 — 4라운드 연속 "내용은 구현과 정확히 일치, SPEC-DRIFT 아님, CLAUDE.md 예외화는 이 PR 과 무관한 별도 governance 결정"으로 동일 처분 | `spec/5-system/14-external-interaction-api.md:1625` | 새로 조치할 것 없음(이력 확인 목적) |
| 12 | 의존성 | `pnpm-lock.yaml` 의 `eslint-config-next` 계열 peer-dependency variant 재해석 노이즈 — 버전 자체는 불변, `pnpm install` 부산물. 8라운드 연속 동일 판정 | `pnpm-lock.yaml` | 조치 불요 |
| 13 | 스코프 | consistency 산출물(`rationale_continuity.md`)의 sub-agent 잔여 텍스트, target 코드와 무관 | `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1,3` | 조치 불요 |
| 14 | 의존성 | 신규 내부 워크스페이스 패키지 `@workflow/masked-markers` 추가 — 런타임 외부 의존 0, devDependencies 는 형제 패키지(`ai-end-reason`)와 버전까지 완전 동일 | `codebase/packages/masked-markers/package.json` | 조치 불요 |
| 15 | 의존성 | 신규 repo-guard 가 `typescript` 컴파일러 API 를 import — 이미 backend/frontend 양쪽의 기존 devDependency, test-only 경로라 번들에 영향 없음 | `masked-marker-mirror-guard.ts` (backend/frontend) | 조치 불요 |
| 16 | 의존성 | `license` 필드가 신규 `package.json` 에 없음 — private monorepo 형제 패키지 전원과 동일한 기존 관행 | `codebase/packages/masked-markers/package.json` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 정규식/값/판정 순서 불변 확인. SOT_DIR 경계 대칭 재확인(INFO 1) |
| architecture | NONE | SOLID·의존성 방향·레이어 경계 문제 없음. 신규 지적 없음 |
| requirement | NONE | plan 6개 심볼 값 무변경 이관, spec R17 line-level 일치, 미러 가드 결함 전부 해소 확인. 포맷 INFO 1 |
| scope | LOW | 라운드7 이후 실질 diff 는 6줄+12줄뿐, 스코프 이탈 없음. spec 직접 편집 등 이력성 INFO 3건 |
| side_effect | LOW | 함수 시그니처·전역 상태 불변 확인. 타입 변경/스캔 부하/CI 트리거 확장/tmpdir 사용 등 INFO 4건(모두 무해 확인) |
| maintainability | NONE | SOLID·길이·중복 문제 없음. 쌍둥이 파일 스타일 비대칭 등 INFO 3건 |
| testing | LOW | 신설 패키지·미러 가드 테스트 성숙(vacuity/오탐/격리 대응). WARNING 1(stale 인접 JSDoc) + INFO 1(부정 테스트 부재) |
| documentation | NONE | 7라운드 문서 결함 전부 소스 재확인으로 해소 확인. 잔존 빈 줄 INFO 1(이미 처분됨) |
| dependency | NONE | 외부 런타임 의존 0, devDependencies 선례와 완전 동일. 등록 표면 8곳 정합. INFO 4건 |

## 발견 없는 에이전트

- **architecture** — Critical/Warning/INFO 신규 지적 없음. 선행 라운드가 발견·수정한 결함(경로 게이팅 갭 등)이 최종 상태에 반영돼 있음을 재확인만 함.

## 권장 조치사항

1. (선택) `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:13-24` 의 stale JSDoc 을 "이제 `@workflow/masked-markers` 를 통해 backend 와 같은 상수를 크로스체크한다"로 갱신 — 유일한 WARNING, 비차단이나 다음 유지보수자 오도 방지 목적.
2. (선택, 비차단) backend/frontend 쌍둥이 미러 가드의 `SOT_DIR` 선언 형태를 한쪽으로 통일(슬래시 리터럴 권장) — 향후 "대칭 확인" 리뷰 비용을 줄임.
3. (선택, 비차단) 이번 PR 범위 밖 후속 사항은 이미 `plan/in-progress/masked-marker-shared-package.md` 에 등재돼 있으므로 별도 조치 불요 — 예: 미러 탐지 로직 자체의 공유 패키지화, `prepare` 스크립트 공통화.

## 라우터 결정

- `routing_status=all` (라우터가 전체 실행을 명시적으로 선택):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (9명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | 전 reviewer 실행됨 |
