# RESOLUTION — 10_54_47

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 (testing) | 코드 | `74a9e714b` | `integrations.service.spec.ts:1175`, `:1197` 의 `expect(integrationRepo.remove).not.toHaveBeenCalled()` 를 `expect(integrationRepo.delete).not.toHaveBeenCalled()` 로 교체. 파일 전체 `integrationRepo.remove` 참조 0건 확인. |
| WARNING #2 (maintainability) | 코드 | `5bbdf753d` | `throwIntegrationNotFound(): never` 헬퍼 추출, `findById`/`update`/`remove`(2곳)/`rotate`(2곳)/`requireEntity` 7곳 전부 재사용 — 형제 `throwTriggerNotFound()`/`throwScheduleNotFound()` 형태 그대로. `RESOURCE_NOT_FOUND` 리터럴은 이제 헬퍼 하나뿐. |
| WARNING #3 (documentation) | 코드 | `8504d52c0` | `CHANGELOG.md` Unreleased 최상단에 형제 4건(#1369~#1371)과 동일한 3단 구성(문제→판별자→고친 것)으로 항목 추가. 판별자는 «락 없는 경로의 원자적 DELETE affected». |
| INFO #7 (testing, 추가 조치) | 코드 | `74a9e714b` | 대조군 테스트(`affected` 미보고 드라이버)에 `expect(integrationCacheBus.publish).toHaveBeenCalled()` 단언 추가 — `mockClear()` 뒤 무단언 상태 해소, 대조군 의도(«정상 삭제로 취급») 강화. |
| INFO #1 (requirement/api_contract, 추가 조치) | 코드 | `5bbdf753d` | `broadcastCredentialChange` 인접 주석의 stale `remove(entity)` 근거를 `delete(criteria)` 사실에 맞게 정정. |

## TEST 결과

- lint  : 통과
- unit  : 통과 (`integrations.service.spec.ts` 144/144, 전체 unit suite 통과 — 1회차에 무관한 `execution-response.dto.spec.ts` SIGSEGV 워커 크래시가 있었으나 재실행으로 flaky 확인, 2회차 전체 통과)
- build : 통과 (백엔드 타입체크 ratchet 포함 — `_cmd_typecheck_ratchets` 가 `build` 단계 안에서 함께 돎, `check-backend-typecheck-ratchet.py` 개별 실행으로도 재확인: 194건/35파일, baseline 과 일치)
- e2e   : 통과 (372/372)

### 뮤테이션 유효성 재검증 (WARNING #1)

`remove()` 의 conflict 분기(`usages.length > 0` 판정) 앞에 실제
`await this.integrationRepository.delete({ id, workspaceId });` 를 삽입한 뮤턴트(고유 앵커
`const usages = await this.queryUsageNodes(id, workspaceId);` 뒤, diff 1줄만 변경 확인 후 삽입)를
넣고 대상 두 테스트를 개별 실행했다.

- 예측: 교체된 `expect(integrationRepo.delete).not.toHaveBeenCalled()` 단언이 RED.
- 실측: `throws ConflictException when usages exist` RED (`Received number of calls: 1`),
  `blocks deletion when only an MCP reference exists` RED (`Received number of calls: 1`).

원복은 `cp` 로 저장해 둔 백업 파일로 수행(`git checkout`/`git restore` 미사용). 원복 후
`integrations.service.spec.ts` 144/144 GREEN, `git status --short` 클린 확인.

## 보류·후속 항목

- INFO #2 (`spec/2-navigation/4-integration.md` §9.1 동시 삭제 서술 누락): 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md:4813` 트래커 등재 상태 유지, developer 권한 밖.
- INFO #3 (204→404 wire 변경): 위 #2 트래커로 커버, 별도 조치 불요.
- INFO #4 (delete+감사 비원자성): 형제 4경로 공통 기존 패턴, 이번 PR 신규 회귀 아님 — 조치 불요.
- INFO #5 (사용처 검사-삭제 TOCTOU): `plan/in-progress/integration-dup-delete.md` "이 PR 이 하지 않는 것"에 스코프 아웃 명시, 트래커 등재됨 — 조치 불요.
- INFO #6 (감사 로그 details 스냅샷): 형제 구현과 동일 패턴, 영향 낮음 — 조치 불요.
- INFO #8 (ORM 라이프사이클 훅 우회): 저장소 전체 훅 0건 실측 확인, 이번 PR 조치 불요.
- INFO #9 (e2e 형제 4파일과 구조 중복): 의도된 미러 패턴(cafe24/makeshop 선례), 조치 불요.
- INFO #10 (공유 워크트리 잔존 뮤테이션 관측): SUMMARY 작성 시점 이미 해소 확인됨, 이 세션의 뮤테이션 작업 전후로도 `git status --short` 재확인 완료.
- 민감 변경 가드 해당 없음 — DB 마이그레이션·외부 API 계약·인증/결제 흐름·의존성 메이저 변경 없음.
- spec draft 위임 없음 — Critical/Warning 3건 전부 코드 관련(spec 결함·SPEC-DRIFT 아님), spec 변경 0건.
