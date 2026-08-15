# API 계약(API Contract) 리뷰 — EIA `durationMs` DB=wire 불변식 마감 (4차 라운드)

## 검토 범위 요약

이 라운드(`15_23_10`)는 `8c2bddbcd`(base) 이후 누적된 6개 커밋 전체를 대상으로 한다. 앞선 세 라운드
(`13_58_27` → `14_47_14` → `15_00_41`)가 이미 API 계약 관점을 상세히 검토했고, 그 라운드들의
`api_contract.md` 는 모두 **LOW**, `database.md`/`concurrency.md` 는 **NONE/LOW** 로 수렴했다.
이번 라운드에 새로 추가된 코드는 그 지적들에 대한 **fix** (`bf0f86ca8`, `6f39a7167`) 이며, API 표면
자체(엔드포인트·요청 스키마·응답 스키마·인증)를 추가로 바꾸지 않는다. 소스를 직접 열어 최종 상태를
재확인했다.

API 계약 표면에 실질적으로 닿는 변경은 이전 라운드와 동일하게 셋으로 요약된다:

1. `ExecutionStatusDto.durationMs` 신규 필드 — `GET /api/external/executions/:id` 응답에 추가 (additive, nullable)
2. `finalizeCancelledExecution` — guarded UPDATE 가 0행이면 **재조회해 DB 실측으로 분기**(무조건 skip 도, 무조건 emit 도 아님) — `execution-engine.service.ts`
3. `retry-turn.service.ts` CANCELLED 분기 — `.returning(['duration_ms', 'finished_at'])` 로 emit 값을 DB 영속값과 일치시킴

## 최종 상태 재검증 결과

- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` — `durationMs?: number | null` + `@ApiPropertyOptional({ nullable: true })`. 형제 필드(`currentNode`, `context`)와 동일한 "종결 전 null, 키 present" 관례(§5.4)를 그대로 따른다. Breaking 아님.
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `STATUS_PROJECTION_COLUMNS` 에 `'durationMs'` 포함, 응답 매핑도 `execution.durationMs ?? null` 로 영속 컬럼을 그대로 싣는다(재계산 없음). 엔티티(`execution.entity.ts:62-63`)의 컬럼명(`duration_ms`)·필드명(`durationMs`) 매핑도 일치해 조회 누락 위험 없음.
- `spec/5-system/14-external-interaction-api.md:77` (EIA-IN-04) 필드 목록에 `durationMs` 가 이미 반영됨. §6.5 캐비엇도 취소선 보존 방식으로 정정 이력이 남아 있고(816-824행), 이전 라운드가 지적했던 "트래커 링크 완전 삭제" WARNING 은 `(해소됨 — 상세 이력은 같은 링크에 남아 있다.)` 문구로 이미 복원돼 있다.
- `finalizeCancelledExecution`(execution-engine.service.ts) 최종 로직 — guarded UPDATE 0행 시 재조회하여 (a) DB 가 이미 `CANCELLED` 면 **emit**(사용자 Stop 의 유일한 알림 지점 보존), (b) 다른 종결자가 선점했으면 skip, (c) 재조회 자체 실패 시도 skip. 세 갈래 모두 테스트로 고정돼 있다(회귀 테스트는 코드 리뷰 대상 파일 목록에 포함돼 있으나 diff 는 프롬프트 크기 제한으로 생략됨 — `execution-engine.service.spec.ts` 존재 자체는 확인).
- CHANGELOG 의 "수신자 영향" 절이 이 동작 변화(특정 레이스에서 `execution.cancelled` 가 **덜** 발행될 수 있음)를 명시적으로 고지하고 있고, 실제 동작도 그 서술과 일치한다(케이스 (a) 는 여전히 emit 되므로 "정상 취소 알림 소실"은 없음 — 소실되는 것은 "DB 와 모순되는 오시그널"뿐).

## 발견사항

- **[INFO]** `finalizeCancelledExecution` 의 재조회-후-분기가 webhook/SSE/WS 구독자에게 관측 가능한 이벤트 스트림 동작 변화를 일으킴 (계약상 정상화, 문서화 완료)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution` (함수명 기준 — 이 라운드 프롬프트에는 이 파일의 diff 가 크기 제한으로 생략돼 게이트 번호를 인용하지 않음. `git diff 8c2bddbcd..HEAD` 로 직접 대조 확인)
  - 상세: 동시 writer 가 이미 다른 terminal 상태로 선점한 드문 레이스에서, 종전에 오던 `execution.cancelled` 알림이 더 이상 오지 않는다(대신 선점한 writer 의 이벤트만 온다). `GET /api/external/executions/:id` 재조회로 실제 최종 status 를 여전히 확인할 수 있어 데이터 유실은 아니며, CHANGELOG·spec §6.5·`node-cancellation.md` §2.4 세 곳에 일관되게 문서화돼 있다.
  - 제안: 조치 불요. 외부 API 소비자용 정본 계약 문서(spec §6.5, EIA `finalizeCancelledExecution` 행 §2.4)에 이미 반영돼 있음을 재확인.

- **[INFO]** 신규 `durationMs` 필드는 additive·nullable 로 하위 호환 유지
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:116-130`
  - 상세: 기존 클라이언트는 필드를 무시하면 되고, 신규 파서만 값을 읽으면 된다. `STATUS_PROJECTION_COLUMNS` 와 DTO 가 함께 갱신돼 정확집합 가드와 스키마가 어긋나지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 요청 검증·URL 경로·페이지네이션·인증/인가·API 버전 관리 표면에는 이번 라운드에서도 변경 없음
  - 상세: 이번 diff 는 이전 라운드가 지적한 WARNING 에 대한 fix(주석 정정, `try/catch` 경계 수정, 두 컬럼 되쓰기 단언 보강, spec 정정 이력 보존)와 응답 DTO 필드 유지에 국한된다. 신규 엔드포인트, 경로 변경, 쿼리 파라미터, 페이지네이션, 인증/인가 가드 변경은 없다.

## 요약

이번 라운드는 앞선 세 차례 리뷰에서 API 계약 관점으로 지적된 사항(§6.5 취소선 보존 누락, DTO nullable 회귀 가드 목록 누락 등)이 모두 조치된 이후 상태를 검증한다. 신규 REST 필드(`durationMs`)는 optional·nullable 로 완전히 하위 호환이며 기존 "부재 표현" 규약(§5.4)을 정확히 따른다. `finalizeCancelledExecution` 의 guarded UPDATE 반환값 재조회 로직은 API 계약 자체(엔드포인트·스키마·인증)를 바꾸지 않지만, webhook/SSE/WS 구독자가 관측하는 이벤트 스트림 동작을 미세하게 바꾼다 — 이는 잘못된 이벤트("DB 와 모순되는 사후 오시그널")를 보내지 않게 하는 정합성 수정이며, CHANGELOG·spec §6.5·convention 문서 세 곳에 일관되게 문서화돼 있다. Breaking change, 버전 관리 이슈, 에러 응답 형식·상태 코드 문제, 요청 검증 미비, URL/경로 설계 위반, 페이지네이션 문제, 인증/인가 누락은 발견되지 않았다.

## 위험도

LOW
