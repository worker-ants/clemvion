# RESOLUTION — 00_08_13

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | fac49ee5 | `node-execution.entity.ts` 에 `@Index(['executionId','status'])` 추가(TypeORM 인식). DB 인덱스는 기존 Flyway V095 (partial index `WHERE status IN ('waiting_for_input','running')`)가 이미 커버 — 중복 마이그레이션 생성 없음 |
| W2 | 코드 | fac49ee5 | `getStatus` 메서드 JSDoc 에 outputData 공개 EIA 표면 보안 제약 명기 |
| W3 | defer | — | 모듈 경계 침범(NodeExecution 직접 소유 → NodeExecutionsModule 간접 접근 전환) — 장기 리팩터링 |
| W4 | defer | — | `getStatus` SRP 분리(`mapNodeExecToWaitingContext`) — 장기 리팩터링 |
| W5 | defer | — | seed↔replay seq 순서 역전: seed 는 첫 waiting 표면 1회 시드라 SSE replay 와 동일 표면. 순서 역전돼도 결과 같음(무해). reducer seq guard 는 과도한 개입 — defer. |
| W6 | 코드 | fac49ee5 | `it` → `rawInteractionType` 변수명 변경 |
| W7 | defer | — | 테스트 fetchMock 헬퍼 분리 — 중기 리팩터링 |
| W8 | defer | — | restore 경로 lastEventId=0 전체 replay: restore 는 위젯 새 마운트라 전체 replay 가 중복 아님 — defer. |

## INFO 항목 (저비용 fix 적용)

| INFO # | 분류 | 조치 | 비고 |
|--------|------|------|------|
| INFO1 | SPEC-DRIFT (코드 fix) | fac49ee5 | spec §5.2 EIA-IN-07 에 "첫 연결 `?lastEventId=0` → seq≥1 전체 replay" 1줄 보강 |
| INFO2 | 문서 fix | fac49ee5 | `external-interaction.module.ts` JSDoc 의존성 목록 `[Trigger, Execution, ExecutionToken, NodeExecution]` 갱신 |
| INFO3 | 문서 fix | fac49ee5 | `seedWaitingFromStatus` JSDoc 블록 추가 (호출시점·실패정책·파싱재사용·deps 배열 이유) |
| INFO4 | defer | — | plan 파일 완료 이동 · 커밋 메시지 미구현 테스트 교정 |
| INFO5 | defer | — | k8s README CORS 소제목·Secret 테이블 WEB_CHAT_WIDGET_ORIGINS |
| INFO6 | defer | — | EIA §5.3 conversationThread 생략 근거 |
| INFO7 | defer | — | useCallback 의존성 `[]` 주석 |
| INFO8 | defer | — | Execution 전체 컬럼 로드 select 최적화 |
| INFO9 | defer | — | Node JOIN node.type 만 SELECT 최적화 |
| INFO10 | defer | — | getStatus 무조건 HTTP 왕복 lazy fallback 최적화 |
| INFO11 | defer | — | getStatus 엣지 케이스 단위 테스트 추가 |
| INFO12 | defer | — | seedWaitingFromStatus / subscribe / eia-client 시나리오 테스트 추가 |
| INFO13 | defer | — | ExecutionStatusDto.context discriminated union 타입 명세 |
| INFO14 | 코드 fix | fac49ee5 | `seq: 0` → `SSE_SEQ_PLACEHOLDER` named const 추출 |
| INFO15 | defer | — | status.context 타입 단언 → runtime type guard |

## TEST 결과

- lint  : 통과 (41s)
- unit  : 4724/4725 통과 — 실패 1건은 spec-link-integrity(spec/7-channel-web-chat/5-admin-console.md:183 DEAD link `../../5-system/14-external-interaction-api.md`) 이 **본 커밋 이전에도 이미 존재하는 pre-existing 실패** (git stash 검증)
- e2e   : 초기 Docker VM 디스크 `No space left on device`(postgres initdb)로 차단 → `docker prune` 26.69GB 회수. (host 직접 `jest test:e2e` 는 compose 네트워크 밖이라 `ENOTFOUND postgres` 로 전건 실패 — 무효한 실행법.) **`make e2e-test`(docker-compose.e2e dockerized) 로 재실행 → 36 suites / 214 PASS** (`external-interaction.e2e-spec` 포함, getStatus 확장·entity @Index 회귀 없음).

> **정정(unit spec-link 실패 재분류)**: 위 spec-link-integrity 실패(5-admin-console.md:183 DEAD link `../../5-system/14`)는 stash 검증이 race fix 커밋(5b468d37)을 baseline 으로 삼아 pre-existing 으로 표기했으나, **실제로는 본 race fix 의 §6 race bullet 이 추가한 잘못된 상대경로**였다(같은 파일의 다른 5-system 링크는 모두 `../5-system/14`). 후속에서 `../5-system/14` 로 수정해 해소했다.

## 보류·후속 항목

### W5 defer 근거
`seedWaitingFromStatus` dispatch 와 SSE replay dispatch 는 동일 표면(`WAITING` action)을 쓰며, seed 는 첫 waiting 1회 시드 용도다. 순서가 역전돼도 마지막 dispatch 가 reducer 에 적용되므로 결과는 동일하다(무해). reducer seq guard 추가는 복잡도 대비 실질 효과가 낮아 defer.

### W8 defer 근거
restore 경로의 `openStream(saved, "0")`는 위젯 새 마운트(탭 재로드·앱 재마운트) 시 버퍼 전체를 다시 replay 하는 것이다. 이는 중복이 아니라 **첫 연결**이므로 `lastEventId=0` 이 의도된 정상 동작. seq dedup은 widgetReducer가 `WAITING` action에서 최신 값을 그대로 덮어쓰므로 동일 이벤트 중복 처리도 무해.

### e2e 환경 복구 필요
Docker VM 내부 디스크 공간 부족. 다음 중 하나로 해소 후 e2e 재실행 필요:
1. `docker system prune` (빌드 캐시 + dangling 이미지 정리)
2. Docker Desktop → Settings → Resources → Disk image size 증가

### 마이그레이션 현황
V095 (기존): `idx_node_execution_exec_status_active ON node_execution(execution_id, status) WHERE status IN ('waiting_for_input','running')` — W1 의 쿼리 대상을 이미 커버. **신규 마이그레이션 파일 없음** (중복 인덱스 방지).
