# RESOLUTION — 15_18_16

본 리뷰(`review/code/2026/09/21/15_18_16`)는 main 이 사전 지정한 서지컬 조치 목록을 그대로
집행했다 — SUMMARY 전체 재분류 대신, 아래 "고칠 것"/"하지 말 것" 지시를 그대로 따랐다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING 1 | 코드(문서) | `197425f51` | `CHANGELOG.md` 에 이번 PR(인증 설정, 일곱 번째) 항목 + `#1373`(멤버 제거, 여섯 번째) backfill 항목 2건 추가 |
| INFO 1    | 코드(주석만) | `69539209f` | 제거하지 않음 — `remove()` 의 선행 `findById` 를 fail-fast 계약으로 유지하는 근거를 주석으로 남김. 신규 unit 테스트('대상이 없으면 DELETE 를 시도하지 않는다')가 그 계약을 고정하므로 SELECT 왕복 1회를 아끼자고 계약을 줄이는 거래를 하지 않음 |
| INFO 3    | 코드 | `5502d1dee` | mock 팩토리의 죽은 `remove: jest.fn(...)` 필드 제거. `grep -n "repo\.remove\|\.remove("` 로 스펙 파일 잔존 확인 — `service.remove(` 호출 5건만 남고 `repo.remove`/mock `.remove(` 잔존 0건 |
| INFO 5    | 코드 | `69539209f` | `findById()` JSDoc 호출자 목록을 `findById(` 전수 grep 실측으로 재작성. 신규 목록: `findByIdForResponse`/`update`/`regenerate`/`remove`/`reveal`/`getUsage`. 기존 목록의 "verify" 는 실제로는 `verifyWebhookRequest` 를 가리키는 듯했으나 그 함수는 자체 `findOne` 을 쓰고 `findById` 를 호출하지 않아(별도 실패 계약 `authFailed()`) 대상에서 제외 |
| INFO 7    | 코드 | `caa9bae66` | 신규 e2e 감사 카운트 쿼리에 `resource_type = 'auth_config'` 필터 추가 — 형제 `integration-delete-concurrency.e2e-spec.ts` 와 정렬 |
| INFO 9    | 코드 | `5502d1dee` | `'대상이 없으면 DELETE 를 시도하지 않는다'` 테스트의 no-op `repo.delete.mockClear()` 제거(`beforeEach` 가 매번 새 mock 생성) |

## 무조치 (main 지시)

- **INFO 2** (mock `workspaceId` 스코프 미검증), **INFO 4** (spec 밀도 비대칭, 이미 처분됨),
  **INFO 6** (e2e 헬퍼 추출 — 이 계열 7파일 전체 사안, 한 파일만 손대면 비대칭), **INFO 8**
  (e2e 타이머 미정리), **INFO 10** (`throwAuthConfigNotFound` 추출은 기존 diff/plan 근거로
  이미 정당화), **INFO 11** (plan 부수 편집, disclose 됨), **INFO 12** (lifecycle hook 우회,
  현재 훅 0건 재검증 완료, 조치 불요), **INFO 13** (에러명 근접, JSDoc 으로 이미 완화) —
  전부 main 지시대로 무조치.

## TEST 결과

- lint  : 통과
- unit  : 통과
- build : 통과 (백엔드 타입체크 ratchet 포함)
- e2e   : 통과 (375/375)

로그: `_test_logs/lint-20260921-153059.log` · `_test_logs/unit-20260921-153151.log` ·
`_test_logs/build-20260921-153309.log` · `_test_logs/e2e-20260921-153915.log`

## 보류·후속 항목

없음 — spec 관련 항목 0건, 민감 변경 가드 적용 0건. 남은 결함 클래스 자리(`ModelConfigService.remove()`
여덟 번째, WebAuthn credential 삭제 아홉 번째)는 기존에 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 이미 등재돼 있어 본 세션에서 추가로 등재하지 않았다.
