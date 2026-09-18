# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`

## 발견사항

- **[WARNING]** `spec_impact` 로 선언한 파일 안에 옛 전제가 그대로 남는다 (`spec/data-flow/10-triggers.md`)
  - target 위치: target 문서 `### S6. spec/data-flow/10-triggers.md trigger 생성 행` (변경안 절)
  - 위반 규약: 직접 인용 가능한 `spec/conventions/*` 단일 조항은 없음 — CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 및 이 draft 자신이 선언한 `spec_impact` 범위 완결성 문제. 엄밀히는 "정식 규약(spec/conventions/**)" 위반이라기보다 draft 의 변경 스코프 완결성 이슈이므로 등급·범위를 낮춰 보고한다.
  - 상세: target 은 `spec/data-flow/10-triggers.md` 를 `spec_impact` 에 포함시키고 S6 에서 "trigger 생성" 표 행(`(workspace_id, endpoint_path) UNIQUE + (workspace_id, type) 인덱스는 V002.`) 만 고치도록 지시한다. 그런데 같은 파일 §"Webhook `endpoint_path` 의 UNIQUE 범위" 절(현재 245~255행)에는 이 PR 이 반증하는 바로 그 전제가 그대로 남아 있다 — "`(workspace_id, endpoint_path)` 가 UNIQUE 이므로 워크스페이스 스코프 안에서는 경로가 유일하다", "충돌 회피는 `endpoint_path` 를 UUID 로 자동 발급(WH-MG-02)해 **사실상 전역 고유로 만드는 방식에 의존한다**." target 의 "무엇이 문제였나" 절이 정확히 이 문장("고엔트로피는 추측을 막을 뿐 복사는 막지 못한다")을 반박하는데, S1~S6 어디에도 이 절을 고치라는 지시가 없다. `(workspace_id, endpoint_path)` 리터럴 문자열을 spec 전체에서 세면 7곳 중 6곳만 S1~S6 이 커버하고, 이 1곳만 누락됐다(1-data-model.md:927→S2, 1-data-model.md:1036→S3 인접 편집 대상, 2-trigger-list.md:126·197→S5, 3-error-handling.md:234→S5, 10-triggers.md:173→S6, **10-triggers.md:247→미포함**).
  - 제안: S6 을 "trigger 생성 행" 뿐 아니라 §"Webhook `endpoint_path` 의 UNIQUE 범위" 절 전체로 넓힌다. 최소한 "워크스페이스 스코프 안에서는 경로가 유일하다" 및 "사실상 전역 고유로 만드는 방식에 의존한다" 두 문장을 "V132 전역 UNIQUE 가 보장한다 / UUID 발급은 squatting·enumeration(추측) 방지용이지 복사 방지 근거가 아니다" 로 정정하는 절을 S6 에 추가한다.

- **[INFO]** README 의 "UNIQUE 제약 = `ADD CONSTRAINT ... USING INDEX`" 절과의 표면적 불일치 — 위반 아님
  - target 위치: target 문서 `## 구현` V132 항목
  - 위반 규약: 없음 (참고용 관찰)
  - 상세: `codebase/backend/migrations/README.md` 의 "UNIQUE 제약은 `CREATE UNIQUE INDEX CONCURRENTLY` 후 `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX` 패턴을 사용합니다" 문장만 보면 V132 가 그 변환 단계를 생략한 것처럼 보인다. 그러나 실제 이 UNIQUE 는 named table constraint 가 아니라 처음부터(V002) plain `CREATE UNIQUE INDEX` 로 존재했고, 저장소의 유사 전례(V002·V005·V013·V017·V043·V046·V071·V072·V081·V089·V109) 전부 `ADD CONSTRAINT USING INDEX` 를 쓰지 않는다. target 이 따르는 "인덱스 교체는 DROP-먼저"(README §5, V110 선례)가 이 상황에 더 구체적으로 맞는 절차이며 target 은 이를 정확히 따른다. 위반이 아니라 README 자체의 일반 문구와 실제 관행 사이의 기존 drift이므로 이 draft 의 책임이 아니다.

- **[INFO]** 명명·마이그레이션·에러코드·swagger 규약은 모두 정확히 준수
  - target 위치: target 문서 전반 (`## 구현` 절)
  - 위반 규약: 해당 없음 (준수 확인)
  - 상세: 확인된 정합 사례 —
    - `spec/conventions/migrations.md` §1·§2: `V131`/`V132` 는 현재 max `V130` 다음 단조 증가 정수, `snake_case` descriptor, `.conf` base name 일치.
    - `spec/conventions/migrations.md` §5(README 경유) "인덱스 교체는 DROP-먼저": V132 의 `0) DROP(새 이름) → CREATE(새 이름) → DROP(옛 이름)` 순서·`.conf executeInTransaction=false`·"파일당 CONCURRENTLY 한 개" 모두 README §5 및 V110 선례와 정확히 일치.
    - `spec/conventions/migrations.md`(README 경유) "mixed 판정" — V131(트랜잭션 `DO $$`)과 V132(`CONCURRENTLY`)를 별 파일로 분리한 target 의 Rationale ("왜 두 파일인가")은 README §5 의 실측 근거(2026-09-05)를 정확히 인용한다.
    - `spec/conventions/error-codes.md` §1: 신규 사용되는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 이미 코드베이스에 존재하는 `<DOMAIN>_<CONDITION>` UPPER_SNAKE_CASE 패턴이며, 봉투 형태(top-level `code=RESOURCE_CONFLICT` + `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`)도 기존 구현(`triggers.service.ts` `rethrowEndpointPathConflict`)과 어긋나지 않는다.
    - `spec/conventions/swagger.md` §"409 중복/충돌 → `@ApiConflictResponse`": target 이 지목한 `triggers.controller.ts` "409 설명 두 곳"은 실제로 `@ApiConflictResponse` 데코레이터 설명 두 곳(현재 "동일 워크스페이스에 같은 endpointPath..." 문구)과 정확히 일치하며, 워크스페이스 문구를 걷어내라는 지시도 타당하다.
    - plan frontmatter(`worktree`/`started`/`owner`)·`spec_impact`(실재 5개 spec 경로) 는 `.claude/docs/plan-lifecycle.md` §4 스키마·Gate C 요건을 충족.

## 요약

target 문서는 마이그레이션 명명·V번호 정책·인덱스 교체 절차(README §5, V110 선례)·에러 코드 명명(UPPER_SNAKE_CASE, 도메인 prefix)·Swagger `@ApiConflictResponse` 갱신 대상까지 기존 정식 규약과 실제 코드 상태를 매우 정확하게 대조해 반영하고 있어, 형식적 정식 규약(spec/conventions/**) 위반은 발견되지 않았다. 다만 draft 스스로 선언한 `spec_impact` 범위 안에서 `spec/data-flow/10-triggers.md` 의 한 절("Webhook `endpoint_path` 의 UNIQUE 범위")이 이 PR 이 뒤집으려는 바로 그 전제(워크스페이스 스코프 유일성·UUID 발급으로 사실상 전역 고유)를 그대로 남기도록 변경안(S1~S6)이 누락하고 있어, 이 부분은 draft 확정 전에 보강이 필요하다 — 다만 이는 spec/conventions/** 조항 위반이라기보다 변경 스코프 완결성 문제에 가까워 별도 관점(정합성 검토)에서도 함께 확인돼야 한다.

## 위험도

LOW
