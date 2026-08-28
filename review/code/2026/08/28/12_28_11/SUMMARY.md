# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(신규 force-split 회귀 테스트가 실제로는 `overlapBuffer` 캐리오버 불변식을 검증하지 못함 — vacuous). 나머지는 전부 INFO/확인성 발견이며, 8개 forced reviewer 전원 결과가 확보되어 "forced인데 결과 없음" 사각지대는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `text-chunker.spec.ts` 신규 force-split 테스트가 "force-split 뒤 캐리오버 없음" 불변식을 실제로 검증하지 못한다 — fixture 가 force-split 직후 텍스트가 끝나는 형태라 `overlapBuffer` 값이 어떤 청크에서도 소비(read)되지 않는다. `overlapBuffer = '';` 대입을 뮤테이션으로 원복해도(즉 옛 `getOverlapText` 값이 살아있다고 가정해도) 이 테스트는 여전히 GREEN. | `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.spec.ts` 게이트 92~127줄 / 대응 원본 `text-chunker.ts` 게이트 67~81줄 | fixture 뒤에 force-split 대상 문장 하나를 더 이어 붙여 force-split 종료 후 일반 `pushChunk` 로 청크가 하나 더 생기게 만들고, 그 청크가 옛 컨텍스트를 접두어로 포함하지 **않음**(빈 오버랩)을 단언 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement | `expression-resolver.service.ts`/`code.handler.ts` 에 신설된 `{ cause: err }` 보존 계약을 잠그는 런타임 테스트가 없다(정적 `preserve-caught-error` 룰만이 최소 안전망). plan 이 이미 "동작 결함 아님·2개 독립 리뷰어가 안전성 실측 확인" 근거로 이번 턴 유예를 기록해 수렴 조건 충족. | `expression-resolver.service.ts` 게이트 316~318줄, `code.handler.ts` 게이트 454줄 | 다음 턴에 `expect((thrown as Error).cause).toBe(originalError)` 단언 각 1줄 추가 |
| 2 | maintainability | `#1049` 사고 서사가 값의 SoT 선언과 달리 `dependabot.yml`/`PROJECT.md`/`eslint.config.mjs`(backend) 세 파일에 완결된 문단으로 반복. 같은 PR 안의 frontend/channel-web-chat 헤더는 "SoT 는 저기, 여기서 반복 기재 안 함" 패턴을 실제로 지키고 있어 대비됨. | `.github/dependabot.yml:75-88`, `PROJECT.md:59`, `codebase/backend/eslint.config.mjs:19-38` | 다음에 세 파일 중 하나를 만질 때 frontend/channel-web-chat 패턴처럼 "SoT 참조 + 링크" 한 문장으로 축약 고려 |
| 3 | maintainability | `eslint.config.mjs` 의 unicorn 플러그인 등록 블록 — 실제 설정은 1줄인데 앞에 6개 관심사가 섞인 주석 23줄이 붙어 있음(스타일 이탈은 아니나 "표만 갱신"하려는 사람이 다른 문단까지 건드릴 유혹에 노출). | `codebase/backend/eslint.config.mjs:16-39` | 필요시 registry 실측 표만 별도 블록으로 분리, 나머지 역사 서술은 링크로 축약 |
| 4 | documentation | `dependabot.yml` `ignore:` 블록에 살아있는 설정이 없는 "묘비" 주석 2단락(유닛콘 ignore 삭제 사유 + eslint 미차단 각주)이 남아 있음. YAML 문법·SoT 참조는 정상이나 방치되면 다시 낡을 수 있음. | `.github/dependabot.yml:75-88` | 다음에 이 파일 편집 시 유효성 재확인 후 필요하면 더 축약 |
| 5 | plan 위생 | `plan/in-progress/deps-peer-gating-and-eslint10.md` 최상위 체크리스트 부모 항목(`TEST WORKFLOW + /ai-review`)이 하위 lint/unit/build/e2e/`/ai-review`/`impl-done` 전부 완료 표시된 상태에서도 미체크로 남음. | `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트 섹션 | 다음에 이 plan 파일을 열 때 부모 체크박스도 정리 |
| 6 | testing | `frontend`/`channel-web-chat` 의 "eslint 9 잔류(상류 peer 미지원)" 해제 조건에 backend `eslint-unicorn-peer.spec.ts` 와 대칭되는 자동 회귀 가드가 없음 — 해제 여부 확인이 사람의 수동 registry 재조회에 의존. `--strict-peer-dependencies` 가 사후에는 잡아주지만 능동적 신호는 없음. | `codebase/frontend/eslint.config.mjs:1-21` (대조: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`) | 스코프 밖·비필수. 관측용 가벼운 스크립트 고려 가능 |
| 7 | dependency/scope | `typeorm@0.3.31 → ioredis` unmet peer(설치본 `6.0.0` vs 요구 `^5.0.4`) — 기존 lockfile 에 이미 박혀 CI `--frozen-lockfile` 게이트가 못 잡는 사각지대. 이 PR 의 회귀는 아니며(`origin/main` lockfile 과 바이트 동일 해소 확인), plan §3 에 별도 미착수 항목으로 명시적으로 분리됨. | `plan/in-progress/deps-peer-gating-and-eslint10.md` §3(신설) | 이 PR 스코프 아님. 후속 착수 시 plan 이 이미 정한 순서(런타임 경로 실측 → 처분안 선택)를 따를 것 |
| 8 | side_effect | `.github/dependabot.yml` 의 `eslint-plugin-unicorn` major ignore 제거로 dependabot 자동 PR 이 재활성화됨 — 과거 `#1049` 류 사고(사람 몰래 값이 올라가 unmet peer 생성)와 같은 구조의 표면을 다시 여는 정책 변경. 다만 이번 PR 이 그 사고의 재발 방지 가드(`eslint-unicorn-peer.spec.ts` + CI `--strict-peer-dependencies`, 둘 다 이번 리뷰에서 실측 검증됨)를 이미 갖췄음. | `.github/dependabot.yml:75-88` | 조치 불요 — 의도된 정책 변경이며 사후 게이트가 실효성 있음을 확인. 향후 유사 사고 감시는 기존 가드에 의존함을 인지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. SSRF 방어·webhook 인증·시크릿 마스킹·시스템 프롬프트 조립 순서를 직접 코드 추적으로 재검증, 전부 동작 불변 확인(전부 "조치 불요" 확인성 INFO) |
| requirement | LOW | 핵심 코드 변경 19개 파일 전수 재검증(no-useless-assignment/preserve-caught-error 대응 안전), INFO #1·#5 |
| scope | NONE | 64개 파일 diff 가 "eslint 9→10 상향" 단일 목적을 벗어나지 않음 확인. INFO #7 관련(§3 plan 부수 발견, 코드 변경 없이 문서 등재) |
| side_effect | LOW | dead-initializer/dead-store 제거 전수 사문 확인. INFO #8(dependabot 자동 PR 재활성화) 등 신규 부작용 표면은 모두 사후 가드로 방어됨 |
| maintainability | LOW | 직전 라운드 Critical/Warning 2건 해소 확인. INFO #2·#3(문서 서사 중복, 주석/코드 비율) |
| testing | LOW | WARNING #1(force-split 테스트 vacuous) — 유일한 WARNING. INFO #1·#6 |
| documentation | NONE | 직전 라운드 Critical(PROJECT.md 카운트 drift) 정정 확인. INFO #4(묘비 주석) |
| dependency | NONE | devDependency 한정 상향, 신규 프로덕션 의존성 없음. 직전 라운드 지적사항 재실측으로 해소 확인. INFO #7 관련 |

## 발견 없는 에이전트

- security — Critical/Warning 없음. INFO 6건 전부 "직접 코드 추적으로 안전 확인, 조치 불요" 성격의 확인성 발견이며 forward-looking 제안이 없음.

## 권장 조치사항

1. (비차단, 우선) `text-chunker.spec.ts` force-split 테스트에 force-split 종료 후 일반 청크 하나를 더 만드는 fixture 를 추가해 `overlapBuffer` 캐리오버 방지 불변식을 실제로 관측 가능하게 고칠 것 (WARNING #1).
2. `expression-resolver.service.ts`/`code.handler.ts` 의 `cause` 보존 계약에 런타임 단언을 추가할 것(INFO #1, 비차단·plan 유예 기록됨).
3. plan 체크리스트 부모 항목 정리(INFO #5) — 다음에 그 파일을 열 때.
4. `#1049` 서사 중복(INFO #2)과 `dependabot.yml` 묘비 주석(INFO #4)은 다음에 해당 파일을 편집할 기회에 SoT 참조 패턴으로 축약 고려.
5. `typeorm→ioredis` unmet peer(INFO #7)는 이미 plan §3 로 분리돼 있으므로 이 PR 에서는 조치 불요 — 후속 세션에서 문서화된 순서대로 착수.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (8명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명 전원 — forced 전원 결과 확보됨, 누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(devDependency 상향 + 기계적 lint 대응)와 무관 |
  | architecture | 구조 변경 없음(설정/lockfile/dead-code 제거) |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | API 엔드포인트·계약 변경 없음 |
  | user_guide_sync | 사용자 관측 가능한 동작 변화 없음(CHANGELOG 갱신 불요와 정합) |