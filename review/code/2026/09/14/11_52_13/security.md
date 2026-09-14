# 보안(Security) Review — trigger-canary-hardening (재검토, review/code/2026/09/14/11_52_13)

## 범위 요약

이번 payload 는 실질적으로 두 층으로 구성된다.

1. **코드 diff (파일 1~6)** — `codebase/backend` 의 신규 repo-guard(`trigger-secret-columns-{guard.ts,spec.ts}`),
   기존 e2e/spec 파일의 주석 정정·`expectTriggerWorkflowRef` 어서션 추가 3곳(`schedule-trigger.e2e-spec.ts`),
   caner 두 파일(`trigger-workflow-ref.spec.ts`·`trigger-workflow-ref.e2e-spec.ts`)의 표기 통일·JSDoc 정정.
   **프로덕션 코드(`modules/**`)는 전혀 건드리지 않는다.**
2. **harness 산출물 (파일 7~36)** — `plan/in-progress/*.md` 갱신, 그리고 직전 두 라운드
   (`review/code/2026/09/14/11_27_40`, `review/consistency/2026/09/14/{10_44_37,11_27_47}`)의
   리뷰·컨시스턴시 산출물 그 자체가 이번 diff 에 포함돼 있다 — 이번 세션은 그 라운드들에 대한
   **재검토**에 해당한다. 이 안에 이미 security 리뷰(`review/code/.../11_27_40/security.md`, 위험도 NONE)가
   포함돼 있어 직접 대조했다.

코드 diff 를 워킹트리에서 직접 열람해 대조한 결과(`trigger-secret-columns-guard.ts` 전문, `schedule-trigger.e2e-spec.ts` 신규 어서션 3곳, `chat-channel-trigger-create.e2e-spec.ts` 의 기존 더미 시크릿 상수), 신규로 도입되는 외부 입력 경로·인증/인가 분기·암호화 로직·네트워크 호출은 없다.

## 발견사항

- **[INFO] 신규 repo-guard 의 파일 경로 인자는 하드코딩 상수로만 호출 — 경로 탐색 위험 없음**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `readStringArrayConst`(게이트 46~106행), `CANONICAL_SOURCE`/`MIRROR_SOURCES`(게이트 12~26행)
  - 상세: `readStringArrayConst(repoRoot, relPath, constName)` 이 `path.join(repoRoot, relPath)` 로 절대경로를 만들어 `fs.readFileSync` 로 읽는다(게이트 51·62행). `relPath` 는 외부 입력이 아니라 같은 파일에 하드코딩된 `CANONICAL_SOURCE`(게이트 12~13행)와 `MIRROR_SOURCES` 배열(게이트 23~26행)로만 호출되며(`readAllTriggerSecretColumnLists`, 게이트 109~123행), 사용자 입력이 개입할 여지가 없다. 대상 파일이 없을 때도 raw `ENOENT` 대신 명시적 `Error` 메시지만 던지고(게이트 54~59행) 경로 자체를 조작하지 않는다. 테스트(`trigger-secret-columns.spec.ts`)의 fixture 도 `fs.mkdtempSync(os.tmpdir())` 로 만든 자체 scratch 디렉터리 안에서만 쓴다(`beforeAll`/`afterAll`, 게이트 99~104행). 경로 탐색(path traversal) 클래스에 해당하지 않는다.
  - 제안: 조치 불필요. 향후 이 헬퍼에 호출자가 임의 문자열을 넘기는 call site 가 생기면 그때 재검토.

- **[INFO] TypeScript AST 파싱은 코드 실행이 아니다 — 안전, 설계 근거도 타당**
  - 위치: `trigger-secret-columns-guard.ts` — `ts.createSourceFile`/`ts.forEachChild` 사용부(게이트 60~106행)
  - 상세: `eval`/`vm`/동적 `require` 등 코드 실행 경로가 없다. "정규식이면 주석의 예시 문자열이 값으로 오탐된다"는 JSDoc 의 근거(게이트 30~35행)는 형제 가드(`redis-fail-open-catalog-guard.ts`)와 동일한 기존 관례이며, 소스를 직접 대조해 그 형제 가드도 같은 이유로 AST 를 씀을 확인했다. 보안 결함 아님.
  - 제안: 없음.

- **[INFO] e2e 파일의 하드코딩 fake secret 값(`SLACK_SIGNING_SECRET_HEX32`/`DISCORD_PUBLIC_KEY_HEX64`)은 이번 diff 범위 밖 — 실제 시크릿 아님**
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` — 이번 diff 는 게이트 76~79행 주석 4줄 추가뿐이고, 상수 자체(파일 46~47행 부근, unchanged)는 형식 검증용 더미 hex 값이다. 직접 열람으로 재확인함.
  - 상세: 새로 도입된 것도 아니고 실제 provider API 키가 아니므로 하드코딩된 시크릿 항목이 아니다.
  - 제안: 없음.

- **[INFO] `secret_store` 고아 row 무해성 근거 정정 — 프로덕션 삭제 경로(`secret-store.md §R4`)와 스코프가 명시적으로 분리됨**
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` — `afterAll` 상단 JSDoc(diff 헝크 기준 게이트 148~168행)
  - 상세: e2e teardown 이 raw `DELETE FROM trigger` 로 `secret_store` row 를 못 지우는 것을 "무해하다"고 판단하는 근거(세션 간 `docker compose down -v` 로 볼륨째 삭제, 세션 내 `secret_store` 를 읽는 유일한 e2e 가 자기 접두 스코프)를 표로 실었고, 실제 프로덕션 삭제 경로(`TriggersService.remove()` → `deleteByPrefix`)는 `secret-store.md §R4`(explicit application 경로 정리) 를 그대로 따른다고 별도로 명시했다(게이트 164~167행 부근). 이 구분이 없으면 "정리 안 해도 된다"는 결론이 프로덕션 코드로 번질 위험이 있는데, diff 는 그 경계를 정확히 긋는다. 새로운 노출 경로가 아니라 기존 부작용에 대한 문서 정확도 개선이다.
  - 제안: 없음.

- **[INFO] `expectTriggerWorkflowRef` 신규 호출 3곳은 기존 export 헬퍼 재사용 — 새 로직·새 시크릿 노출 경로 없음**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2(게이트 277~280행), G(게이트 391~394행), H(게이트 429~432행)
  - 상세: `expectTriggerWorkflowRef(dto, { present, expectedWorkflowId })` 시그니처는 이번 diff 이전부터 `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 에 export 돼 있으며, 새 호출은 이미 HTTP 응답으로 받은 `row`/`patch.body.data` 에 대한 순수 `expect` 단언일 뿐 추가 HTTP/DB 호출·새 필드 직렬화를 만들지 않는다. `assertMatchesContract` 직후에 위치해 `TriggerDto` 계약(비밀 컬럼 strip 포함)이 먼저 검증된 뒤 실행되므로 이 어서션 추가가 시크릿 노출 표면을 넓히지 않는다. `SELECT ... WHERE id = $1` 형태의 파라미터화 쿼리만 사용(직접 열람으로 확인) — SQL 인젝션 표면 없음.
  - 제안: 없음.

## 직전 라운드 security.md 재확인

`review/code/2026/09/14/11_27_40/security.md`(파일 17, 위험도 NONE)가 같은 코드 diff(파일 1~6)를 대상으로 이미 동일한 결론(신규 프로덕션 코드 없음, 하드코딩 상수 경로만, AST 안전, 더미 시크릿, R4 스코프 분리)에 도달했음을 확인했다. 이번 재검토에서 그 결론을 뒤집을 새로운 사실은 발견하지 못했다. 이번 diff 에 새로 포함된 harness 산출물(`plan/**`, `review/**`)은 코드가 아니라 리뷰·컨시스턴시 체크 보고서이며, 그 내용 자체(컨텍스트 예산 절단으로 인한 검증 커버리지 결손 등)는 requirement/documentation 관점의 이슈이지 보안 취약점은 아니다.

## 요약

이번 변경셋은 신규 프로덕션 코드 경로, 인증/인가 로직, 암호화, 네트워크 호출, 사용자 입력 처리 중 어느 것도 추가하지 않는다. 신규 repo-guard 는 하드코딩된 3개 파일 경로만 읽는 devtime AST 정적 분석 도구이고, 나머지는 이미 존재하는 응답 필드(`TriggerDto.workflow`)에 대한 e2e 단언 추가와 JSDoc/주석 정리다. 시크릿 관련 서술(비밀 컬럼 strip 3중 사본 가드, `secret_store` teardown 근거)은 오히려 프로덕션 삭제 경로와 테스트 인프라 스코프를 명확히 갈라 문서 정확도를 높이는 방향이며 새로운 노출 경로를 만들지 않는다. 인젝션·하드코딩된 실제 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출·의존성 취약점 어느 카테고리에서도 발견사항이 없다. 직전 라운드의 동일 대상 security 리뷰(위험도 NONE)와 결론이 일치한다.

## 위험도

NONE
