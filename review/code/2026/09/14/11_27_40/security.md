# 보안(Security) Review — trigger-canary-hardening

## 범위 요약

이번 변경셋은 **프로덕션 코드(`triggers.service.ts` 등)를 전혀 건드리지 않는다.** 전부 다음 세 범주다.

1. 신규 repo-guard(`trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts`) — 비밀 컬럼 목록 3중 사본의 **정적 정합성**을 AST 로 검증하는 읽기 전용 devtime 도구.
2. 기존 e2e/스펙 파일에 단언(assertion)을 추가 — `expectTriggerWorkflowRef(...)` 호출로 이미 존재하는 응답 필드를 검증.
3. JSDoc/주석/plan 문서 정리 — 동작 변경 없음.

새로 도입되는 외부 입력 경로, 인증/인가 분기, 암호화 로직, 네트워크 호출은 없다.

## 발견사항

- **[INFO] 신규 repo-guard 의 파일 경로 인자는 상수로만 호출되어 경로 탐색 위험이 없다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (`readStringArrayConst` 함수, 게이트 40~92행) · `readAllTriggerSecretColumnLists`(94~109행)
  - 상세: `readStringArrayConst(repoRoot, relPath, constName)` 이 `path.join(repoRoot, relPath)` 로 절대경로를 만들고 `fs.readFileSync` 로 읽는다. `relPath` 인자는 외부 입력이 아니라 같은 파일에 하드코딩된 `CANONICAL_SOURCE`/`MIRROR_SOURCES` 상수(게이트 12~13, 17~20행)로만 호출된다(`readAllTriggerSecretColumnLists` 게이트 98~106행). 사용자 입력이 개입할 여지가 없어 경로 탐색(path traversal) 클래스에 해당하지 않는다. 테스트(`trigger-secret-columns.spec.ts`)의 임시파일 케이스도 `fs.mkdtempSync(os.tmpdir())` 로 만든 자체 scratch 디렉터리 안에서만 `write()` 헬퍼로 파일을 생성한다(게이트 90~100행) — repo 밖 임의 경로 쓰기가 아니다. 결함은 아니며, "새 파서가 외부 입력을 받는가"를 확인하는 차원에서 기록한다.
  - 제안: 조치 불필요. 향후 이 헬퍼에 호출자가 임의 문자열을 넘기는 새 call site 가 생기면 그때 재검토.

- **[INFO] TypeScript AST 파싱은 코드 실행이 아니다(안전) — 정규식 대신 AST 를 선택한 설계 근거가 타당함**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` (JSDoc, 게이트 23~39행)
  - 상세: `ts.createSourceFile` + `ts.forEachChild` 순회만 사용하고 `eval`/`vm`/`require(동적 경로)` 등 코드 실행 경로가 없다. JSDoc 이 밝히는 "정규식이면 주석의 예시 문자열이 값으로 오탐된다"는 근거(게이트 26~29행)는 기존 형제 가드(`redis-fail-open-catalog-guard.ts`)와 일관되고, 이 프로젝트 MEMORY 의 "정적 가드는 blind 정규식 vs 정밀 파서 경계 = 대상에 진짜 문법+정본 파서가 있는가"라는 판단 기준에도 부합한다. 보안 결함 아님 — 설계가 이전 리뷰의 교훈을 올바르게 반영했다는 점만 확인.
  - 제안: 없음.

- **[INFO] e2e 테스트의 하드코딩된 fake secret 값들은 diff 범위 밖(기존 코드)이며 실제 시크릿이 아니다**
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` — `SLACK_SIGNING_SECRET_HEX32`/`DISCORD_PUBLIC_KEY_HEX64`(파일 상단, 이번 diff 는 76~79행 주석 추가만 해당하고 이 상수들은 변경 전부터 존재)
  - 상세: `'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'`, `'xoxb-e2e-slack-token'` 등은 형식 검증(hex32/hex64 regex)을 통과시키기 위한 더미 값이며 실제 provider API 키가 아니다(외부 provider 호출은 e2e 망에서 실패하도록 설계됨 — 파일 헤더 주석 참조). 이번 리뷰 대상 diff 는 이 파일에서 주석 4줄 추가뿐이라 새로 도입된 것도 아니다. 하드코딩된 시크릿 항목으로 오인하지 않도록 기록.
  - 제안: 없음.

- **[INFO] `secret_store` 고아 row 잔존에 대한 근거 정정 — 프로덕션 삭제 경로(`secret-store.md §R4`)와는 무관함이 diff 안에서 명시적으로 구분됨**
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (`afterAll` 상단 JSDoc, 게이트 148~168행 부근 — 정확한 라인은 diff 헝크 기준 151~167행)
  - 상세: e2e teardown 이 `secret_store` row 를 raw `DELETE FROM trigger` 로 지우지 못해 남기는 것을 "무해하다"고 결론 내리는 근거(세션 간 볼륨 삭제, 세션 안 접두 스코프)가 테스트 인프라에 국한됨을 명시하고, 실제 프로덕션 삭제 경로(`TriggersService.remove()` → `deleteByPrefix`)는 `secret-store.md §R4`(explicit application 경로 정리) 를 그대로 따른다고 별도로 적었다(게이트 164~167행 부근). 이 구분이 없었다면 "정리 안 해도 된다"는 결론이 프로덕션 코드에도 번질 위험이 있었는데, diff 는 그 경계를 정확히 긋고 있다. 실질적 보안 결함 없음 — 문서화가 올바른 스코프로 되어 있음을 확인.
  - 제안: 없음.

## 요약

이번 변경은 신규 프로덕션 코드 경로, 인증/인가 로직, 암호화, 네트워크 호출, 사용자 입력 처리 어느 것도 추가하지 않는다. 신규 repo-guard 는 하드코딩된 3개 파일 경로만 읽는 devtime 정적 분석 도구이고, 그 외에는 이미 존재하는 응답 필드(`TriggerDto.workflow`)에 대한 e2e 단언 추가와 JSDoc/주석/plan 문서 정리뿐이다. 시크릿 관련 로직(비밀 컬럼 strip, `secret_store` teardown 근거)에 대한 서술은 오히려 스코프(테스트 인프라 vs 프로덕션 삭제 경로)를 명확히 갈라 문서화 정확도를 높이는 방향이며 새로운 노출 경로를 만들지 않는다. 인젝션·하드코딩된 실제 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출·의존성 취약점 중 어느 카테고리에서도 발견사항이 없다.

## 위험도
NONE
