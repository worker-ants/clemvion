# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** `auth-session-flow-change` glob(`codebase/backend/src/modules/auth/**`)에 매칭되나, 검토 결과 실제 문서 갱신 갭은 없음
  - 변경 파일: `codebase/backend/src/modules/auth/auth-oauth.service.ts`, `auth-oauth.service.spec.ts`
  - 매트릭스 항목: "인증·권한·세션 흐름 변경" → `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e` (PROJECT.md 표 + `.claude/config/doc-sync-matrix.json` `auth-session-flow-change`, `match: "semantic"`)
  - 상세: `handleCallback` 이 `DELETE … RETURNING` 을 행 배열로 오인해 모든 소셜 로그인 콜백이 `OAUTH_STATE_MISMATCH` 로 상시 실패하던 결함을 고친 것으로(`updateReturningRows` 헬퍼 도입), **이미 문서가 서술하고 있던 의도된 동작("소셜 로그인 전용 계정"이 정상 존재한다는 전제, `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx:68-72`)을 복원**하는 버그 수정이지 새 흐름·새 옵션을 도입하지 않는다. 매트릭스가 요구하는 "+ e2e" 부분은 같은 changeset 안의 `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`(파일 13, 실 드라이버로 고정)가 이미 충족한다. `07-workspace-and-team/` 어느 페이지에도 "로그인 콜백 재사용/만료 state 거절" 같은 내부 검증 디테일을 서술하는 곳이 없어 갱신할 대상 문장 자체가 없다.
  - 제안: 조치 불요. 다만 이후 이 경로에 **사용자가 설정 가능한** 새 옵션(예: OAuth 제공자 추가, 세션 정책 변경)이 붙을 때는 같은 트리거가 다시 걸리므로 그때는 `07-workspace-and-team/` 갱신을 재점검할 것.

- **[INFO]** `run-debug-flow-change`(semantic, glob 없음) 후보로 검토했으나 문서 갱신 대상 없음
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`admitExecutionOrDefer`/`updateExecutionStatus`), `execution-engine.service.spec.ts`
  - 매트릭스 항목: "실행·디버깅 흐름 변경" → `codebase/frontend/src/content/docs/05-run-and-debug/` (PROJECT.md 표, JSON `run-debug-flow-change`)
  - 상세: 이 변경도 같은 `UPDATE … RETURNING` 튜플 오인 버그를 고친 것 — admission cap(workspace/workflow 동시 실행 상한)이 실제로는 한 번도 거절하지 않고 있었고, 종결 상태 가드(`persisted`)도 항상 `true` 였다. `05-run-and-debug/` 하위 문서(`running-a-workflow.mdx`, `validation-errors.mdx` 등)를 grep 했으나 **workspace 단위 admission 큐/동시성 상한을 사용자에게 서술하는 문장 자체가 없다**(`validation-errors.mdx` 의 동시 실행 관련 서술은 Parallel 노드 내부 `Max Concurrency` 필드에 대한 것으로 이번 변경과 무관). 즉 트리거가 가리키는 문서에 고칠 문장이 없다 — 애초에 이 내부 admission 동작이 유저 가이드 범위 밖(인프라 레벨)일 가능성이 높다.
  - 제안: 조치 불요. RESOLUTION.md(`20_36_35`, `22_45_24`)가 이미 "배포 후 admission 2s 지연 소멸·cap 실제 발동" 을 관측 항목으로 plan 에 등재해 뒀으므로 문서 트리거보다 관측 트래킹으로 충분.

- **[INFO]** KB `reEmbedAll`/`reExtractAll` CAS 락 수정은 매트릭스 어떤 행에도 명확히 매칭되지 않으나, 신규 관측 가능 동작(409) 미문서화 여지
  - 변경 파일: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`, `knowledge-base.service.spec.ts`
  - 매트릭스 항목: 해당 없음(가장 가까운 후보는 "통합 신규/제공자 변경" 이나 KB 는 외부 provider 통합이 아니라 내부 기능이라 그 행의 취지와 다름)
  - 상세: 이 수정 전에는 CAS 락이 튜플 오인으로 **동시 재임베딩/재추출 요청을 한 번도 거절하지 못했다**. 수정 후에는 진행 중에 다시 누르면 409 를 실제로 반환한다(RESOLUTION `22_45_24` 관측 항목 5). `codebase/frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 에 `재임베딩`/`Re-extract` 버튼 설명은 있으나(21·43·88·115·142행), "이미 진행 중일 때 다시 누르면 어떻게 되는가"를 서술하는 문장은 없다. 단, 이 역시 원래 의도된(그러나 실효되지 않았던) 방어 동작의 복원이라 새 UX 는 아니며, 저장소의 다른 409(예: `triggers.mdx` idempotency 409, `running-a-workflow.mdx` clone 409)와 달리 KB 쪽은 애초에 이런 세부 에러코드를 문서화하는 관행이 아니었다(일관된 gap 이지 이번 PR 이 새로 만든 gap 이 아님).
  - 제안: 조치 불요(이번 PR 스코프 밖). 필요하면 별도 turn 에서 `knowledge-base.mdx`/`.en.mdx` 에 "재임베딩/재추출이 이미 진행 중이면 완료까지 기다려야 한다"는 한 문장을 추가하는 것을 검토.

- **[INFO]** 나머지 변경 파일은 매트릭스 어떤 trigger 에도 매칭되지 않음
  - 변경 파일: `codebase/backend/src/common/utils/{source-scan,assert-row-array,update-returning-rows}.{ts,spec.ts}` (`__testing__` 전용 스캔 헬퍼·공용 UPDATE/DELETE RETURNING 파서, 노드/UI/문서 표면과 무관), `codebase/backend/tsconfig.build.json`(`__testing__` 빌드 제외 설정), `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**/*.md`·`meta.json`·`_retry_state.json`(리뷰/plan 트래킹 산출물)
  - 매트릭스 항목: 해당 없음
  - 상세: 신규 노드·노드 schema·TSX 신규 문자열·신규 provider·신규 섹션 디렉토리·warningCode/errorCode enum·표현식 언어 변경 중 어느 것도 발생하지 않았다. 이번 changeset 은 TypeORM `UPDATE/DELETE … RETURNING` 이 `[rows, rowCount]` 튜플을 돌려주는데 여러 소비 지점이 행 배열로 오인해 벌어진 결함(소셜 로그인 상시 실패·admission cap 미작동·KB CAS 락 미작동)을 공용 헬퍼(`updateReturningRows`)로 일원화해 고친 순수 백엔드 정합성 수정이다.

## 요약

매트릭스 22개 trigger 행 중 glob 로 직접 매칭된 것은 `auth-session-flow-change`(1건, `codebase/backend/src/modules/auth/**`) 뿐이고, semantic 판단으로 추가 검토한 `run-debug-flow-change` 후보(execution-engine)와 매칭 없는 KB CAS 락 변경까지 포함해 총 3개 지점을 조사했으나 **셋 다 "이미 문서가 전제한 의도된 동작을 복원하는 버그 수정"** 이라 실제 docs/i18n/backend-labels 갱신 갭은 없음(auth 는 e2e 도 같은 changeset 에 이미 포함). CRITICAL/WARNING 없음, INFO 3건(전부 "검토했으나 조치 불요" 성격) + 무관 파일군 1건.

## 위험도

NONE
