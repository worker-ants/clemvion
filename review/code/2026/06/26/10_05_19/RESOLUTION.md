# RESOLUTION — C-2 cluster 4 (llm↔model-config forwardRef 순환 제거)

리뷰 세션: `review/code/2026/06/26/10_05_19/SUMMARY.md` (Risk LOW · Critical 0 · Warning 10 · INFO 18)
대상 커밋: `2bee0da5` (구현) + `272a6764` (본 review-fix)

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit |
|---|---|---|---|
| W5 | Architecture/Side-Effect | `ModelConfigService.notifyInvalidated` 가 각 리스너 호출을 `try/catch` 로 격리 — 한 리스너 throw 가 후속 리스너·mutation 응답을 깨지 않음(무효화는 best-effort 부수효과). `Logger` 추가 후 warn 로깅 | `272a6764` |
| W7 | Side-Effect | `LlmService.onConfigInvalidatedListener` 필드로 리스너 1회 바인딩 — `onModuleInit` 다회 호출 시 Set 참조-동일성 dedup 작동 | `272a6764` |
| W9 | Testing | `update(isDefault=true)` 트랜잭션 경로 `notifyInvalidated` 통지 테스트 추가 | `272a6764` |
| W10 | Testing | 리스너 throw 시 `update`/`remove` 정상 resolve + 후속 리스너 미스킵 테스트 2건 추가 | `272a6764` |
| I16 | Documentation | `LlmService.onModuleInit` JSDoc 추가(캐시 무효화 구독 역할 서술) | `272a6764` |
| I8 / impl-done W4 | Convention | `testConnection` 에 `@HttpCode(HttpStatus.OK)` 추가 — 실제 응답을 문서화된 Swagger 200 계약에 정합(종전 POST 기본 201 = pre-existing 문서-실제 불일치 해소; 2xx→2xx 라 클라이언트 영향 없음) | `c92f4e35` |
| impl-done W3 | Convention | `LlmModelConfigController` 3 핸들러에 `@ApiUnauthorizedResponse` 추가 (swagger.md §2-4 보호 엔드포인트 규약) | `c92f4e35` |

## 보류·후속 항목

**[SPEC-DRIFT → planner]** (impl ⊇ spec, behavior-preserving 이라 코드 유지·spec 갱신. plan C-2 cluster 4 planner 후속에 등재됨):
- **W1/W3** — `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 `llm-model-config.controller.ts` 미등재 → planner 등재.
- **W2** — `spec/data-flow/7-llm-usage.md` L50 컨트롤러 파일명(`model-config.controller.ts`) + L54 캐시 무효화 서술(controller 직접 호출)이 stale → planner 가 `llm-model-config.controller.ts` + 옵저버 경로로 갱신.

**[deliberate / pre-existing — 본 PR 범위 밖]**:
- **W4** — `testConnection`(POST `:id/test`)·`listModels`(GET `:id/models`) 에 `@Roles` 가드 없음. **이전 `ModelConfigController` 에서 verbatim 이전된 pre-existing 동작** — `previewModels` 만 `@Roles('editor')` 였고 test/list 는 인증만 요구(spec `6-config.md §3` "조회는 Viewer 이상"). 가드 추가는 인가 동작 변경(behavior change)이라 behavior-preserving 순환 제거 PR 범위 밖 — **별도 보안/spec 결정 필요**(test/list 가 과금 호출이므로 editor-gate 타당성 검토 권장). ⚠️ 사용자 보고 대상.
- **W6** — 동일 `@Controller('model-configs')` 프리픽스를 두 모듈 컨트롤러가 공유(split-controller). 라우트 보존(공개 API 무변)을 위한 **의도된 설계** — 양 컨트롤러에 상호참조 주석 명시. 라우트 패턴이 상호 배타라 충돌 없음(`:id` vs `:id/test`·`:id/models`·`preview-models`).
- **W8** — 테스트 fixture helper(`baseConfig`/`cfg`) 중복 = describe-scoped 자기완결 factory, 흔한 jest 패턴 — minor, 현행 유지.

**[INFO — 대부분 pre-existing/optional, 비차단]**: I1~I7·I9~I18 (비동기 타입·O(N) 스캔·@Throttle 상수화·JSDoc 보강 등) — 후속 정리 후보, 본 PR 비포함. (I8 = `@HttpCode(OK)` 은 위 조치 항목에서 해소.)

## 비고 — scope reviewer

SUMMARY 의 scope reviewer 출력 누락(파일 없음) 표기 — 변경이 순환 제거에 정확히 한정(diff = 2 commit)되어 scope 위험은 다른 reviewer(side_effect·architecture·requirement)가 충분히 커버. 재실행 불요로 판단.

## TEST 결과

- **lint**: 통과 (prettier 자동 정렬 2종 → fix 후 0 error)
- **unit**: 통과 (backend 377 suites / 7423 passed · 1 skipped — 신규 observer/onModuleInit/throw-isolation spec 포함)
- **build**: 통과 (tsc + docker 앱 이미지)
- **e2e**: 자동 흐름 환경 차단 — `docker.io` 레지스트리 `flyway/flyway:10-alpine` base metadata fetch `DeadlineExceeded` (3회 실측: BuildKit 2회 + `DOCKER_BUILDKIT=0` legacy builder 30분 hang 1회; flyway 이미지 로컬 캐시됨에도 BuildKit 의 registry metadata HEAD 타임아웃). backend 앱 이미지 빌드·단위테스트는 정상 → **코드 회귀 아님**. CI/레지스트리 회복 후 재실행 필요.
