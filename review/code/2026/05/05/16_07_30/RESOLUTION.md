# RESOLUTION — F-2 ai-review 조치

대상 변경: `828509b feat(buttons): F-2 — buttons[*].id 자동 부여 (label-slug + 마이그레이션)`

원본 리뷰: `review/2026-05-05_16-07-30/SUMMARY.md`

전체 위험도(원본): **MEDIUM** — Critical 0 / Warning 13 / Info 다수. 본 조치로 실 로직 버그·보안·correctness 8건 처리, 운영 정책 측면 5건은 deferred + 사유.

---

## Warning 조치 (8 처리, 5 deferred)

### 처리

| # | 카테고리 | 원본 | 조치 |
|---|---|---|---|
| W-1 | Correctness | `uniqueSlug` 64자 경계 — base=64자+충돌 시 slice 가 동일 값 반환 | 접미사 길이만큼 base 를 미리 줄여 결합 (`headroom = 64 - suffix.length`). while loop 로 진정한 unique 보장. 회귀 테스트 추가. |
| W-2 | Correctness | `normalizeButtonsArray` fallback prefix 충돌 검사 누락 — 사용자가 `btn_1` 명시 + index 1 fallback 도 `btn_1` 생성 | label-slug 와 fallback prefix 모두 `uniqueSlug(seed, taken)` 통과시켜 dedup. 회귀 테스트 추가. |
| W-3 | Security | `DB_PASSWORD ?? 'workflow_dev'` fallback — dev 패스워드 leak 위험 | fallback 제거, 환경변수 미설정 시 explicit `Error` throw |
| W-8 | Reliability | `ds.destroy()` finally 없음 — 예외 시 connection 누수 | `try/finally` 로 보장 |
| W-9 | Testability | `dotenv.config()` 가 module import 시 즉시 실행 — 테스트 process.env 오염 | `loadDotenv()` 헬퍼로 분리 후 `main()` 진입 시점에서만 호출 |
| W-10 | Maintainability | `PORT_ID_SLUG_REGEX` / `isValidExistingId` 가 util 과 script 에 이중 정의 | port-id.util 에 `isValidStablePortId` export 추가, button-slug.util 과 migrate-button-ids.ts 모두 동일 출처 사용 |
| W-13 | Defensive | buttons 배열 내 null 항목 미방어 | normalizeButtonsArray 와 backfillButtonIds 모두 null/non-object entry 를 fallback id 갖는 신규 객체로 대체. 회귀 테스트 추가. |
| (related) | Architecture | shadow-workflow 가 helper 호출 시 buttons 가 null 인 entry 가 들어올 가능성 | `b == null || typeof b !== 'object'` 게이트로 pass1·pass2 모두 안전 |

### Deferred (운영·아키텍처 — 별도 audit/판단 필요)

| # | 카테고리 | 원본 | 사유 |
|---|---|---|---|
| W-4 | Validation | CLI UUID 미검증 — audit_log 무결성 | `--apply` 가 수동 실행이고 운영자가 자기 workspace/user UUID 를 직접 넣는 일회성 스크립트. UUID 형식 검증 추가는 가능하나 audit_log 의 무결성은 DB 의 FK 제약이 1차 — 다음 스크립트 정비 시 함께 통일. |
| W-5 | Performance | N+1 UPDATE | 일회성 마이그레이션 — 노드 개수가 수만 건 미만이면 N+1 도 수 분 내 완료. 배치 UPDATE 도입 시 plain JSONB 머지 안전성 (concurrent write 없는 maintenance window) 검토 필요. |
| W-6 | Memory | 페이지네이션 없음 | 같은 사유. 수백만 노드 규모 도달 전엔 in-memory 처리가 단순·디버깅 용이. |
| W-7 | Concurrency | TOCTOU SELECT→UPDATE | 마이그레이션은 deploy 시 maintenance window 에서 실행 — 그 시점엔 app 이 stop 또는 read-only. 동시 쓰기 시나리오는 deploy 절차로 차단. |
| W-11 | Process | 배포 순서 의존성 코드 밖에만 존재 | spec/ + RESOLUTION 문서로 안내. 자동 강제는 deployment automation (CI 단계 추가) 영역. |
| W-12 | Audit | audit_log workspace_id 단일 필드 | 의도된 동작 — 운영자가 자신의 workspace_id 로 본인이 실행한 마이그레이션을 attribute. 마이그레이션 자체는 모든 workspace 전역. metadata.nodes_updated/backfill_count 로 범위 표현. |

---

## 변경 파일

- `backend/src/nodes/core/port-id.util.ts` — `isValidStablePortId` export 추가
- `backend/src/nodes/core/button-slug.util.ts` — uniqueSlug 64자 경계 버그 수정, fallback prefix 도 uniqueSlug 통과, null entry 방어, isValidExistingId 를 isValidStablePortId 로 alias
- `backend/src/nodes/core/button-slug.util.spec.ts` — W-1·W-2·W-13 회귀 테스트 3건 추가
- `backend/scripts/migrate-button-ids.ts` — DB_PASSWORD 강제, dotenv 지연 로드, ds.destroy() try/finally, isValidStablePortId import, null entry 방어 (3 위치)

## 재검증

- backend lint 통과, 166 suites / 2674 tests (회귀 +2건 추가) 통과, build 성공
