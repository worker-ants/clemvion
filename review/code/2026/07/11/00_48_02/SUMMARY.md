# AI Review SUMMARY (post-rebase) — origin/main 재베이스 후 semantic-merge 검증

- scope: `--branch origin/main` (재베이스 후 전체 diff, 초점 = PR #903 와 만난 `getStatus()` 병합면)
- 사유: `origin/main` 이 PR #903(`getStatus()` 2단계 컬럼 projection)·#901·#905 로 전진. 재베이스로 내 `getStatus()` 조립 블록이 #903 의 2단계 쿼리 위에 얹혔다. git auto-merge(인접 hunk)라 **semantic 검증 필요** — 두 변경의 union 을 본 리뷰가 없다.
- 실행 reviewer 4: side_effect · security · testing · api_contract
- skip: 나머지 — DTO/spec/테스트 파일은 재베이스에서 conflict·content 변화 0(byte-identical, 재부모화만). 유일한 신규 arrangement 는 `interaction.service.ts` `getStatus()` 병합면 하나뿐.

## 종합

| 항목 | 값 |
| --- | --- |
| **Critical** | **0** |
| **Warning** | **0** |
| Info | 2 (둘 다 pre-existing·비차단) |
| 위험도 | NONE ×3, LOW ×1(INFO만) |

**추가 fix·RESOLUTION 불요.** 병합면은 두 독립 변경의 비겹침 합성이며, 실측으로 무결함 확인.

## 병합면 검증 (4인 독립)

- **비겹침 합성** (side_effect): #903 는 ~L271-315(얇은 projection·`threadRow` 재조회·`conversationThread` const 계산)을, 내 변경은 ~L343-365(`base`/`context` 조립 restructure)를 소유한다. `conversationThread` 로컬 const(= `redactThreadForPublic(threadRow?.conversationThread)`)는 내 `base` spread 에서 **변수명·값 그대로** 소비된다. wire 키 byte-identical, TS 타입 표현만 바뀜.
- **redaction 전량 보존** (security): `redactThreadForPublic`(threadRow), `deepRedactSecrets`(nodeExec.outputData → nodeOutput·buttonConfig.nodeOutput 양쪽), `deepRedactSecrets`(execution.outputData → result/error) 3곳 모두 조립 이전 실행. #903 의 projection 이 stage-1 에서 `conversation_thread` 를 아예 select 하지 않아 **unmasked thread 참조 경로가 구조적으로 소멸** — leak 표면이 오히려 줄었다.
- **"stage-1 있음 vs stage-2 없음" divergence 불가** (side_effect): `STATUS_PROJECTION_COLUMNS` 가 `conversation_thread` 를 절대 select 하지 않으므로 thread 의 소스가 stage-2 단일. 내 `conversationThread ? {...} : {}` 키 생략 로직과 충돌 없음.
- **OpenAPI 문서 무영향** (api_contract): #903 는 service 만 건드렸고 DTO 무변경. `SwaggerModule.createDocument()` 실측 — `context.oneOf`(discriminator 없음)·`nullable`·`components.schemas` 4종 그대로.
- **projection 이 DTO 필드 전량 커버** (api_contract): stage-1 `id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData` + stage-2 `conversationThread`. `updatedAt`(= `finishedAt ?? startedAt ?? new Date()`) 파생 포함 누락 0. #903 의 정확-집합 비교 테스트가 회귀 방지.
- **내 테스트가 #903 의 double-findOne 하에서 유효** (testing): `mockResolvedValue`(not Once)라 stage-1·stage-2 양쪽에 같은 값 반환 — 내 buttons-fallthrough·conversationThread-부재 단언이 vacuous 해지지 않음을 mutation testing 으로 확인. 내 테스트와 #903 테스트 5개 describe 공존(fixture clobber 없음). `jest external-interaction/` 228 pass.
- **e2e `I-2` 여전히 유효** (testing·security): mock-free 실 HTTP+Postgres. **#903 가 base 에 든 뒤 작성**돼(git log 순서) 2단계 설계 기준으로 쓰였다. thread 없는 execution seed → stage-2 가 thread 없음 산출 → 키 생략, 실증.

## Info (본 PR 미조치)

- **testing INFO**: threadRow mis-wiring 을 잡는 단위 테스트가 사실상 1건뿐(single point of failure). 단, projection/scoping 자체는 #903 의 전용 describe 블록이 커버하고, 그 한계는 이미 코드 주석(`interaction.service.spec.ts:589-592`)에 명시된 **의도된 위임**. 비차단.
- **api_contract INFO**: `context` 의 `oneOf` + `nullable` sibling 조합이 OpenAPI 3.0 상 다소 모호(strict validator 가 무시 가능). 그러나 같은 DTO `currentNode` 의 기존 관례이고 저장소 내 실 SDK 코드젠 소비자 0 → 리스크 낮음. **pre-existing, 본 병합이 만든 것 아님.**

## TEST WORKFLOW (재베이스 후 전량 재수행)

| 단계 | 결과 |
| --- | --- |
| lint | PASS (76s) |
| unit | PASS (48 suite) |
| build | PASS (107s) — 재베이스 후 literal-widening 재발 없음 확인 |
| e2e | **PASS 250** (신규 `I-2` + #903 테스트 공존, 실 DB) |

## 재베이스 conflict 해소

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 1건 — #903 의 심볼 인용(라인번호 stale 방지, 우월)을 채택하고 내 "축 분리 주의" sub-bullet 을 그 아래 재부착. 나머지 5개 커밋 auto-merge.
- 문서 가드 2567 pass (link integrity·Gate C). 인용 anchor `conversation-thread §1.3` 생존 확인.
- #901/#905 의 웹채팅 spec 은 SSE/WS wire(`waiting_for_input.formConfig` top-level)를 서술 — 내 REST `context`(nodeOutput 중첩) 정정과 **의도적 비대칭**(§R17 명문), 모순 없음.
